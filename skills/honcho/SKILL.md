---
name: honcho
description: Honcho v3 memory platform — SDK reference, API docs, and Swain integration guide. Use when working with Honcho peers, sessions, conclusions, representations, or the OpenClaw plugin.
metadata:
  {
    "openclaw": { "emoji": "🧠" },
  }
---

# Honcho v3 — Complete Reference

Honcho is the identity/memory layer for Swain. It stores what agents know about captains (peers), derives conclusions from conversations, builds representations, and provides context for personalization.

**Docs**: https://docs.honcho.dev/v3/documentation/reference/sdk
**API index**: https://docs.honcho.dev/llms.txt

---

## Swain Setup

| Setting | Value |
|---------|-------|
| Plugin | `@honcho-ai/openclaw-honcho` v1.0.3 |
| SDK | `@honcho-ai/sdk` v2.0.1 |
| Workspace | `swain` (env: `HONCHO_WORKSPACE_ID=swain`) |
| API Key | env: `HONCHO_API_KEY` (hch-v3-...) |
| Base URL | `https://api.honcho.dev` (production) |
| Config location | `~/.openclaw/openclaw.json` → `plugins.openclaw-honcho` |
| Plugin code | `~/.openclaw/extensions/openclaw-honcho/dist/index.js` |

**⚠️ Plugin patch**: The dist was manually patched for dynamic peer resolution. This is fragile — will be lost on update. Need to upstream or persist.

### How OpenClaw Uses Honcho

The `openclaw-honcho` plugin automatically:
1. Feeds conversation messages to Honcho (user + assistant messages → session)
2. Resolves the peer ID dynamically (phone number, username, etc.)
3. Injects Honcho context into the system prompt for each agent turn
4. Provides the `honcho_*` tools (profile, context, search, recall, analyze, session)

Agents don't need to call the SDK directly for basic memory — the plugin handles it. Use the SDK directly when you need fine-grained control (seeding conclusions, managing peer cards, querying representations with specific parameters, etc.).

---

## Core Concepts

### Peers
An entity that participates in conversations. In Swain: each captain is a peer, each advisor agent is a peer.

- **Peer ID**: String identifier (e.g., `"+14156239773"`, `"advisor-pete-usr_4f"`)
- **Lazy creation**: `honcho.peer(id)` doesn't make an API call until you use the peer
- **Peer Card**: Stable biographical facts (name, preferences, background) — auto-maintained by Honcho's "dreaming" agent, or manually set
- **Representation**: Honcho's synthesized model of what a peer knows — built from conclusions

### Sessions
A conversation between peers. In Swain: each agent-captain chat session maps to a Honcho session.

- **Session ID**: String identifier
- **Messages**: Content from any peer in the session
- **Context**: Summary + recent messages + optional peer representation, formatted for LLM consumption
- **Summaries**: Honcho auto-generates short/long summaries as conversations grow

### Conclusions
Facts derived from messages. The building blocks of representations.

- **Self-conclusions**: What Honcho knows about a peer (global)
- **Local conclusions**: What peer A knows about peer B (scoped)
- **Explicit conclusions**: Manually created (e.g., seeding from onboarding data)
- **Semantic search**: Query conclusions by meaning, not just keywords

### Representations
Synthesized text describing what a peer knows — built from conclusions, scoped by perspective.

- **Global**: Everything Honcho knows about a peer (omniscient view)
- **Local**: What peer A knows about peer B
- **Session-scoped**: Knowledge from a specific conversation only

### Theory of Mind
Peers can form models of what OTHER peers think. Controlled per-session:
- `observeOthers`: Can this peer form models of other peers? (default: false)
- `observeMe`: Can other peers form models of this peer? (default: true)

---

## TypeScript SDK Reference

### Installation

```bash
npm install @honcho-ai/sdk
```

### Client Initialization

```typescript
import { Honcho } from "@honcho-ai/sdk";

// Basic (uses env vars HONCHO_API_KEY, HONCHO_WORKSPACE_ID)
const honcho = new Honcho({});

// Full config
const honcho = new Honcho({
  workspaceId: "swain",
  apiKey: "hch-v3-...",
  environment: "production",  // "production" | "local" | "demo"
  baseURL: "https://api.honcho.dev",
  timeout: 30000,
  maxRetries: 3,
  defaultHeaders: { "X-Custom-Header": "value" },
  defaultQuery: { param: "value" },
});
```

