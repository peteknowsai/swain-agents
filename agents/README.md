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
- `editor-swain-daily` - Daily editor for Swain news
- `advisor-boat-peteknows` - Personalized boat advisor

## Agent System Prompts

Each agent directory contains a `CLAUDE.md` file that defines the agent's:
- Role and purpose
- Available tools and skills
- Behavior and guidelines

Agents are OpenClaw agents — each gets its own workspace with these files deployed.
