/**
 * One-time migration: kill heartbeats, create per-task crons.
 *
 * Run on VPS:
 *   cd /root/clawd/swain-agents/api && bun run migrate-crons.ts
 *
 * What it does:
 *   1. Removes `heartbeat` from all agents in openclaw.json
 *   2. Deletes old desk-heartbeat-* crons
 *   3. Creates new per-task crons for each active desk
 *   4. Creates liked-flyers + profile-maintenance crons for each active advisor
 *   5. Creates missing briefing + watchdog crons (e.g., Manny/pool-08)
 *   6. Updates HEARTBEAT.md in every workspace
 *   7. Removes heartbeatInterval from registry entries
 *   8. Restarts the gateway
 */

import { writeFile } from "fs/promises";
import { join } from "path";
import {
  WORKSPACES_ROOT,
  readConfig,
  writeConfig,
  openclaw,
  loadRegistry,
  saveRegistry,
} from "./shared";

const DRY_RUN = process.argv.includes("--dry-run");
const log = (msg: string) => console.log(DRY_RUN ? `[DRY RUN] ${msg}` : msg);

const HEARTBEAT_CONTENT = `# Heartbeat

This agent uses crons for all scheduled work. No heartbeat actions needed.

NO_REPLY
`;

// --- Desk cron definitions ---

function deskCrons(name: string) {
  return [
    {
      cronName: `desk-requests-${name}`,
      cron: "0 6,12,18,0 * * *",
      tz: "UTC",
      systemEvent: `Check editorial requests: swain desk requests --desk=${name} --status=pending --json. Fulfill any you can with existing cards or create new ones (max 2). Use swain-content-desk skill. NO_REPLY.`,
    },
    {
      cronName: `desk-cards-${name}`,
      cron: "0 10 * * *",
      tz: "UTC",
      systemEvent: `Run gap analysis: swain card coverage --desk=${name} --json. Create up to 3 cards for uncovered categories or stale content. Use swain-content-desk skill. NO_REPLY.`,
    },
    {
      cronName: `desk-flyers-${name}`,
      cron: "0 8 * * *",
      tz: "UTC",
      systemEvent: `Generate today's flyer batch for your region. Use the swain-flyer skill. NO_REPLY.`,
    },
  ];
}

// --- Advisor cron definitions ---

function advisorExtraCrons(agentId: string, captainName: string, userId: string, tz: string) {
  return [
    {
      cronName: `Liked flyers check - ${captainName}`,
      cron: "0 8,12,16,20 * * *",
      tz,
      systemEvent: `Check for liked flyers using the swain-briefing skill step 3. If any liked flyers exist, create personalized cards. Then NO_REPLY.`,
    },
    {
      cronName: `Profile maintenance - ${captainName}`,
      cron: "0 14 * * *",
      tz,
      systemEvent: `Review your captain's profile completeness. Run swain boat profile --user=${userId} --json. Plan follow-up questions for tomorrow's briefing. NO_REPLY.`,
    },
  ];
}

function advisorBriefingCrons(agentId: string, captainName: string, userId: string, tz: string) {
  const hash = agentId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const minuteOffset = hash % 20;
  const watchdogMinute = minuteOffset + 30 >= 60 ? minuteOffset - 30 : minuteOffset + 30;
  const watchdogHour = minuteOffset + 30 >= 60 ? 7 : 6;

  return [
    {
      cronName: `Daily briefing - ${captainName}`,
      cron: `${minuteOffset} 6 * * *`,
      tz,
      systemEvent: `It's briefing time. Build today's daily briefing for ${captainName} using the swain-briefing skill. You have full conversation context — use anything ${captainName} has mentioned recently to personalize card selection. Check MEMORY.md for their interests and recent topics. Include today's boat art card. If a briefing already exists for today, reply NO_REPLY.`,
    },
    {
      cronName: `Briefing watchdog - ${captainName}`,
      cron: `${watchdogMinute} ${watchdogHour} * * *`,
      tz,
      systemEvent: `Briefing watchdog: check if today's briefing exists. Run swain briefing list --user=${userId} --json. If no briefing for today, build it now using the swain-briefing skill. If it already exists, reply NO_REPLY.`,
    },
  ];
}

async function createCron(agentId: string, def: { cronName: string; cron: string; tz: string; systemEvent: string }) {
  log(`  + cron: ${def.cronName} (${def.cron} ${def.tz})`);
  if (DRY_RUN) return;

  await openclaw([
    "cron", "add",
    "--agent", agentId,
    "--name", def.cronName,
    "--cron", def.cron,
    "--tz", def.tz,
    "--session", "isolated",
    "--message", def.systemEvent,
    "--json",
  ]);
}

