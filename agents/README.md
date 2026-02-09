# Agents - Project-Specific Business Logic

This directory contains **your project-specific agents** - the business logic you create for your application.

## What Goes Here

Create subdirectories for each agent you build, following this pattern:

```
agents/
├── beat-reporter-weather/
│   └── CLAUDE.md          # Agent system prompt
├── boat-advisor-123/
│   └── CLAUDE.md          # Agent system prompt
└── editor-daily/
    └── CLAUDE.md          # Agent system prompt
```

## Agent Naming Convention

Follow the pattern: `{type}-{name}-{qualifier}`

**Types:**
- `beat-*` - Beat reporters (data gathering agents)
- `editor-*` - Editors (synthesis agents)
- `advisor-*` - Advisor agents (personalized recommendations)
- `test-*` - Test agents

**Examples:**
- `beat-weather-swfl` - Weather reporter for Southwest Florida
- `beat-fishing-fl` - Fishing conditions reporter for Florida
- `editor-captain32-daily` - Daily editor for Captain32 news
- `advisor-boat-peteknows` - Personalized boat advisor

## How Agents Are Created

Agents are created by:

1. **Add agent to D1 database:**
   ```sql
   INSERT INTO agents (agent_id, name, model, description)
   VALUES ('beat-weather-swfl', 'Weather Reporter', 'claude-sonnet-4-5-20250929', 'Southwest Florida weather reporter');
   ```

2. **Create agent directory and system prompt:**
   ```bash
   mkdir -p agents/beat-weather-swfl
   echo "# Weather Reporter Agent..." > agents/beat-weather-swfl/CLAUDE.md
   ```

3. **Upload system prompt to D1:**
   ```bash
   # Use the bootstrap-prompts.sh script or API endpoint
   curl -X POST https://your-worker.workers.dev/api/prompts \\
     -d '{"agentId":"beat-weather-swfl","content":"..."}'
   ```

## Agent System Prompts

Each agent directory contains a `CLAUDE.md` file that defines the agent's:
- Role and purpose
- Available tools (MCP servers)
- Behavior and guidelines
- Example interactions

This file is loaded from D1 when the agent container starts.

## Example Project Structure

```
my-project/
├── agents/                 # Your application agents
│   ├── beat-weather-swfl/
│   ├── beat-fishing-fl/
│   ├── beat-dining-tampa/
│   ├── editor-captain32-daily/
│   └── advisor-boat-123/
├── src/                    # Worker code
├── container/              # Container runtime
└── wrangler.toml          # Deployment configuration
```

## Getting Started

When you first clone this project, this directory contains example agents. To create your own:

1. Deploy the framework: `wrangler deploy`
2. Create agent directory: `mkdir agents/my-first-agent`
3. Add system prompt: Create `agents/my-first-agent/CLAUDE.md`
4. Register in D1 and upload prompt via API or script

See `scripts/bootstrap-prompts.sh` for reference on uploading prompts to D1.
