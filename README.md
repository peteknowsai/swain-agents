# heyskip-agents

OpenClaw agent definitions, skills, and templates for the Hey Skip platform.

## Structure

```
agents/          # Agent definitions (CLAUDE.md, skills, commands)
  _shared/       # Commands available to all agents
  advisor-*/     # Per-captain advisor agents
  beat-*/        # Beat reporter agents
  editor-*/      # Content editor agents
  stylist/       # Style assignment agent

templates/       # Workspace templates for new advisor provisioning
  AGENTS.md
  TOOLS.md
  HEARTBEAT.md
  skills/

deploy/          # Deployment configs (nodes, crons)
```
