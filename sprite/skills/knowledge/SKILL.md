---
name: knowledge
description: "Local knowledge database — store, embed, and query what you know using Stoolap + Gemini multimodal embeddings. Use when you learn something worth remembering, when answering captain questions, before briefings, or during the dream cycle when patterns need structure."
user-invocable: false
---

# Knowledge Base

Your knowledge DB is a local Stoolap database with Gemini multimodal embeddings. You can store text, images, and any structured data — then search it semantically.

The DB lives on your filesystem. Only you can access it.

## Embeddings — Gemini embedding-002

Use Gemini's multimodal embedding model for vector search. It embeds text AND images into the same vector space — a photo of a cracked hull and a text note about hull damage will match each other.

### Embed text
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"models/text-embedding-004","content":{"parts":[{"text":"Captain replaces zincs every 6 months"}]}}'
```

### Embed an image
```bash
# Base64 encode the image, then embed
IMG_B64=$(base64 -w0 /path/to/hull-photo.jpg)
curl -s "https://generativelanguage.googleapis.com/v1beta/models/multimodalembedding@001:embedContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"models/multimodalembedding@001\",\"content\":{\"parts\":[{\"inline_data\":{\"mime_type\":\"image/jpeg\",\"data\":\"$IMG_B64\"}}]}}"
```

## Stoolap — Local Database

Stoolap is your local SQL database. Create tables as you need them — don't pre-plan schema. Let structure emerge from what you actually track.

### Create a table when patterns emerge
```sql
-- First maintenance mention → memory file is fine
-- Third maintenance mention → create a table
CREATE TABLE maintenance_log (
  id INTEGER PRIMARY KEY,
  date TEXT,
  description TEXT,
  category TEXT,
  cost REAL,
  provider TEXT,
  embedding BLOB,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Store with embedding
```bash
# 1. Get embedding from Gemini
EMBEDDING=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"models/text-embedding-004","content":{"parts":[{"text":"Oil change at 480 hours, used 15W-40"}]}}' \
  | jq -r '.embedding.values')

# 2. Insert into Stoolap
stoolap query --db=/home/sprite/stoolap/knowledge.db \
  "INSERT INTO maintenance_log (date, description, category, embedding) VALUES ('2026-03-24', 'Oil change at 480 hours, used 15W-40', 'engine', '$EMBEDDING')"
```

### Semantic search
```bash
# Embed the query, then find nearest vectors
QUERY_EMBED=$(curl -s "..." | jq -r '.embedding.values')
stoolap query --db=/home/sprite/stoolap/knowledge.db \
  "SELECT description, category FROM maintenance_log ORDER BY vector_distance(embedding, '$QUERY_EMBED') LIMIT 5"
```

## When to Use What

| Need | Tool | Why |
|------|------|-----|
| Remember a conversation detail | Memory file | Narrative, context-rich, for session orientation |
| Track a repeating pattern | Stoolap table | Structured, queryable, computable |
| Search "do I know anything about X?" | Embedded query | Semantic, finds related knowledge across text + images |
| Store a photo observation | Embed + store | Multimodal — photo becomes searchable by text queries |

## Emergent Schema

Don't create tables upfront. During the dream cycle, notice patterns:

- **Repeated type of information?** → Table
- **Accumulated free-text knowledge?** → Embed for search
- **Photos with observations?** → Multimodal embed
- **Single fact?** → Memory file is enough

The dream skill (Phase 6) handles this. Most dreams won't create tables. Some will.

## Legacy: swain knowledge CLI

The `swain knowledge` CLI still works for embedding via the Convex backend. Use it when you don't need local-only storage:

```bash
swain knowledge store --content="..." --category=captain_preference --json
swain knowledge ask "question" --json
```

For local-first, use Stoolap + Gemini directly.
