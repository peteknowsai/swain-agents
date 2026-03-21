import { marked } from "marked";

interface Env {
  VAULT: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname);

    if (path === "/" || path === "") return listSprites(env);

    // Parse: /:sprite or /:sprite/path/to/file.md
    const segments = path.slice(1).replace(/\/$/, "").split("/");
    const sprite = segments[0];
    const filePath = segments.slice(1).join("/");

    if (!filePath) return spriteView(env, sprite);
    return fileView(env, sprite, filePath);
  },
} satisfies ExportedHandler<Env>;

// ── R2 helpers ────────────────────────────────────────────────

async function listAllObjects(
  bucket: R2Bucket,
  prefix: string
): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const list = await bucket.list({ prefix, cursor, limit: 1000 });
    objects.push(...list.objects);
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  return objects;
}

// ── Sprite metadata ───────────────────────────────────────────

interface SpriteMeta {
  spriteUrl?: string;
  studioPath?: string;
}

async function getSpriteMeta(env: Env, sprite: string): Promise<SpriteMeta> {
  try {
    const obj = await env.VAULT.get(`${sprite}/_meta.json`);
    if (obj) return await obj.json();
  } catch {}
  return {};
}

function renderDbLink(meta: SpriteMeta): string {
  if (!meta.spriteUrl || !meta.studioPath) return "";
  const url = `${meta.spriteUrl}${meta.studioPath}`;
  return `<a href="${url}" target="_blank" class="db-link">Database</a>`;
}

// ── Route handlers ────────────────────────────────────────────

async function listSprites(env: Env): Promise<Response> {
  const objects = await listAllObjects(env.VAULT, "");

  const spriteMap = new Map<string, { count: number; updated: Date }>();
  for (const obj of objects) {
    const sprite = obj.key.split("/")[0];
    const existing = spriteMap.get(sprite);
    spriteMap.set(sprite, {
      count: (existing?.count ?? 0) + 1,
      updated:
        !existing || obj.uploaded > existing.updated
          ? obj.uploaded
          : existing.updated,
    });
  }

  const sprites = Array.from(spriteMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const cards = sprites
    .map(
      ([name, info]) => `
      <a href="/${name}/" class="card">
        <div class="card-name">${name}</div>
        <div class="card-meta">${info.count} file${info.count !== 1 ? "s" : ""}</div>
      </a>`
    )
    .join("");

  return page(
    "Swain Vault",
    `<div class="home">
      <h1>Swain Vault</h1>
      <p class="subtitle">Advisor brain files</p>
      <div class="grid">${cards}</div>
    </div>`
  );
}

async function spriteView(env: Env, sprite: string): Promise<Response> {
  const objects = await listAllObjects(env.VAULT, `${sprite}/`);
  if (objects.length === 0) return notFound();

  const files = objects.map((obj) => ({
    path: obj.key.slice(sprite.length + 1),
    size: obj.size,
  }));

  const tree = buildTree(files);
  const sidebar = renderTree(tree, sprite);
  const meta = await getSpriteMeta(env, sprite);

  // Try to show CLAUDE.md by default
  const claudeMd = objects.find((o) => o.key === `${sprite}/CLAUDE.md`);
  let content = `
    <div class="welcome">
      <h1>${sprite}</h1>
      <p>${files.length} file${files.length !== 1 ? "s" : ""}</p>
      <p class="hint">Pick a file from the sidebar.</p>
    </div>`;

  if (claudeMd) {
    const obj = await env.VAULT.get(claudeMd.key);
    if (obj) {
      const raw = await obj.text();
      const { meta, body } = parseFrontmatter(raw);
      const rendered = await marked(processWikilinks(body));
      content = `
        <div class="breadcrumb"><span class="current">CLAUDE.md</span></div>
        ${renderMeta(meta)}
        <article class="markdown">${rendered}</article>`;
    }
  }

  return page(
    sprite,
    `<div class="layout">
      <nav class="sidebar">
        <a href="/" class="back">&larr; All Sprites</a>
        <h2>${sprite}</h2>
        ${renderDbLink(meta)}
        ${sidebar}
      </nav>
      <main>${content}</main>
    </div>`
  );
}

async function fileView(
  env: Env,
  sprite: string,
  filePath: string
): Promise<Response> {
  const key = `${sprite}/${filePath}`;
  const obj = await env.VAULT.get(key);
  if (!obj) return notFound();

  const raw = await obj.text();
  const { meta, body } = parseFrontmatter(raw);
  const rendered = await marked(processWikilinks(body));

  // Sidebar
  const objects = await listAllObjects(env.VAULT, `${sprite}/`);
  const files = objects.map((o) => ({
    path: o.key.slice(sprite.length + 1),
    size: o.size,
  }));
  const tree = buildTree(files);
  const sidebar = renderTree(tree, sprite, filePath);
  const spriteMeta = await getSpriteMeta(env, sprite);

  // Breadcrumb
  const parts = filePath.split("/");
  const breadcrumb = parts
    .map((part, i) => {
      if (i === parts.length - 1)
        return `<span class="current">${part}</span>`;
      return `<span>${part}</span>`;
    })
    .join('<span class="sep">/</span>');

  return page(
    `${filePath} — ${sprite}`,
    `<div class="layout">
      <nav class="sidebar">
        <a href="/" class="back">&larr; All Sprites</a>
        <h2><a href="/${sprite}/">${sprite}</a></h2>
        ${renderDbLink(spriteMeta)}
        ${sidebar}
      </nav>
      <main>
        <div class="breadcrumb">${breadcrumb}</div>
        ${renderMeta(meta)}
        <article class="markdown">${rendered}</article>
        <footer>
          <span class="meta">Last synced: ${obj.uploaded.toISOString().split("T")[0]}</span>
        </footer>
      </main>
    </div>`
  );
}

// ── Markdown helpers ──────────────────────────────────────────

function parseFrontmatter(content: string): {
  meta: Record<string, string> | null;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: null, body: content };

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      value = value.replace(/^["']|["']$/g, "");
      meta[key] = value;
    }
  }
  return { meta, body: match[2] };
}

