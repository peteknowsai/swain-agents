import {
  provisionAdvisor,
  deleteAdvisor,
  listAdvisors,
  lookupByUserId,
  provisionPool,
  getPoolStatus,
  expandPool,
  provisionContentDesk,
  type DeskProvisionInput,
  listDesks,
  deleteDesk,
  pauseDesk,
  unpauseDesk,
} from "./provision";
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

      // POST /pool/expand — add more pool agents
      if (pathname === "/pool/expand" && method === "POST") {
        const body = await req.json().catch(() => ({})) as { count?: number };
        const result = await expandPool(body.count || 20);
        return json(result);
      }

      // ========== Legacy routes (backward compat) ==========

      // POST /advisors — assign from pool
      if (pathname === "/advisors" && method === "POST") {
        const body = (await req.json()) as CaptainInput;
        if (!body.userId || !body.name) return error("userId and name are required");
        const result = await provisionAdvisor(body);
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
        await deleteAdvisor(deleteMatch.agentId);
        return json({ status: "deleted", agentId: deleteMatch.agentId });
      }

      // POST /pool/provision — create pool agents
      if (pathname === "/pool/provision" && method === "POST") {
        return json(await provisionPool());
      }

      // GET /pool/status
      if (pathname === "/pool/status" && method === "GET") {
        return json(await getPoolStatus());
      }

      // POST /desks — provision content desk
      if (pathname === "/desks" && method === "POST") {
        const body = (await req.json()) as DeskProvisionInput;
        if (!body.name || !body.region || body.lat == null || body.lon == null) {
          return error("name, region, lat, and lon are required");
        }
        const result = await provisionContentDesk(body);
        return json(result, 201);
      }

      // GET /desks — list content desks
      if (pathname === "/desks" && method === "GET") {
        return json({ desks: await listDesks() });
      }

      // POST /desks/:name/pause — pause content desk
      const deskPauseMatch = matchRoute(pathname, "/desks/:name/pause");
      if (deskPauseMatch && method === "POST") {
        await pauseDesk(deskPauseMatch.name);
        return json({ status: "paused", name: deskPauseMatch.name });
      }

      // POST /desks/:name/unpause — unpause content desk
      const deskUnpauseMatch = matchRoute(pathname, "/desks/:name/unpause");
      if (deskUnpauseMatch && method === "POST") {
        await unpauseDesk(deskUnpauseMatch.name);
        return json({ status: "active", name: deskUnpauseMatch.name });
      }

      // DELETE /desks/:name — delete content desk
      const deskDeleteMatch = matchRoute(pathname, "/desks/:name");
      if (deskDeleteMatch && method === "DELETE") {
        await deleteDesk(deskDeleteMatch.name);
        return json({ status: "deleted", name: deskDeleteMatch.name });
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
