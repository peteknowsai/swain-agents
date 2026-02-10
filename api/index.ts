import {
  provisionAdvisor,
  deleteAdvisor,
  listAdvisors,
  messageAdvisor,
  lookupByUserId,
} from "./provision";
import {
  listTemplates,
  getTemplate,
  putTemplate,
  previewWorkspace,
  type CaptainInput,
} from "./templates";

const PORT = 3847;
const TOKEN = process.env.SKIP_AGENT_API_TOKEN;

if (!TOKEN) {
  console.error("SKIP_AGENT_API_TOKEN env var is required");
  process.exit(1);
}

/** Verify bearer token */
function auth(req: Request): boolean {
  const header = req.headers.get("authorization");
  return header === `Bearer ${TOKEN}`;
}

/** JSON response helper */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Error response helper */
function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Extract route params: match URL path against pattern with :params */
function matchRoute(
  pathname: string,
  pattern: string
): Record<string, string> | null {
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

/** Match wildcard route: /templates/* captures the rest as 'filename' */
function matchWildcard(
  pathname: string,
  prefix: string
): { filename: string } | null {
  const clean = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (!clean.startsWith(prefix + "/")) return null;
  const filename = clean.slice(prefix.length + 1);
  if (!filename) return null;
  return { filename };
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    // --- Health (no auth) ---
    if (pathname === "/health" && method === "GET") {
      let agentCount = 0;
      try {
        const advisors = await listAdvisors();
        agentCount = advisors.length;
      } catch {
        // openclaw may not be available during health check
      }
      return json({
        status: "ok",
        service: "skip-agent-api",
        agentCount,
        uptime: process.uptime(),
      });
    }

    // --- Auth required for everything else ---
    if (!auth(req)) {
      return error("Unauthorized", 401);
    }

    try {
      // --- POST /advisors ---
      if (pathname === "/advisors" && method === "POST") {
        const body = (await req.json()) as CaptainInput;
        if (!body.userId || !body.name) {
          return error("userId and name are required");
        }
        const result = await provisionAdvisor(body);
        return json(result, 201);
      }

      // --- GET /advisors ---
      if (pathname === "/advisors" && method === "GET") {
        const userId = url.searchParams.get("userId");
        if (userId) {
          const agentId = await lookupByUserId(userId);
          return json({ agentId });
        }
        const advisors = await listAdvisors();
        return json({ advisors });
      }

      // --- DELETE /advisors/:agentId ---
      const deleteMatch = matchRoute(pathname, "/advisors/:agentId");
      if (deleteMatch && method === "DELETE") {
        await deleteAdvisor(deleteMatch.agentId);
        return json({ status: "deleted", agentId: deleteMatch.agentId });
      }

      // --- POST /advisors/:agentId/message ---
      const msgMatch = matchRoute(pathname, "/advisors/:agentId/message");
      if (msgMatch && method === "POST") {
        const body = (await req.json()) as { text: string };
        if (!body.text) {
          return error("text is required");
        }
        const output = await messageAdvisor(msgMatch.agentId, body.text);
        return json({ agentId: msgMatch.agentId, output });
      }

      // --- GET /templates ---
      if (pathname === "/templates" && method === "GET") {
        const templates = await listTemplates();
        return json({ templates });
      }

      // --- POST /templates/preview ---
      if (pathname === "/templates/preview" && method === "POST") {
        const body = (await req.json()) as CaptainInput;
        if (!body.userId || !body.name) {
          return error("userId and name are required");
        }
        const preview = await previewWorkspace(body);
        return json(preview);
      }

      // --- GET /templates/:filename (wildcard) ---
      const getTemplateMatch = matchWildcard(pathname, "/templates");
      if (getTemplateMatch && method === "GET") {
        const content = await getTemplate(getTemplateMatch.filename);
        return new Response(content, {
          headers: { "Content-Type": "text/markdown" },
        });
      }

      // --- PUT /templates/:filename (wildcard) ---
      if (getTemplateMatch && method === "PUT") {
        const content = await req.text();
        if (!content) {
          return error("Body content is required");
        }
        await putTemplate(getTemplateMatch.filename, content);
        return json({ status: "updated", filename: getTemplateMatch.filename });
      }

      return error("Not found", 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${method} ${pathname}] Error:`, message);
      return error(message, 500);
    }
  },
});

console.log(`skip-agent-api running on http://localhost:${PORT}`);