function renderMeta(meta: Record<string, string> | null): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  const rows = Object.entries(meta)
    .map(
      ([k, v]) =>
        `<div class="prop"><span class="prop-key">${k}</span><span class="prop-val">${escapeHtml(v)}</span></div>`
    )
    .join("");
  return `<div class="properties">${rows}</div>`;
}

function processWikilinks(content: string): string {
  return content
    .replace(
      /\[\[([^|\]]+)\|([^\]]+)\]\]/g,
      '<span class="wikilink">$2</span>'
    )
    .replace(/\[\[([^\]]+)\]\]/g, '<span class="wikilink">$1</span>');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── File tree ─────────────────────────────────────────────────

interface TreeNode {
  [key: string]: TreeNode | FileLeaf;
}
interface FileLeaf {
  __file: true;
  path: string;
  size: number;
}

function buildTree(
  files: { path: string; size: number }[]
): TreeNode {
  const tree: TreeNode = {};
  for (const file of files) {
    const parts = file.path.split("/");
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = { __file: true, path: file.path, size: file.size };
      } else {
        if (!current[part] || "__file" in current[part]) {
          current[part] = {};
        }
        current = current[part] as TreeNode;
      }
    }
  }
  return tree;
}

function isFile(node: TreeNode | FileLeaf): node is FileLeaf {
  return "__file" in node;
}

function treeContainsActive(tree: TreeNode, activePath?: string): boolean {
  if (!activePath) return false;
  for (const value of Object.values(tree)) {
    if (isFile(value) && value.path === activePath) return true;
    if (!isFile(value) && treeContainsActive(value, activePath)) return true;
  }
  return false;
}

function renderTree(
  tree: TreeNode,
  sprite: string,
  activePath?: string
): string {
  const entries = Object.entries(tree).sort(([a, va], [b, vb]) => {
    const aDir = !isFile(va);
    const bDir = !isFile(vb);
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.localeCompare(b);
  });

  let html = "<ul>";
  for (const [name, value] of entries) {
    if (isFile(value)) {
      const active = value.path === activePath ? " active" : "";
      html += `<li class="file${active}"><a href="/${sprite}/${value.path}">${name}</a></li>`;
    } else {
      const open = treeContainsActive(value, activePath) ? " open" : "";
      html += `<li class="dir"><details${open}><summary>${name}/</summary>${renderTree(value, sprite, activePath)}</details></li>`;
    }
  }
  html += "</ul>";
  return html;
}

// ── HTML shell ────────────────────────────────────────────────

function notFound(): Response {
  return page(
    "Not Found",
    `<div class="home"><h1>404</h1><p>File not found.</p><a href="/">&larr; Back</a></div>`,
    404
  );
}

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>${body}</body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

