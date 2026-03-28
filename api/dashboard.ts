/**
 * Dashboard — HTML status page for all agents, desks, and pool sprites.
 * Served at GET /dashboard (no auth required — read-only operational view).
 */

import { listAgents, getCronLog, getActivity, type Agent, type CronLogEntry, type ActivityEntry } from "./db";

interface SpriteStatus {
  name: string;
  status: "running" | "warm" | "cold" | "unknown";
  lastRunningAt?: string;
}

let spriteStatusCache: { data: Map<string, SpriteStatus>; ts: number } = { data: new Map(), ts: 0 };

async function fetchSpriteStatuses(): Promise<Map<string, SpriteStatus>> {
  // Cache for 10 seconds to avoid hammering the API
  if (Date.now() - spriteStatusCache.ts < 10_000) return spriteStatusCache.data;

  try {
    const SPRITE_CLI = process.env.SPRITE_BIN || "sprite";
    const proc = Bun.spawn([SPRITE_CLI, "api", "/sprites"], {
      stdout: "pipe", stderr: "pipe",
      env: { ...process.env, HOME: process.env.HOME || "/root", PATH: `/root/.local/bin:${process.env.PATH}` },
    });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    const data = JSON.parse(stdout);
    const map = new Map<string, SpriteStatus>();
    for (const s of data.sprites || []) {
      map.set(s.name, {
        name: s.name,
        status: s.status || "unknown",
        lastRunningAt: s.last_running_at,
      });
    }
    spriteStatusCache = { data: map, ts: Date.now() };
    return map;
  } catch {
    return spriteStatusCache.data;
  }
}

interface AgentView {
  id: string;
  type: string;
  status: string;
  spriteName: string;
  spriteStatus?: string;
  lastRunningAt?: string;
  captainName?: string;
  phone?: string;
  region?: string;
  timezone?: string;
  assignedAt?: string;
  lastCron?: { skill: string; status: string; ts: string; durationMs?: number };
}

function last24h(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

async function buildAgentViews(): Promise<AgentView[]> {
  const agents = listAgents();
  const recentCrons = getCronLog({ limit: 200, since: last24h() });
  const spriteStatuses = await fetchSpriteStatuses();

  // Index last cron per agent
  const lastCronByAgent = new Map<string, CronLogEntry>();
  for (const entry of recentCrons) {
    if (!lastCronByAgent.has(entry.agent_id)) {
      lastCronByAgent.set(entry.agent_id, entry);
    }
  }

  return agents.map((a) => {
    const cron = lastCronByAgent.get(a.id);
    const sprite = spriteStatuses.get(a.sprite_name || a.id);
    return {
      id: a.id,
      type: a.type,
      status: a.status,
      spriteName: a.sprite_name || a.id,
      spriteStatus: sprite?.status,
      lastRunningAt: sprite?.lastRunningAt,
      captainName: a.captain_name || undefined,
      phone: a.phone || undefined,
      region: a.region || undefined,
      timezone: a.timezone || undefined,
      assignedAt: a.assigned_at || undefined,
      lastCron: cron ? {
        skill: cron.skill,
        status: cron.status,
        ts: cron.ts,
        durationMs: cron.duration_ms ?? undefined,
      } : undefined,
    };
  });
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    active: "#22c55e",
    available: "#a3a3a3",
    paused: "#eab308",
    success: "#22c55e",
    failed: "#ef4444",
    retry: "#eab308",
  };
  const color = colors[status] || "#a3a3a3";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${color}20;color:${color};font-size:12px;font-weight:600">${status}</span>`;
}