**Environment variables** (auto-detected):
- `HONCHO_API_KEY` — API key
- `HONCHO_BASE_URL` — Base URL
- `HONCHO_WORKSPACE_ID` — Default workspace

### Honcho Client Methods

```typescript
// Peers
const peer = await honcho.peer(id);                    // Get or create peer (lazy)
const peers = await honcho.peers();                    // List all peers (Page<Peer>)

// Sessions
const session = await honcho.session(id);              // Get or create session (lazy)
const sessions = await honcho.sessions();              // List all sessions (Page<Session>)

// Search across workspace
const results = await honcho.search(query);            // Semantic search (Page<any>)

// Workspace metadata
const meta = await honcho.getMetadata();
await honcho.setMetadata({ key: "value" });

// List workspaces
const workspaces = await honcho.workspaces();
```

### Peer

```typescript
const alice = await honcho.peer("alice");
const assistant = await honcho.peer("assistant");

// With immediate config (makes API call)
const bob = await honcho.peer("bob", {
  config: { role: "user" },
  metadata: { location: "Marco Island" }
});

// Properties
alice.id;           // string
alice.workspaceId;  // string (TS may vary — check SDK version)
```

#### peer.chat() — Ask Honcho about a peer

```typescript
// Basic query (Honcho's LLM reasons over the peer's representation)
const response = await alice.chat("What does this user care about?");
// response.content → "The user is interested in..."

// Query about another peer (local representation)
const resp = await alice.chat("What does the user know about the assistant?", {
  target: "assistant"
});

// Scoped to a session
const resp = await alice.chat("What happened in this conversation?", {
  sessionId: "session-1"
});

// With reasoning level (minimal | low | medium | high | max)
const resp = await alice.chat("Summarize what matters most to me.", {
  reasoningLevel: "high"
});

// Streaming
const stream = await alice.chat("Tell me about this user", { stream: true });
```

**Chat API endpoint**: `POST /v3/workspaces/{workspace_id}/peers/{peer_id}/chat`

Request body (`DialecticOptions`):
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | string (required) | — | The question to ask |
| `session_id` | string? | null | Scope to session |
| `target` | string? | null | Get perspective on another peer |
| `stream` | boolean | false | Stream response |
| `reasoning_level` | enum | "low" | minimal, low, medium, high, max |

#### peer.context() — Get representation + peer card in one call

```typescript
// Own context
const ctx = await alice.context();
ctx.representation;  // string — synthesized representation
ctx.peerCard;        // string[] — stable biographical facts

// What alice knows about bob
const bobCtx = await alice.context({ target: "bob" });

// With semantic search to curate the representation
const ctx = await alice.context({
  target: "bob",
  searchQuery: "work preferences",
  searchTopK: 10,           // 1-100, number of search results
  searchMaxDistance: 0.8,    // 0.0-1.0, semantic distance threshold
  includeMostFrequent: true, // include most-referenced conclusions
  maxConclusions: 50,        // 1-100, cap on conclusions
});
```

**API endpoint**: `GET /v3/workspaces/{workspace_id}/peers/{peer_id}/context`

Response (`PeerContext`):
```json
{
  "peer_id": "string",
  "target_id": "string",
  "representation": "string | null",
  "peer_card": ["string"] | null
}
```

#### peer.representation() — Get working representation only

```typescript
const rep = await alice.representation({
  searchQuery: "preferences",
  searchTopK: 10,
});
// rep → string (the synthesized representation text)
```

#### peer.getCard() / peer.setCard() — Manage peer card

```typescript
// Get own card
const card = await alice.getCard();           // string[]

// Get card about another peer
const bobCard = await alice.getCard("bob");

// Set own card (overwrites)
await alice.setCard(["Likes TypeScript", "Lives in NYC"]);

// Set card about another peer
await alice.setCard(["Works at Acme", "Enjoys hiking"], "bob");
```

Peer cards are auto-maintained by Honcho's dreaming agent. Use `setCard()` to seed or override.

#### peer.conclusions — Access derived facts

