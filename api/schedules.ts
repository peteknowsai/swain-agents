export interface ScheduleEntry {
  id: string;
  skill: string;
  agentType: "advisor" | "desk";
  cron: string; // "minute hour * * *"
  timezone: "agent" | string; // "agent" = use agent's tz, or fixed like "UTC"
  stagger?: number; // minutes between agents (0 = all at once)
  description: string;
}

export const SCHEDULES: ScheduleEntry[] = [
  // --- Desks: UTC, all desks simultaneously ---
  {
    id: "desk-content-morning",
    skill: "content-desk",
    agentType: "desk",
    cron: "0 10 * * *",
    timezone: "UTC",
    description: "Morning content generation",
  },
  {
    id: "desk-content-afternoon",
    skill: "content-desk",
    agentType: "desk",
    cron: "0 16 * * *",
    timezone: "UTC",
    description: "Afternoon content generation",
  },
  {
    id: "desk-content-evening",
    skill: "content-desk",
    agentType: "desk",
    cron: "0 22 * * *",
    timezone: "UTC",
    description: "Evening content generation",
  },
  {
    id: "desk-flyer",
    skill: "flyer",
    agentType: "desk",
    cron: "0 8 * * *",
    timezone: "UTC",
    description: "Daily flyer generation",
  },

  {
    id: "desk-card-hygiene",
    skill: "card-hygiene",
    agentType: "desk",
    cron: "0 14 * * *",
    timezone: "UTC",
    description: "Fix cards missing images or styles",
  },

  // --- Advisors: agent-local timezone, staggered ---
  {
    id: "advisor-briefing",
    skill: "briefing",
    agentType: "advisor",
    cron: "0 6 * * *",
    timezone: "agent",
    stagger: 2,
    description: "Daily morning briefing",
  },
  {
    id: "advisor-dream",
    skill: "dream",
    agentType: "advisor",
    cron: "0 2 * * *",
    timezone: "agent",
    description: "Nightly memory consolidation",
  },
];