export function renderAgentLog(agentId: string): string {
  const agents = listAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return renderError(`Agent "${agentId}" not found`);

  const crons = getCronLog({ limit: 50, agentId, since: last24h() });
  const activities = getActivity({ agentId, since: last24h(), limit: 20 });
  const name = agent.captain_name || agent.region || agent.id;

  const cronRows = crons.map((c) => {
    const duration = c.duration_ms ? `${(c.duration_ms / 1000).toFixed(1)}s` : "—";
    return `${c.ts.slice(0, 19)}Z  ${c.status.padEnd(8)}  ${c.skill.padEnd(20)}  ${duration}${c.error ? `  ERROR: ${c.error}` : ""}`;
  }).join("\n");

  const activityRows = activities.map((a) => {
    const trigger = a.trigger ? `[${a.trigger.slice(0, 80)}]` : "[unknown trigger]";
    return `--- ${a.ts.slice(0, 19)}Z ${trigger} ---\n${a.actions}`;
  }).join("\n\n");

  const logText = `# Agent: ${name} (${agent.id})
# Type: ${agent.type} | Status: ${agent.status} | Sprite: ${agent.sprite_name || "none"}
# Captain: ${agent.captain_name || "—"} | Phone: ${agent.phone || "—"} | Region: ${agent.region || "—"}
# Timezone: ${agent.timezone || "—"} | Assigned: ${agent.assigned_at || "—"}

## Activity (last 24h)
${activityRows || "(no activity yet — will appear after next cron or conversation)"}

## Cron Log (last 24h)
${"Timestamp".padEnd(22)}  ${"Status".padEnd(8)}  ${"Skill".padEnd(20)}  Duration
${"-".repeat(80)}
${cronRows || "(no cron history)"}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${name} — Swain Log</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 24px; }
    h1 { font-size: 18px; margin-bottom: 4px; color: #fff; }
    .back { color: #22c55e; text-decoration: none; font-size: 13px; }
    .back:hover { text-decoration: underline; }
    pre { background: #111; border: 1px solid #222; border-radius: 8px; padding: 16px; margin-top: 16px; font-size: 13px; line-height: 1.6; overflow-x: auto; white-space: pre; }
    .copy-btn { margin-top: 12px; padding: 8px 16px; background: #22c55e; color: #000; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
    .copy-btn:hover { background: #16a34a; }
  </style>
</head>
<body>
  <a class="back" href="/dashboard">&larr; Dashboard</a>
  <h1>${name}</h1>
  <pre id="log">${logText}</pre>
  <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('log').textContent).then(()=>this.textContent='Copied!').catch(()=>this.textContent='Failed')">Copy to Clipboard</button>
</body>
</html>`;
}

export function renderAllLogs(): string {
  const crons = getCronLog({ limit: 100, since: last24h() });

  const logText = crons.map((c) => {
    const duration = c.duration_ms ? `${(c.duration_ms / 1000).toFixed(1)}s` : "—";
    return `${c.ts.slice(0, 19)}Z  ${c.status.padEnd(8)}  ${c.agent_id.padEnd(25)}  ${c.skill.padEnd(20)}  ${duration}${c.error ? `  ERROR: ${c.error.slice(0, 100)}` : ""}`;
  }).join("\n");

  const header = `## All Agent Activity (last 24h)
${"Timestamp".padEnd(22)}  ${"Status".padEnd(8)}  ${"Agent".padEnd(25)}  ${"Skill".padEnd(20)}  Duration
${"-".repeat(100)}
${logText || "(no activity)"}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>All Logs — Swain</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 24px; }
    h1 { font-size: 18px; margin-bottom: 4px; color: #fff; }
    .back { color: #22c55e; text-decoration: none; font-size: 13px; }
    .back:hover { text-decoration: underline; }
    pre { background: #111; border: 1px solid #222; border-radius: 8px; padding: 16px; margin-top: 16px; font-size: 13px; line-height: 1.6; overflow-x: auto; white-space: pre; }
    .copy-btn { margin-top: 12px; padding: 8px 16px; background: #22c55e; color: #000; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
    .copy-btn:hover { background: #16a34a; }
  </style>
</head>
<body>
  <a class="back" href="/dashboard">&larr; Dashboard</a>
  <h1>All Agent Activity</h1>
  <pre id="log">${header}</pre>
  <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('log').textContent).then(()=>this.textContent='Copied!').catch(()=>this.textContent='Failed')">Copy to Clipboard</button>
</body>
</html>`;
}

function renderError(msg: string): string {
  return `<!DOCTYPE html><html><head><title>Error</title></head><body style="font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;padding:24px"><a href="/dashboard" style="color:#22c55e">&larr; Dashboard</a><h1 style="color:#ef4444;margin-top:16px">${msg}</h1></body></html>`;
}

function spriteStatusBadge(status?: string): string {
  const colors: Record<string, string> = {
    running: "#22c55e",
    warm: "#eab308",
    cold: "#6b7280",
  };
  if (!status) return `<span style="color:#666">—</span>`;
  const color = colors[status] || "#a3a3a3";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${color}20;color:${color};font-size:12px;font-weight:600">${status}</span>`;
}