```typescript
// Self-conclusions
const selfConclusions = alice.conclusions;
const list = await selfConclusions.list();
const results = await selfConclusions.query("food preferences");
await selfConclusions.delete("conclusion-id");

// Conclusions about another peer
const bobConclusions = alice.conclusionsOf("bob");
const bobList = await bobConclusions.list();
const bobSearch = await bobConclusions.query("work history");
```

#### Creating conclusions manually

```typescript
const bobConclusions = alice.conclusionsOf("bob");

// Single
const created = await bobConclusions.create([
  { content: "User prefers dark mode", sessionId: "session-1" }
]);

// Batch
const batch = await bobConclusions.create([
  { content: "User prefers dark mode", sessionId: "session-1" },
  { content: "User works late at night", sessionId: "session-1" },
  { content: "User enjoys programming", sessionId: "session-1" },
]);

// Returns Conclusion objects with .id, .content
for (const c of batch) {
  console.log(`${c.id}: ${c.content}`);
}
```

Manually created conclusions are marked "explicit" and treated identically to system-derived ones.

#### Other peer methods

```typescript
const sessions = await alice.sessions();        // Peer's sessions
const results = await alice.search("query");    // Search peer's messages
const meta = await alice.getMetadata();
await alice.setMetadata({ ...meta, location: "Paris" });
```

### Session

```typescript
const session = await honcho.session("conversation-1");

// With immediate config
const meeting = await honcho.session("meeting-1", {
  config: { type: "meeting" }
});

session.id;           // string
session.workspaceId;  // string
```

#### session.addMessages() — Add conversation messages

```typescript
await session.addMessages([
  alice.message("What's the weather like?"),
  assistant.message("Sunny and 75°F!"),
]);

// With metadata
await session.addMessages([
  alice.message("Let's discuss budget", {
    metadata: { topic: "finance", priority: "high" }
  }),
]);

// With custom timestamp (for importing historical data)
// Use created_at in the API directly
```

#### session.context() — Get conversation context for LLM

```typescript
// Basic context
const ctx = await session.context({ summary: true, tokens: 2000 });

// With peer representation included
const rich = await session.context({
  tokens: 2000,
  peerTarget: "user",
  peerPerspective: "assistant",
  searchQuery: "What are my preferences?",
  limitToSession: true,
  representationOptions: {
    searchTopK: 10,
    searchMaxDistance: 0.8,
    includeMostFrequent: true,
    maxConclusions: 25,
  },
});

// Convert to LLM format
const openaiMsgs = ctx.toOpenAI(assistant);
const anthropicMsgs = ctx.toAnthropic(assistant);
```

**API endpoint**: `GET /v3/workspaces/{workspace_id}/sessions/{session_id}/context`

