import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module before anything imports it (shared.ts → db.ts opens SQLite)
vi.mock("../db", () => ({
  listAgents: vi.fn().mockReturnValue([]),
  upsertAgent: vi.fn(),
  deleteAgentRecord: vi.fn(),
  findAgentByUserId: vi.fn(),
  getPoolSize: vi.fn().mockReturnValue(0),
}));

// Mock sprite module
vi.mock("../sprite", () => ({
  sprite: vi.fn(),
  runClaudeOnSprite: vi.fn().mockResolvedValue({ result: "NO_REPLY", sessionId: "", cost: 0.01 }),
}));

// Mock shared module
vi.mock("../shared", () => ({
  loadRegistry: vi.fn().mockResolvedValue({
    agents: {
      "advisor-pool-6": {
        spriteName: "advisor-pool-6",
        type: "advisor",
        status: "active",
      },
      "no-sprite-agent": {
        type: "advisor",
        status: "active",
      },
    },
  }),
}));

// Mock provision module (imported by agents.ts)
vi.mock("../provision", () => ({
  deleteAdvisor: vi.fn(),
  deleteDesk: vi.fn(),
}));

import { sendAgentMessage } from "../agents";
import { runClaudeOnSprite } from "../sprite";

function makeRequest(body: Record<string, any>): Request {
  return new Request("http://localhost/agents/advisor-pool-6/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("sendAgentMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runClaudeOnSprite).mockResolvedValue({ result: "NO_REPLY", sessionId: "", cost: 0.01 });
  });

  it("calls runClaudeOnSprite for structured trigger payloads", async () => {
    const payload = {
      type: "boat_scan",
      action: "generate_episode",
      episodeId: "ep_abc123",
      captainName: "Zach",
    };

    await sendAgentMessage("advisor-pool-6", makeRequest(payload));

    expect(runClaudeOnSprite).toHaveBeenCalledWith(
      "advisor-pool-6",
      expect.stringContaining('"type":"boat_scan"'),
    );
  });

  it("calls runClaudeOnSprite for plain text messages", async () => {
    await sendAgentMessage("advisor-pool-6", makeRequest({ message: "Run the briefing" }));

    expect(runClaudeOnSprite).toHaveBeenCalledWith(
      "advisor-pool-6",
      expect.stringContaining("Run the briefing"),
    );
  });

  it("includes CLAUDE.md preamble in prompt", async () => {
    await sendAgentMessage("advisor-pool-6", makeRequest({ message: "hello" }));

    expect(runClaudeOnSprite).toHaveBeenCalledWith(
      "advisor-pool-6",
      expect.stringContaining("Read your CLAUDE.md for context"),
    );
  });

  it("preserves all fields in JSON trigger payload", async () => {
    const payload = {
      type: "boat_scan",
      action: "generate_episode",
      episodeId: "ep_abc123",
      contentUrl: "https://example.com/content",
      audioUploadUrl: "https://example.com/audio",
    };

    await sendAgentMessage("advisor-pool-6", makeRequest(payload));

    const prompt = vi.mocked(runClaudeOnSprite).mock.calls[0][1];
    const jsonMatch = prompt.match(/```json\n([\s\S]*?)\n```/);
    expect(jsonMatch).toBeTruthy();
    const parsed = JSON.parse(jsonMatch![1]);
    expect(parsed.type).toBe("boat_scan");
    expect(parsed.action).toBe("generate_episode");
    expect(parsed.episodeId).toBe("ep_abc123");
    expect(parsed.contentUrl).toBe("https://example.com/content");
    expect(parsed.audioUploadUrl).toBe("https://example.com/audio");
  });

  it("returns immediately without waiting for runClaudeOnSprite", async () => {
    // Make runClaudeOnSprite never resolve
    vi.mocked(runClaudeOnSprite).mockReturnValue(new Promise(() => {}));

    const result = await sendAgentMessage("advisor-pool-6", makeRequest({ message: "slow task" }));

    expect(result).toEqual({
      success: true,
      agentId: "advisor-pool-6",
      spriteName: "advisor-pool-6",
      dispatched: true,
    });
  });

  it("throws for unknown agent", async () => {
    const req = new Request("http://localhost/agents/unknown/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });

    await expect(sendAgentMessage("unknown", req)).rejects.toThrow("Agent unknown not found");
  });

  it("throws when no message or type/action provided", async () => {
    await expect(
      sendAgentMessage("advisor-pool-6", makeRequest({ foo: "bar" })),
    ).rejects.toThrow("message is required");
  });

  it("falls back to agentId when no spriteName in registry", async () => {
    const req = new Request("http://localhost/agents/no-sprite-agent/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "test" }),
    });

    await sendAgentMessage("no-sprite-agent", req);

    expect(runClaudeOnSprite).toHaveBeenCalledWith(
      "no-sprite-agent",
      expect.any(String),
    );
  });
});