async function migrate() {
  console.log("=== Heartbeat → Crons Migration ===\n");

  const config = await readConfig();
  const registry = await loadRegistry();

  // Step 1: Remove heartbeat from all agents in gateway config
  let heartbeatsRemoved = 0;
  for (const agent of config.agents?.list ?? []) {
    if (agent.heartbeat) {
      log(`Removing heartbeat from ${agent.id} (was: ${JSON.stringify(agent.heartbeat)})`);
      if (!DRY_RUN) delete agent.heartbeat;
      heartbeatsRemoved++;
    }
  }
  if (!DRY_RUN && heartbeatsRemoved > 0) await writeConfig(config);
  log(`\nRemoved ${heartbeatsRemoved} heartbeat configs from gateway\n`);

  // Step 2: Get existing crons
  let existingCrons: any[] = [];
  try {
    const output = await openclaw(["cron", "list", "--json"]);
    const data = JSON.parse(output);
    existingCrons = data.jobs || data;
    if (!Array.isArray(existingCrons)) existingCrons = [];
  } catch (err) {
    console.error(`Failed to list crons: ${err}`);
  }

  const existingCronNames = new Set(existingCrons.map((c: any) => c.name));

  // Step 3: Delete old desk-heartbeat-* crons
  const heartbeatCrons = existingCrons.filter((c: any) => c.name?.startsWith("desk-heartbeat-"));
  for (const cron of heartbeatCrons) {
    log(`Deleting old cron: ${cron.name} (${cron.id})`);
    if (!DRY_RUN) {
      try { await openclaw(["cron", "rm", cron.id, "--json"]); }
      catch (err) { console.error(`  Failed to delete ${cron.id}: ${err}`); }
    }
  }
  if (heartbeatCrons.length > 0) log(`\nDeleted ${heartbeatCrons.length} desk heartbeat crons\n`);

  // Step 4: Create new desk crons
  for (const [agentId, entry] of Object.entries(registry.agents)) {
    if (entry.type !== "desk" || entry.status === "paused") continue;
    const name = agentId.replace(/-desk$/, "");
    log(`\nDesk: ${agentId}`);

    for (const def of deskCrons(name)) {
      if (existingCronNames.has(def.cronName)) {
        log(`  (skip) ${def.cronName} already exists`);
        continue;
      }
      await createCron(agentId, def);
    }
  }

  // Step 5: Create new advisor crons (liked-flyers, profile-maintenance, plus missing briefing/watchdog)
  for (const [agentId, entry] of Object.entries(registry.agents)) {
    if (entry.type !== "advisor" || entry.status !== "active") continue;
    if (!entry.userId || !entry.captainName) continue;

    const tz = entry.timezone || "America/New_York";
    log(`\nAdvisor: ${agentId} (${entry.captainName})`);

    // Liked flyers + profile maintenance (new for everyone)
    for (const def of advisorExtraCrons(agentId, entry.captainName, entry.userId, tz)) {
      if (existingCronNames.has(def.cronName)) {
        log(`  (skip) ${def.cronName} already exists`);
        continue;
      }
      await createCron(agentId, def);
    }

    // Briefing + watchdog (create if missing — catches pool-08/Manny)
    for (const def of advisorBriefingCrons(agentId, entry.captainName, entry.userId, tz)) {
      if (existingCronNames.has(def.cronName)) {
        log(`  (skip) ${def.cronName} already exists`);
        continue;
      }
      log(`  (MISSING — creating) ${def.cronName}`);
      await createCron(agentId, def);
    }
  }

  // Step 6: Update HEARTBEAT.md in every workspace
  log("\n\nUpdating HEARTBEAT.md files...");
  for (const agentId of Object.keys(registry.agents)) {
    const hbPath = join(WORKSPACES_ROOT, agentId, "HEARTBEAT.md");
    log(`  ${agentId}/HEARTBEAT.md`);
    if (!DRY_RUN) {
      try { await writeFile(hbPath, HEARTBEAT_CONTENT); }
      catch (err) { console.error(`  Failed to write ${hbPath}: ${err}`); }
    }
  }

  // Step 7: Remove heartbeatInterval from registry entries
  let registryUpdated = false;
  for (const entry of Object.values(registry.agents)) {
    if ("heartbeatInterval" in entry) {
      delete (entry as any).heartbeatInterval;
      registryUpdated = true;
    }
    // Also clean heartbeat from pause snapshots
    if (entry.pauseSnapshot && "heartbeat" in entry.pauseSnapshot) {
      delete (entry.pauseSnapshot as any).heartbeat;
    }
  }
  if (registryUpdated && !DRY_RUN) {
    await saveRegistry(registry);
    log("\nRegistry updated (heartbeatInterval removed)");
  }

  // Step 8: Restart gateway
  log("\nRestarting gateway...");
  if (!DRY_RUN) {
    try {
      const proc = Bun.spawn(["systemctl", "restart", "openclaw.service"], { stdout: "pipe", stderr: "pipe" });
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        console.error(`Gateway restart failed: ${stderr}`);
      } else {
        log("Gateway restarted successfully");
      }
    } catch (err) {
      console.error(`Gateway restart error: ${err}`);
    }
  }

  console.log("\n=== Migration complete ===");
  console.log("Verify with: openclaw cron list --json | jq '.jobs | length'");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