Context parameters:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tokens` | int? | 100000 | Max tokens for context |
| `summary` | bool | true | Include summary if available |
| `peer_target` | string? | null | Peer to get representation for |
| `peer_perspective` | string? | null | Perspective peer (requires peer_target) |
| `search_query` | string? | null | Semantic search for conclusions |
| `limit_to_session` | bool | false | Limit representation to session only |
| `search_top_k` | int? | null | Number of search results (1-100) |
| `search_max_distance` | float? | null | Max semantic distance (0.0-1.0) |
| `include_most_frequent` | bool | false | Include most frequent conclusions |
| `max_conclusions` | int? | null | Max conclusions (1-100) |

Token allocation: 40% summary, 60% recent messages. If no summary requested, 100% to messages.

Response (`SessionContext`):
```json
{
  "id": "string",
  "messages": [
    {
      "id": "string",
      "content": "string",
      "peer_id": "string",
      "session_id": "string",
      "workspace_id": "string",
      "metadata": {},
      "created_at": "2024-01-15T10:30:00Z",
      "token_count": 42
    }
  ],
  "summary": {
    "content": "string",
    "message_id": 123,
    "summary_type": "short|long",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "peer_representation": "string (optional)",
  "peer_card": ["string"] // optional
}
```

#### session.representation() — Get peer representation in session context

```typescript
const globalRep = await session.representation("alice");
const targetedRep = await session.representation(alice, { target: bob });
const searched = await session.representation("alice", {
  searchQuery: "preferences",
  searchTopK: 10,
  includeMostFrequent: true,
});
```

#### Peer management in sessions

```typescript
// Add peers
await session.addPeers([alice, assistant]);
await session.addPeers("single-peer-id");

// Replace all peers
await session.setPeers([alice, bob, charlie]);

// Remove peers
await session.removePeers([alice]);
await session.removePeers("single-peer-id");

// Get session peers
const peers = await session.peers();
```

#### Theory of Mind configuration

```typescript
import { SessionPeerConfig } from "@honcho-ai/sdk";

// Configure observation settings per peer per session
await session.addPeers([
  alice,
  new SessionPeerConfig({
    observeOthers: false,  // Don't model other peers (default: false)
    observeMe: true,       // Let others model me (default: true)
  })
]);
```

#### Other session methods

```typescript
const messages = await session.messages();          // Get all messages
const results = await session.search("help");       // Search session
const cloned = await session.clone();               // Clone session
const partial = await session.clone("msg-123");     // Clone up to message
await session.delete();                             // Delete (async, returns 202)
await session.setMetadata({ topic: "planning" });
const meta = await session.getMetadata();

// Upload file to create messages
const msgs = await session.uploadFile(fileBuffer, "user", {
  metadata: { source: "upload" },
  createdAt: "2024-01-15T10:30:00Z",
});
```

### Pagination

```typescript
// Async iteration
for await (const peer of await honcho.peers()) {
  console.log(`Peer: ${peer.id}`);
}

// Manual pagination
let page = await honcho.peers();
while (page) {
  const data = await page.data();
  console.log(`Processing ${data.length} items`);
  page = await page.nextPage();
}
```

---

## REST API Reference

Base URL: `https://api.honcho.dev`
Auth: `Authorization: Bearer <HONCHO_API_KEY>`
All endpoints prefixed with `/v3/workspaces/{workspace_id}/`

### Peers

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/peers/{peer_id}` | Get or create peer |
| GET | `/peers` | List all peers |
| PATCH | `/peers/{peer_id}` | Update peer metadata/config |
| POST | `/peers/{peer_id}/chat` | Chat with peer's representation |
| GET | `/peers/{peer_id}/context` | Get representation + peer card |
| GET | `/peers/{peer_id}/representation` | Get working representation |
| GET | `/peers/{peer_id}/card` | Get peer card |
| PUT | `/peers/{peer_id}/card` | Set peer card |
| GET | `/peers/{peer_id}/sessions` | Get peer's sessions |
| GET | `/peers/{peer_id}/search` | Search peer's messages |

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/sessions/{session_id}` | Get or create session |
| GET | `/sessions` | List all sessions |
| PATCH | `/sessions/{session_id}` | Update session metadata/config |
| DELETE | `/sessions/{session_id}` | Delete session (async) |
| GET | `/sessions/{session_id}/context` | Get conversation context |
| GET | `/sessions/{session_id}/summaries` | Get session summaries |
| POST | `/sessions/{session_id}/clone` | Clone session |
| GET | `/sessions/{session_id}/search` | Search session |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions/{session_id}/messages` | Create messages |
| GET | `/sessions/{session_id}/messages` | List messages |
| GET | `/sessions/{session_id}/messages/{message_id}` | Get single message |
| PATCH | `/sessions/{session_id}/messages/{message_id}` | Update message metadata |
| POST | `/sessions/{session_id}/messages/upload` | Create from file |

### Session Peers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sessions/{session_id}/peers` | List session peers |
| POST | `/sessions/{session_id}/peers` | Add peers to session |
| PUT | `/sessions/{session_id}/peers` | Set (replace) session peers |
| DELETE | `/sessions/{session_id}/peers` | Remove peers from session |
| GET | `/sessions/{session_id}/peers/{peer_id}/config` | Get peer config in session |
| PUT | `/sessions/{session_id}/peers/{peer_id}/config` | Set peer config in session |

### Conclusions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/peers/{peer_id}/conclusions` | Create conclusions |
| GET | `/peers/{peer_id}/conclusions` | List conclusions |
| GET | `/peers/{peer_id}/conclusions/query` | Semantic search conclusions |
| DELETE | `/peers/{peer_id}/conclusions/{id}` | Delete conclusion |

Query parameters for listing: `target` (peer ID), `session_id`, `reverse` (bool)
Query parameters for search: `query`, `top_k` (1-100)

### Workspaces

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/workspaces/{workspace_id}` | Get or create workspace |
| GET | `/workspaces` | List all workspaces |
| DELETE | `/workspaces/{workspace_id}` | Delete workspace (permanent!) |
| GET | `/workspaces/{workspace_id}/queue` | Get processing queue status |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks` | Get or create webhook endpoint |
| GET | `/webhooks` | List webhook endpoints |
| DELETE | `/webhooks/{id}` | Delete webhook |
| POST | `/webhooks/test` | Test webhook |

---

## OpenClaw honcho_* Tools (Agent-Side)

These tools are available to all agents via the OpenClaw plugin. They wrap the SDK:

| Tool | Cost | What it does |
|------|------|--------------|
| `honcho_profile` | Free (DB query) | Get peer card — curated key facts |
| `honcho_context` | Free (DB query) | Get full representation — everything known across all sessions |
| `honcho_search` | Free (vector search) | Semantic search over stored observations |
| `honcho_session` | Free (DB query) | Get current session history + summary |
| `honcho_recall` | ~$0.001 (LLM) | Simple factual question → direct answer |
| `honcho_analyze` | ~$0.05 (LLM) | Complex synthesis question → analyzed answer |

**Cost hierarchy**: profile < context < search < session < recall < analyze

**When to use which**:
- Quick identity check → `honcho_profile`
- "What do you know about me?" → `honcho_context`
- Find specific past context → `honcho_search`
- "What did we just discuss?" → `honcho_session`
- "What's my name?" → `honcho_recall`
- "Describe my communication style" → `honcho_analyze`

---

## Swain-Specific Patterns

### Advisor Onboarding — Seeding Honcho

When provisioning a new advisor, seed Honcho with onboarding data so the advisor has context from day 1:

```typescript
const honcho = new Honcho({ workspaceId: "swain" });
const captain = await honcho.peer("+14156239773");  // E.164 phone
const advisor = await honcho.peer("advisor-pete-usr_4f");

// Seed the advisor's knowledge of the captain
await advisor.setCard([
  "Name: Pete",
  "Boat: Free Dummy (Boston Whaler)",
  "Marina: Marco Island",
  "Experience: Beginner",
  "Interests: Cruising with kids, water sports, diving",
], "+14156239773");

// Or create explicit conclusions
const conclusions = advisor.conclusionsOf("+14156239773");
await conclusions.create([
  { content: "Captain Pete is a beginner boater at Marco Island", sessionId: "onboarding" },
  { content: "Pete boats with his kids and enjoys cruising", sessionId: "onboarding" },
]);
```

### Querying Captain Context for Briefings

```typescript
// Get what the advisor knows about the captain
const ctx = await advisor.context({ target: "+14156239773" });
console.log(ctx.representation);  // Synthesized knowledge
console.log(ctx.peerCard);        // Key facts

// Semantic search for specific topics
const ctx = await advisor.context({
  target: "+14156239773",
  searchQuery: "fishing preferences",
  searchTopK: 5,
  searchMaxDistance: 0.5,
});
```

### Processing Queue

After adding messages, Honcho processes them asynchronously (the "dreaming" agent derives conclusions). Check queue status:

```typescript
// Via API
// GET /v3/workspaces/swain/queue?observer_id=advisor-pete-usr_4f
```

---

## Best Practices

1. **Use descriptive peer IDs**: `"+14156239773"` not `"user123"` — phone numbers are natural unique IDs for captains
2. **Use descriptive session IDs**: `"advisor-pete-usr_4f:2026-02-16"` not `"session-1"`
3. **Batch messages**: `addMessages([...])` not multiple single calls
4. **Limit context tokens**: `session.context({ tokens: 2000 })` — don't pull 100k tokens when 2k suffices
5. **Seed early**: Use `setCard()` or `conclusions.create()` during onboarding so the first interaction has context
6. **Don't duplicate the plugin**: If the OpenClaw plugin is active, it handles message ingestion. Don't double-send messages.
7. **Peer creation is lazy**: `honcho.peer(id)` is free until you call a method on it
8. **Null vs undefined in cards**: `setCard()` overwrites entirely — include all facts, not just new ones
