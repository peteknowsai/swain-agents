# Part 7: Migration + Cutover

## Goal

Move all captains from VPS/OpenClaw/WhatsApp to Fly/Claude Code/iMessage. Decommission the VPS.

## Per-User Migration

For each captain:

1. **Export from VPS:**
   - Copy `/root/workspaces/{agentId}/memory/` files
   - Export knowledge.db if exists
   - Note current cron schedules and timezone

2. **Provision on Fly:**
   - `POST /sprites` with captain data from Convex
   - Bootstrap renders CLAUDE.md with captain profile
   - Copy memory files to Sprite volume
   - Create cron set matching current schedules

3. **Verify:**
   - Send test message, confirm reply is in-character
   - Confirm crons are registered
   - Confirm memory is accessible (ask advisor about something it should know)

4. **Switch routing:**
   - Register captain's phone in Bridge registry
   - Captain starts texting the Swain iMessage number instead of WhatsApp
   - Captain gets a message: "Hey, I've moved to iMessage. Text me here from now on."

5. **Decommission VPS agent:**
   - Pause the OpenClaw agent (don't delete yet)
   - After 1 week with no issues, delete the workspace

## Migration Order

1. Pete (already done in Part 6)
2. Least active captains (low risk if something breaks)
3. Most active captains (highest value, most testing)
4. Desk agents (if applicable — may need their own template variant)

## Rollback Plan

If a captain's Sprite breaks badly:
- Re-enable their VPS agent
- Route them back to WhatsApp
- Fix the issue, re-migrate

Both systems share Convex, so there's no data divergence. The only thing that changes is which system is processing messages.

## VPS Decommission

Once all captains are on Fly for 1+ week with no issues:

1. Stop OpenClaw gateway (`systemctl stop openclaw`)
2. Stop swain-agent-api (`systemctl stop swain-agent-api`)
3. Take a final backup of `/root/workspaces/` (just in case)
4. Keep VPS running for 1 more week as cold backup
5. Terminate VPS

## Post-Migration Cleanup

- Remove `api/` directory from this repo
- Remove `deploy/gateway/` if it exists
- Remove `templates/AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md`
- Update CLAUDE.md to reflect new architecture
- Archive old skills/ (OpenClaw format) once sprite/skills/ is canonical
- Update GitHub Actions to remove VPS deploy workflow

## Acceptance Criteria

- [ ] All active captains migrated and confirmed working
- [ ] 1 week of stable operation for all captains on Fly
- [ ] No WhatsApp messages being processed (all routing moved)
- [ ] VPS terminated
- [ ] Repo cleaned up — no dead OpenClaw code

## Estimated Effort

Small per user, but stretched over time. Migration itself is mechanical. The real work is being available to fix issues as they surface for each captain.
