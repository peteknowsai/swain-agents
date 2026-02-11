# swain-agents

OpenClaw agent definitions, skills, and templates for the Swain platform.

## Structure

```
agents/          # Agent definitions (CLAUDE.md, skills, commands)
  _shared/       # Commands and skills available to all agents
  advisor-*/     # Per-captain advisor agents
  beat-*/        # Beat reporter agents
  editor-*/      # Content editor agents
  stylist/       # Style assignment agent

skills/          # Shared skills (canonical source)
  skip-advisor/  # Daily briefing creation
  skip-library/  # Card library browsing
  skip-onboarding/ # Welcome briefing for new captains
  skip-card-create/ # Card creation for beat reporters
  skip-cli/      # Full CLI command reference

templates/       # Workspace templates for new advisor provisioning
  AGENTS.md
  TOOLS.md
  HEARTBEAT.md
  skills/

deploy/          # Deployment configs
  nodes.json     # Agent → runtime mapping (Sprites, cron-triggered)
  crons.json     # Cron schedules for agent triggers
```
