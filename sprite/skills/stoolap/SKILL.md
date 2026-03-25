---
name: stoolap
description: "Stoolap — local embedded SQL database with vector search. Use whenever you need to create tables, query structured data, store embeddings, or search your knowledge base. If you're about to write SQL or work with structured local data, use Stoolap."
user-invocable: false
---

# Stoolap CLI

High-performance embedded SQL database on your local filesystem. Use it for structured data that benefits from queries — maintenance logs, trip records, fuel stops, embeddings for semantic search.

Your database lives at `/home/sprite/stoolap/`. Create databases as needed.

## Quick Reference

```bash
# Interactive mode
stoolap -d file:///home/sprite/stoolap/knowledge.db

# One-shot query (pipe SQL)
echo "SELECT * FROM my_table LIMIT 5;" | stoolap -d file:///home/sprite/stoolap/knowledge.db -j -q

# JSON output (always use for parsing)
echo "SQL;" | stoolap -d <path> -j -q
```

## Creating Tables

Don't pre-plan schema. Create tables when patterns emerge from your memory files.

```sql
-- Maintenance events keep coming up → table time
CREATE TABLE maintenance (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  cost REAL,
  provider TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Trip log emerging from daily notes
CREATE TABLE trips (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  destination TEXT,
  crew_count INTEGER,
  conditions TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Vector Search

Store Gemini embeddings alongside your data for semantic search.

```sql
-- Table with embedding column
CREATE TABLE knowledge (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT,
  source TEXT,
  embedding VECTOR(768),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Insert with embedding
INSERT INTO knowledge (content, category, embedding)
VALUES ('Captain replaces zincs every 6 months', 'preference', '[0.1, 0.2, ...]');

-- Semantic search (nearest neighbors)
SELECT content, category, vector_distance(embedding, '[query vector]') AS distance
FROM knowledge
ORDER BY distance
LIMIT 5;
```

Get embeddings from Gemini — see the knowledge skill for the API calls.

## Common Patterns

### Store a fact with embedding
```bash
# 1. Get embedding
EMBED=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"models/text-embedding-004","content":{"parts":[{"text":"Oil change at 480 hours"}]}}' \
  | jq -c '.embedding.values')

# 2. Store
echo "INSERT INTO knowledge (content, category, embedding) VALUES ('Oil change at 480 hours', 'maintenance', '$EMBED');" \
  | stoolap -d file:///home/sprite/stoolap/knowledge.db -j -q
```

### Query structured data
```bash
echo "SELECT date, description FROM maintenance WHERE category = 'engine' ORDER BY date DESC LIMIT 5;" \
  | stoolap -d file:///home/sprite/stoolap/knowledge.db -j -q
```

### Check what tables exist
```bash
echo "SHOW TABLES;" | stoolap -d file:///home/sprite/stoolap/knowledge.db -j -q
```

## Database Profiles

```bash
stoolap -d file:///path --profile fast       # performance, less durable
stoolap -d file:///path --profile normal     # balanced (default)
stoolap -d file:///path --profile durable    # maximum durability
```

For advisor data, `normal` is fine. Data also lives in memory files — the DB is queryable structure, not the only copy.

## When to Use Stoolap vs Memory Files

| Signal | Use |
|--------|-----|
| Free-form observation about captain | Memory file |
| Third time tracking the same type of thing | Stoolap table |
| Need to compute (sum costs, count trips) | Stoolap |
| Need semantic search ("anything about hull?") | Stoolap + embedding |
| Context for next conversation | Memory file |
| Answering "how many times did X happen?" | Stoolap |
