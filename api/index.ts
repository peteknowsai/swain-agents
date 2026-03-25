// Sprite-based provisioning
import {
  provisionSpriteAdvisor,
  deleteSpriteAdvisor,
  listAdvisors,
  lookupByUserId,
  provisionSpritePool,
  getPoolStatus,
  wakeAdvisor,
  wakeAllAdvisors,
  provisionSpriteDesk,
  deleteSpriteDesk,
  provisionDeskSpritePool,
  listDesks,
  promoteSprite,
  type DeskInput,
} from "./provision-sprite";
import { type CaptainInput } from "./templates";
import {
  listAgents,
  getAgent,
  pauseAgent,
  resumeAgent,
  deleteAgent,
  listAgentFiles,
  readAgentFile,
  listAgentCrons,
  sendAgentMessage,
} from "./agents";

const PORT = 3847;
const TOKEN = process.env.SWAIN_AGENT_API_TOKEN;

if (!TOKEN) {
  console.error("SWAIN_AGENT_API_TOKEN env var is required");
  process.exit(1);
}

function auth(req: Request): boolean {
  return req.headers.get("authorization") === `Bearer ${TOKEN}`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function matchRoute(pathname: string, pattern: string): Record<string, string> | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    // Health (no auth)
    if (pathname === "/health" && method === "GET") {
      return json({ status: "ok", service: "swain-agent-api", uptime: process.uptime() });
    }

    if (!auth(req)) return error("Unauthorized", 401);

    try {
      // ========== Unified /agents routes ==========

      // POST /agents/:agentId/promote — rename pool sprite to permanent name
      const promoteMatch = matchRoute(pathname, "/agents/:agentId/promote");
      if (promoteMatch && method === "POST") {
        const body = await req.json() as { name: string };
        if (!body.name) return error("name is required (e.g., 'pete-advisor')");
        const result = await promoteSprite(promoteMatch.agentId, body.name);
        return json(result);
      }

      // POST /agents/:agentId/wake — wake a sprite and trigger a skill
      const wakeMatch = matchRoute(pathname, "/agents/:agentId/wake");
      if (wakeMatch && method === "POST") {
        const body = await req.json() as { skill: string; message?: string; chatId?: string };
        if (!body.skill) return error("skill is required");
        const result = await wakeAdvisor(wakeMatch.agentId, body.skill, {
          message: body.message,
          chatId: body.chatId,
        });
        return json(result);
      }

      // POST /agents/wake-all — wake all active advisors with a skill
      if (pathname === "/agents/wake-all" && method === "POST") {
        const body = await req.json() as { skill: string };
        if (!body.skill) return error("skill is required");
        const result = await wakeAllAdvisors(body.skill);
        return json(result);
      }

      // POST /agents/:agentId/message — send a message to an agent via OpenClaw
      const messageMatch = matchRoute(pathname, "/agents/:agentId/message");
      if (messageMatch && method === "POST") {
        const result = await sendAgentMessage(messageMatch.agentId, req);
        return json(result);
      }

      // GET /agents/:agentId/files/* — read a workspace file (must match before /files)
      const filesContentMatch = pathname.match(/^\/agents\/([^/]+)\/files\/(.+)$/);
      if (filesContentMatch && method === "GET") {
        const [, agentId, filename] = filesContentMatch;
        const result = await readAgentFile(agentId, filename);
        return json(result);
      }

      // GET /agents/:agentId/files — list workspace files
      const filesListMatch = matchRoute(pathname, "/agents/:agentId/files");
      if (filesListMatch && method === "GET") {
        const result = await listAgentFiles(filesListMatch.agentId);
        return json(result);
      }

      // GET /agents/:agentId/crons — list cron jobs
      const cronsMatch = matchRoute(pathname, "/agents/:agentId/crons");
      if (cronsMatch && method === "GET") {
        const result = await listAgentCrons(cronsMatch.agentId);
        return json(result);
      }

      // PATCH /agents/:agentId — pause/resume
      const agentPatchMatch = matchRoute(pathname, "/agents/:agentId");
      if (agentPatchMatch && method === "PATCH") {
        const body = await req.json() as { action: string };
        if (body.action === "pause") {
          const result = await pauseAgent(agentPatchMatch.agentId);
          return json(result);
        }
        if (body.action === "resume") {
          const result = await resumeAgent(agentPatchMatch.agentId);
          return json(result);
        }
        return error("Invalid action. Use 'pause' or 'resume'.");
      }

      // DELETE /agents/:agentId — unified delete
      const agentDeleteMatch = matchRoute(pathname, "/agents/:agentId");
      if (agentDeleteMatch && method === "DELETE") {
        await deleteAgent(agentDeleteMatch.agentId);
        return json({ status: "deleted", agentId: agentDeleteMatch.agentId });
      }

      // GET /agents/:agentId — agent detail
      const agentDetailMatch = matchRoute(pathname, "/agents/:agentId");
      if (agentDetailMatch && method === "GET") {
        const result = await getAgent(agentDetailMatch.agentId);
        return json(result);
      }

      // GET /agents — list all agents
      if (pathname === "/agents" && method === "GET") {
        const type = url.searchParams.get("type") as "advisor" | "desk" | null;
        const status = url.searchParams.get("status") as "available" | "active" | "paused" | null;
        const agents = await listAgents({
          type: type || undefined,
          status: status || undefined,
        });
        return json({ agents });
      }

      // ========== Pool routes ==========

      // ========== Sprite-based advisor routes ==========

      // POST /advisors — assign from sprite pool
      if (pathname === "/advisors" && method === "POST") {
        const body = (await req.json()) as CaptainInput;
        if (!body.userId || !body.name) return error("userId and name are required");
        const result = await provisionSpriteAdvisor(body);
        return json(result, 201);
      }

      // GET /advisors
      if (pathname === "/advisors" && method === "GET") {
        const userId = url.searchParams.get("userId");
        if (userId) return json({ agentId: await lookupByUserId(userId) });
        return json({ advisors: await listAdvisors() });
      }

      // DELETE /advisors/:agentId — release back to pool
      const deleteMatch = matchRoute(pathname, "/advisors/:agentId");
      if (deleteMatch && method === "DELETE") {
        await deleteSpriteAdvisor(deleteMatch.agentId);
        return json({ status: "deleted", agentId: deleteMatch.agentId });
      }

      // POST /pool/provision — create sprite pool
      if (pathname === "/pool/provision" && method === "POST") {
        const body = await req.json().catch(() => ({})) as { count?: number };
        const result = await provisionSpritePool(body.count || 1);
        return json(result);
      }

      // GET /pool/status
      if (pathname === "/pool/status" && method === "GET") {
        return json(await getPoolStatus());
      }

      // ========== Sprite-based desk routes ==========

      // POST /desks — assign desk from sprite pool
      if (pathname === "/desks" && method === "POST") {
        const body = (await req.json()) as DeskInput;
        if (!body.name || !body.region || body.lat == null || body.lon == null) {
          return error("name, region, lat, and lon are required");
        }
        const result = await provisionSpriteDesk(body);
        return json(result, 201);
      }

      // GET /desks — list desks
      if (pathname === "/desks" && method === "GET") {
        return json({ desks: await listDesks() });
      }

      // DELETE /desks/:name — release desk back to pool
      const deskDeleteMatch = matchRoute(pathname, "/desks/:name");
      if (deskDeleteMatch && method === "DELETE") {
        await deleteSpriteDesk(deskDeleteMatch.name);
        return json({ status: "deleted", name: deskDeleteMatch.name });
      }

      // POST /desk-pool/provision — create desk sprite pool
      if (pathname === "/desk-pool/provision" && method === "POST") {
        const body = await req.json().catch(() => ({})) as { count?: number };
        const result = await provisionDeskSpritePool(body.count || 1);
        return json(result);
      }

      return error("Not found", 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("already paused") || message.includes("is not paused")
        ? 409
        : message.includes("not found") ? 404 : 500;
      console.error(`[${method} ${pathname}] Error:`, message);
      return error(message, status);
    }
  },
});

console.log(`swain-agent-api running on http://localhost:${PORT}`);