// ── Styles ────────────────────────────────────────────────────

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e4e4e7;background:#18181b;line-height:1.6}
a{color:#93c5fd;text-decoration:none}
a:hover{text-decoration:underline}

/* Home */
.home{max-width:800px;margin:0 auto;padding:4rem 2rem}
.home h1{font-size:1.75rem;margin-bottom:.25rem;color:#fafafa}
.subtitle{color:#71717a;margin-bottom:2rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
.card{display:block;padding:1.25rem;background:#27272a;border:1px solid #3f3f46;border-radius:8px;color:inherit;transition:border-color .15s}
.card:hover{border-color:#71717a;text-decoration:none}
.card-name{font-weight:600;font-size:1rem;margin-bottom:.25rem;color:#fafafa}
.card-meta{color:#71717a;font-size:.8rem}

/* Layout */
.layout{display:flex;min-height:100vh}

/* Sidebar */
.sidebar{width:260px;min-width:260px;background:#1f1f23;border-right:1px solid #2e2e33;padding:1.25rem;overflow-y:auto;font-size:.85rem}
.sidebar h2{font-size:.95rem;margin-bottom:.75rem;color:#fafafa}
.sidebar h2 a{color:#fafafa}
.sidebar .back{display:block;color:#71717a;font-size:.8rem;margin-bottom:.75rem}
.sidebar .back:hover{color:#a1a1aa}
.sidebar ul{list-style:none;padding-left:0}
.sidebar ul ul{padding-left:1rem}
.sidebar li{margin:1px 0}
.sidebar .file a{display:block;padding:3px 8px;color:#a1a1aa;border-radius:4px;text-decoration:none}
.sidebar .file a:hover{background:#27272a;color:#e4e4e7}
.sidebar .file.active a{background:#1e3a5f;color:#93c5fd}
.sidebar details summary{cursor:pointer;padding:3px 8px;color:#71717a;border-radius:4px;font-size:.85rem}
.sidebar details summary:hover{background:#27272a;color:#a1a1aa}
.db-link{display:block;padding:8px 12px;margin-bottom:12px;background:#1e3a5f;color:#93c5fd;border-radius:6px;text-align:center;font-size:.85rem;font-weight:500;text-decoration:none;transition:background .15s}
.db-link:hover{background:#1e4a7f;text-decoration:none}

/* Main */
main{flex:1;padding:2rem 3rem;max-width:900px;overflow-y:auto}
.breadcrumb{font-size:.8rem;color:#71717a;margin-bottom:1.25rem}
.breadcrumb .current{color:#a1a1aa;font-weight:500}
.breadcrumb .sep{margin:0 .35rem}

/* Properties (frontmatter) */
.properties{background:#27272a;border:1px solid #3f3f46;border-radius:6px;padding:.75rem 1rem;margin-bottom:1.5rem;font-size:.8rem}
.prop{display:flex;gap:.75rem;padding:2px 0}
.prop-key{color:#71717a;min-width:100px}
.prop-val{color:#a1a1aa}

/* Welcome */
.welcome{padding:2rem 0}
.welcome h1{font-size:1.5rem;margin-bottom:.5rem;color:#fafafa}
.hint{color:#52525b;margin-top:.5rem}

/* Wikilinks */
.wikilink{color:#c084fc;font-weight:500}

/* Markdown */
.markdown{color:#d4d4d8}
.markdown h1{font-size:1.4rem;margin:1.5rem 0 .75rem;color:#fafafa}
.markdown h2{font-size:1.2rem;margin:1.5rem 0 .5rem;color:#fafafa;border-bottom:1px solid #27272a;padding-bottom:.25rem}
.markdown h3{font-size:1.05rem;margin:1.25rem 0 .5rem;color:#e4e4e7}
.markdown p{margin:.5rem 0}
.markdown ul,.markdown ol{margin:.5rem 0;padding-left:1.5rem}
.markdown li{margin:.25rem 0}
.markdown code{background:#27272a;padding:2px 5px;border-radius:3px;font-size:.88em;font-family:'SF Mono',Menlo,monospace;color:#e4e4e7}
.markdown pre{background:#27272a;border:1px solid #3f3f46;padding:1rem;border-radius:6px;overflow-x:auto;margin:.75rem 0}
.markdown pre code{background:none;padding:0;border:none}
.markdown table{border-collapse:collapse;margin:.75rem 0;width:100%}
.markdown th,.markdown td{border:1px solid #3f3f46;padding:.4rem .75rem;text-align:left}
.markdown th{background:#27272a;font-weight:600;color:#a1a1aa}
.markdown blockquote{border-left:3px solid #3f3f46;padding-left:1rem;color:#71717a;margin:.75rem 0}
.markdown a{color:#93c5fd}
.markdown hr{border:none;border-top:1px solid #27272a;margin:1.5rem 0}
.markdown strong{font-weight:600;color:#e4e4e7}
.markdown img{max-width:100%;border-radius:4px}

footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #27272a}
.meta{font-size:.75rem;color:#52525b}

@media(max-width:768px){
  .layout{flex-direction:column}
  .sidebar{width:100%;min-width:100%;border-right:none;border-bottom:1px solid #2e2e33}
  main{padding:1.5rem}
}
`;
