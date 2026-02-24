# Security Hardening: Per-User Scope Enforcement

## Context

Every advisor agent shares a single `SWAIN_API_TOKEN` and runs on the same VPS filesystem. An agent (or a prompt-injected captain) can access any user's data via `swain user get <anyUserId>` or read other workspaces at `/root/workspaces/`. Security today is "the agent doesn't know other userIds" — prompt-level, not real.

This spec adds CLI-level scope enforcement as the first line of defense. Each agent gets a scope file locking it to its own captain's userId. The swain CLI validates every user-scoped operation against this scope before making the API call.

---

## Phase 1: Scope Module (`cli/lib/scope.ts`) — NEW FILE

Create `cli/lib/scope.ts` with:

- **`loadScope()`** — Walk up from `cwd` looking for `.swain-scope.json`. Return parsed scope or `null` (no file = admin mode, backward compat for manual CLI use).
- **`validateUserAccess(userId)`** — Load scope, throw `SCOPE_VIOLATION` if userId doesn't match. Passes for `system`/`admin` roles.
- **`assertCanListUsers()`** — Throw for `advisor` role (blocks `swain user list`).
- **`resolveUserId(explicit)`** — If no userId passed, auto-inject from scope. Validates either way.

Scope file schema:
```json
{
  "version": 1,
  "agentId": "advisor-pool-03",
  "userId": "usr_a4edc2ce-a8a",
  "role": "advisor"
}
```

Roles: `advisor` (single-user), `system` (no user restriction — stylist, desks), `admin` (no restriction — manual use). Missing scope file = admin.

## Phase 2: Add Scope Checks to Commands

Every command that resolves a `--user` / `--user-id` parameter calls `validateUserAccess(userId)` after parsing. Pattern:

```typescript
import { validateUserAccess } from '../lib/scope';
// after resolving userId from args:
validateUserAccess(userId);
```

**Commands to enforce** (all in `cli/commands/`):

| File | Functions | Pattern |
|------|-----------|---------|
| `user.ts` | `getUser`, `updateUser`, `onboardStatus`, `uploadBoatImage` | positional arg or `--id` |
| `user.ts` | `listUsers` | `assertCanListUsers()` — block entirely for advisors |
| `boat.ts` | `listBoats`, `createBoat`, `boatProfile` | `--user` |
| `briefing.ts` | `listBriefings`, `createBriefing`, `previousBriefing`, `assembleBriefing`, `briefingHistory`, `validateBriefing` | `--user` / `--user-id` |
| `card.ts` | `pullCards`, `createCard`, `boatArtCard` | `--user` / `--user-id` |
| `boat-art.ts` | `createBoatArt`, `listBoatArt` | `--user` |
| `memory.ts` | `listMemories`, `addMemory` | `--user` / `--user-id` |

**Commands that DON'T need scoping** (system resources, no user data): `agent.ts`, `advisor.ts`, `desk.ts`, `style.ts`, `image.ts`, `onboarding.ts`.

For `briefing list` specifically: it fetches the dashboard endpoint (all users). When scope is `advisor`, auto-filter results to only the scoped userId client-side.

## Phase 3: Write Scope Files During Provisioning

In `api/provision.ts`:

- **`provisionAdvisor()`** (after line ~246): Write `.swain-scope.json` with `role: "advisor"` and the captain's userId.
- **`provisionPool()`** (after line ~172): Write `.swain-scope.json` with `role: "advisor"` and `userId: null` (unassigned — CLI will refuse user operations until assigned).
- **`provisionStylist()`**: Write with `role: "system"`.
- **`provisionContentDesk()`**: Write with `role: "system"`.

## Phase 4: Send Agent Identity Header

In `cli/lib/worker-client.ts` `workerRequest()` (~line 117): Load scope and add `X-Swain-Agent-Id` and `X-Swain-Agent-Role` headers to every request. This sets up the Convex-side validation that comes later (separate repo).

## Phase 5: Tests

New file `cli/tests/scope.test.ts`:

1. `loadScope()` returns null when no file exists
2. `loadScope()` finds file by walking up directories
3. `validateUserAccess()` passes matching userId
4. `validateUserAccess()` throws on mismatched userId
5. `validateUserAccess()` passes for system/admin roles
6. `assertCanListUsers()` throws for advisor role
7. `resolveUserId()` auto-injects from scope

## Phase 6: Backfill Existing Agents

Add a `POST /pool/backfill-scopes` endpoint to the provisioning API that reads pool state + registry and writes `.swain-scope.json` into every existing workspace. Run once after deploy.

## Phase 7: Build & Deploy

1. `cd cli && bun run build` — recompile CLI binary
2. Deploy CLI to VPS: copy binary, `git pull` for API changes
3. Run backfill endpoint
4. Verify: SSH in, `cd /root/workspaces/advisor-pool-03 && swain user get <wrong-userId>` should fail with SCOPE_VIOLATION

---

## Files to Modify

- `cli/lib/scope.ts` — **NEW** — scope loading + validation
- `cli/lib/worker-client.ts` — add agent identity headers
- `cli/commands/user.ts` — add scope checks
- `cli/commands/boat.ts` — add scope checks
- `cli/commands/briefing.ts` — add scope checks + auto-filter list
- `cli/commands/card.ts` — add scope checks
- `cli/commands/boat-art.ts` — add scope checks
- `cli/commands/memory.ts` — add scope checks
- `cli/tests/scope.test.ts` — **NEW** — unit tests
- `api/provision.ts` — write scope files during provisioning, add backfill endpoint
- `api/index.ts` — register backfill route

## Future Work

- **Convex-side validation**: Use the `X-Swain-Agent-Id` header to enforce server-side. Requires changes to the Convex backend repo.
- **OpenClaw tool restrictions**: Disable bash/shell for advisors in gateway config so they can't `curl` around the CLI. Requires testing OpenClaw's `tools.deny` config.
- **Per-agent API tokens**: Replace shared `SWAIN_API_TOKEN` with per-agent tokens. Most secure option but adds token lifecycle management.