export async function renderDashboard(): Promise<string> {
  const agents = await buildAgentViews();

  const advisors = agents.filter((a) => a.type === "advisor" && a.status === "active");
  const desks = agents.filter((a) => a.type === "desk" && a.status === "active");
  const pool = agents.filter((a) => a.status === "available");
  const paused = agents.filter((a) => a.status === "paused");

  function advisorRow(a: AgentView): string {
    const name = a.captainName || "Unassigned";
    const lastActivity = a.lastCron ? timeAgo(a.lastCron.ts) : "—";
    const cronInfo = a.lastCron
      ? `${a.lastCron.skill} ${statusBadge(a.lastCron.status)} ${lastActivity}`
      : "<span style='color:#666'>no crons yet</span>";
    return `<tr>
      <td><a href="/dashboard/${a.id}" style="color:#fff;text-decoration:none"><strong>${name}</strong></a><br><span style="color:#888;font-size:12px">${a.spriteName}</span></td>
      <td>${spriteStatusBadge(a.spriteStatus)}</td>
      <td>${a.phone || "—"}</td>
      <td>${a.timezone || "—"}</td>
      <td>${cronInfo}</td>
    </tr>`;
  }

  function deskRow(a: AgentView): string {
    const lastActivity = a.lastCron ? timeAgo(a.lastCron.ts) : "—";
    const cronInfo = a.lastCron
      ? `${a.lastCron.skill} ${statusBadge(a.lastCron.status)} ${lastActivity}`
      : "<span style='color:#666'>no crons yet</span>";
    return `<tr>
      <td><a href="/dashboard/${a.id}" style="color:#fff;text-decoration:none"><strong>${a.region || a.id}</strong></a><br><span style="color:#888;font-size:12px">${a.spriteName}</span></td>
      <td>${spriteStatusBadge(a.spriteStatus)}</td>
      <td>${cronInfo}</td>
    </tr>`;
  }

  function poolRow(a: AgentView): string {
    return `<tr>
      <td>${a.spriteName}</td>
      <td>${a.type}</td>
      <td>${spriteStatusBadge(a.spriteStatus)}</td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Swain Dashboard</title>
  <meta http-equiv="refresh" content="30">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 24px; color: #fff; }
    h2 { font-size: 15px; color: #22c55e; text-transform: uppercase; letter-spacing: 1px; margin: 32px 0 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; border-bottom: 1px solid #222; }
    td { padding: 10px 12px; border-bottom: 1px solid #1a1a1a; font-size: 14px; }
    tr:hover { background: #111; }
    .count { color: #888; font-size: 13px; margin-left: 8px; }
    .meta { color: #666; font-size: 12px; margin-top: 32px; }
  </style>
</head>
<body>
  <h1>Swain Agents</h1>
  <p style="margin-bottom:24px;font-size:14px">
    ${(() => {
      const running = agents.filter(a => a.spriteStatus === "running").length;
      const warm = agents.filter(a => a.spriteStatus === "warm").length;
      const cold = agents.filter(a => a.spriteStatus === "cold").length;
      return `<span style="color:#22c55e">${running} running</span> &middot; <span style="color:#eab308">${warm} warm</span> &middot; <span style="color:#6b7280">${cold} cold</span>`;
    })()}
  </p>

  <h2>Advisors <span class="count">${advisors.length}</span></h2>
  ${advisors.length ? `<table>
    <tr><th>Captain</th><th>Sprite</th><th>Phone</th><th>Timezone</th><th>Last Cron</th></tr>
    ${advisors.map(advisorRow).join("")}
  </table>` : "<p style='color:#666'>No active advisors</p>"}

  <h2>Content Desks <span class="count">${desks.length}</span></h2>
  ${desks.length ? `<table>
    <tr><th>Region</th><th>Sprite</th><th>Last Cron</th></tr>
    ${desks.map(deskRow).join("")}
  </table>` : "<p style='color:#666'>No active desks</p>"}

  <h2>Pool <span class="count">${pool.length}</span></h2>
  ${pool.length ? `<table>
    <tr><th>Sprite</th><th>Type</th><th>Status</th></tr>
    ${pool.map(poolRow).join("")}
  </table>` : "<p style='color:#666'>Pool empty</p>"}

  ${paused.length ? `<h2>Paused <span class="count">${paused.length}</span></h2>
  <table>
    <tr><th>Sprite</th><th>Type</th></tr>
    ${paused.map(poolRow).join("")}
  </table>` : ""}

  <p class="meta"><a href="/dashboard/logs" style="color:#22c55e">View All Logs</a> &middot; Auto-refreshes every 30s &middot; ${new Date().toISOString().slice(0, 19)}Z</p>
</body>
</html>`;
}
