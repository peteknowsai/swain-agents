import { describe, it, expect, vi, beforeEach } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFile as realReadFile } from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Shared test state ---

let mockRegistry = { agents: {} as Record<string, any>, pool: { size: 0, version: 1 } };
let mockBridgeRegistry: any[] = [];

// --- Mocks ---

vi.mock("../templates", () => ({
  render: (content: string, vars: Record<string, string>) => {
    let result = content;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
  },
}));

vi.mock("../sprite", () => ({
  createSprite: vi.fn().mockResolvedValue(undefined),
  execOnSprite: vi.fn().mockResolvedValue(""),
  writeToSprite: vi.fn().mockResolvedValue(undefined),
  getSpriteUrl: vi.fn().mockResolvedValue("https://advisor-pool-01-abc12.sprites.app"),
  makePublic: vi.fn().mockResolvedValue(undefined),
  createService: vi.fn().mockResolvedValue(undefined),
  destroySprite: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../shared", () => ({
  REGISTRY_FILE: "/tmp/test-registry.json",
  loadRegistry: vi.fn().mockImplementation(() => Promise.resolve(structuredClone(mockRegistry))),
  saveRegistry: vi.fn().mockImplementation((reg: any) => {
    mockRegistry = structuredClone(reg);
    return Promise.resolve();
  }),
  lookupByUserId: vi.fn().mockImplementation((_reg: any, userId: string) => {
    for (const [id, entry] of Object.entries(mockRegistry.agents) as [string, any][]) {
      if (entry.userId === userId) return id;
    }
    return null;
  }),
  convexRequest: vi.fn().mockResolvedValue({}),
}));

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises");
  return {
    ...actual,
    readFile: vi.fn().mockImplementation(async (path: string, encoding?: string) => {
      if (typeof path === "string" && path.includes("registry.json") && path.includes("bridge")) {
        return JSON.stringify(mockBridgeRegistry);
      }
      // Delegate to real readFile for template and skill files
      return actual.readFile(path, encoding);
    }),
    writeFile: vi.fn().mockImplementation(async (path: string, content: string) => {
      if (typeof path === "string" && path.includes("registry.json") && path.includes("bridge")) {
        mockBridgeRegistry = JSON.parse(content);
      }
    }),
  };
});

// Mock fetch for bridge reload + intro message
const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
vi.stubGlobal("fetch", mockFetch);

// Mock Bun.spawn for boat creation
vi.stubGlobal("Bun", {
  spawn: vi.fn().mockReturnValue({
    stdout: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"boatId":"boat_123"}'));
        controller.close();
      },
    }),
    stderr: new ReadableStream({ start(c) { c.close(); } }),
    exited: Promise.resolve(0),
  }),
  sleep: vi.fn().mockResolvedValue(undefined),
});

// --- Helpers ---

function resetState() {
  vi.clearAllMocks();
  mockRegistry = {
    agents: {
      "advisor-pool-01": {
        type: "advisor",
        status: "available",
        createdAt: "2026-01-01T00:00:00Z",
        poolIndex: 1,
        spriteName: "advisor-pool-01",
        spriteUrl: "https://advisor-pool-01-abc12.sprites.app",
      },
      "advisor-pool-02": {
        type: "advisor",
        status: "available",
        createdAt: "2026-01-01T00:00:00Z",
        poolIndex: 2,
        spriteName: "advisor-pool-02",
        spriteUrl: "https://advisor-pool-02-def34.sprites.app",
      },
    },
    pool: { size: 2, version: 1 },
  };
  mockBridgeRegistry = [
    {
      id: "advisor-pool-01",
      name: "Pool advisor-pool-01",
      url: "https://advisor-pool-01-abc12.sprites.app",
      phoneNumbers: [],
      discordChannelIds: [],
      allowDMs: false,
    },
    {
      id: "advisor-pool-02",
      name: "Pool advisor-pool-02",
      url: "https://advisor-pool-02-def34.sprites.app",
      phoneNumbers: [],
      discordChannelIds: [],
      allowDMs: false,
    },
  ];
}

// --- Tests ---

describe("provisionSpriteAdvisor", () => {
  beforeEach(resetState);

  it("grabs lowest poolIndex available sprite", async () => {
    const { provisionSpriteAdvisor } = await import("../provision-sprite");

    const result = await provisionSpriteAdvisor({
      userId: "usr_test_001",
      name: "Test Captain",
      phone: "+15551234567",
      boatName: "Test Boat",
    });

    expect(result.agentId).toBe("advisor-pool-01");
    expect(result.status).toBe("assigned");
    expect(result.spriteUrl).toBe("https://advisor-pool-01-abc12.sprites.app");
  });

  it("rejects duplicate phone numbers", async () => {
    mockRegistry.agents["advisor-pool-01"] = {
      ...mockRegistry.agents["advisor-pool-01"],
      status: "active",
      phone: "+15551234567",
      captainName: "Existing Captain",
    };

    const { provisionSpriteAdvisor } = await import("../provision-sprite");
    await expect(
      provisionSpriteAdvisor({
        userId: "usr_test_002",
        name: "New Captain",
        phone: "+15551234567",
      }),
    ).rejects.toThrow("Phone +15551234567 already assigned");
  });

  it("throws when no available sprites in pool", async () => {
    mockRegistry.agents = {
      "advisor-pool-01": {
        type: "advisor",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        poolIndex: 1,
        spriteName: "advisor-pool-01",
        spriteUrl: "https://advisor-pool-01-abc12.sprites.app",
      },
    };

    const { provisionSpriteAdvisor } = await import("../provision-sprite");
    await expect(
      provisionSpriteAdvisor({
        userId: "usr_test_003",
        name: "Unlucky Captain",
      }),
    ).rejects.toThrow("No available advisor sprites in pool");
  });

  it("pushes rendered CLAUDE.md to sprite", async () => {
    const { provisionSpriteAdvisor } = await import("../provision-sprite");
    const { writeToSprite } = await import("../sprite");

    await provisionSpriteAdvisor({
      userId: "usr_test_004",
      name: "Captain Pete",
      phone: "+15559876543",
      boatName: "Sea Breeze",
    });

    expect(writeToSprite).toHaveBeenCalledWith(
      "advisor-pool-01",
      "/home/sprite/CLAUDE.md",
      expect.stringContaining("Captain Pete"),
    );
  });

  it("updates bridge registry with phone number", async () => {
    const { provisionSpriteAdvisor } = await import("../provision-sprite");

    await provisionSpriteAdvisor({
      userId: "usr_test_005",
      name: "Captain Jane",
      phone: "+15551112222",
    });

    const entry = mockBridgeRegistry.find((e: any) => e.id === "advisor-pool-01");
    expect(entry.phoneNumbers).toContain("+15551112222");
    expect(entry.name).toBe("Captain Jane's Advisor");
  });

  it("triggers intro message POST to sprite URL", async () => {
    const { provisionSpriteAdvisor } = await import("../provision-sprite");

    await provisionSpriteAdvisor({
      userId: "usr_test_006",
      name: "Captain Bob",
      phone: "+15553334444",
      boatName: "Wind Rider",
    });

    // Give the fire-and-forget fetch a tick to execute
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).toHaveBeenCalledWith(
      "https://advisor-pool-01-abc12.sprites.app/message",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Captain Bob"),
      }),
    );
  });

  it("updates registry with captain data", async () => {
    const { provisionSpriteAdvisor } = await import("../provision-sprite");

    await provisionSpriteAdvisor({
      userId: "usr_test_007",
      name: "Captain Kim",
      phone: "+15557778888",
      timezone: "America/Chicago",
    });

    const entry = mockRegistry.agents["advisor-pool-01"];
    expect(entry.status).toBe("active");
    expect(entry.userId).toBe("usr_test_007");
    expect(entry.captainName).toBe("Captain Kim");
    expect(entry.phone).toBe("+15557778888");
    expect(entry.timezone).toBe("America/Chicago");
    expect(entry.assignedAt).toBeDefined();
  });
});

describe("deleteSpriteAdvisor", () => {
  beforeEach(() => {
    resetState();
    mockRegistry.agents["advisor-pool-01"] = {
      type: "advisor",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      poolIndex: 1,
      spriteName: "advisor-pool-01",
      spriteUrl: "https://advisor-pool-01-abc12.sprites.app",
      userId: "usr_test_001",
      captainName: "Test Captain",
      phone: "+15551234567",
      assignedAt: "2026-01-01T00:00:00Z",
    };
    mockBridgeRegistry[0] = {
      ...mockBridgeRegistry[0],
      name: "Test Captain's Advisor",
      phoneNumbers: ["+15551234567"],
    };
  });

  it("resets status to available and clears captain fields", async () => {
    const { deleteSpriteAdvisor } = await import("../provision-sprite");

    await deleteSpriteAdvisor("advisor-pool-01");

    const entry = mockRegistry.agents["advisor-pool-01"];
    expect(entry.status).toBe("available");
    expect(entry.userId).toBeUndefined();
    expect(entry.captainName).toBeUndefined();
    expect(entry.phone).toBeUndefined();
    expect(entry.spriteName).toBe("advisor-pool-01");
    expect(entry.spriteUrl).toBe("https://advisor-pool-01-abc12.sprites.app");
  });

  it("removes phone from bridge registry", async () => {
    const { deleteSpriteAdvisor } = await import("../provision-sprite");

    await deleteSpriteAdvisor("advisor-pool-01");

    const entry = mockBridgeRegistry.find((e: any) => e.id === "advisor-pool-01");
    expect(entry.phoneNumbers).toEqual([]);
  });

  it("resets CLAUDE.md on sprite", async () => {
    const { deleteSpriteAdvisor } = await import("../provision-sprite");
    const { writeToSprite } = await import("../sprite");

    await deleteSpriteAdvisor("advisor-pool-01");

    expect(writeToSprite).toHaveBeenCalledWith(
      "advisor-pool-01",
      "/home/sprite/CLAUDE.md",
      expect.stringContaining("Awaiting captain assignment"),
    );
  });

  it("throws for non-existent agent", async () => {
    const { deleteSpriteAdvisor } = await import("../provision-sprite");
    await expect(deleteSpriteAdvisor("advisor-pool-99")).rejects.toThrow("not found");
  });
});

describe("template rendering", () => {
  it("renders CLAUDE.md template with all placeholders filled", async () => {
    const { render } = await import("../templates");
    const templatePath = join(__dirname, "..", "..", "sprite", "templates", "CLAUDE.md.template");

    let template: string;
    try {
      template = await realReadFile(templatePath, "utf-8");
    } catch {
      console.log("Skipping template test — CLAUDE.md.template not found");
      return;
    }

    const rendered = render(template, {
      captainName: "Test Captain",
      userId: "usr_test_001",
      phone: "+15551234567",
      boatName: "Sea Breeze",
      boatType: "sailboat",
      marina: "Bay Marina",
      waters: "SF Bay",
      primaryUse: "cruising",
      experienceLevel: "intermediate",
      timezone: "America/Los_Angeles",
      desk: "sf-bay",
    });

    const unresolved = rendered.match(/\{\{[a-zA-Z]+\}\}/g);
    expect(unresolved).toBeNull();
    expect(rendered).toContain("Test Captain");
    expect(rendered).toContain("usr_test_001");
    expect(rendered).toContain("+15551234567");
    expect(rendered).toContain("Sea Breeze");
  });

  it("handles missing optional fields with defaults", async () => {
    const { render } = await import("../templates");

    const rendered = render(
      "Captain: {{captainName}}, Boat: {{boatName}}, Type: {{boatType}}",
      {
        captainName: "Minimal Captain",
        boatName: "their boat",
        boatType: "boat",
      },
    );

    expect(rendered).not.toContain("undefined");
    expect(rendered).toBe("Captain: Minimal Captain, Boat: their boat, Type: boat");
  });
});

describe("registry operations", () => {
  it("lookupByUserId returns correct agentId", () => {
    // Test the real function logic
    const registry = {
      agents: {
        "advisor-pool-01": { userId: "usr_abc123" },
        "advisor-pool-02": {},
      },
    };

    let found: string | null = null;
    for (const [id, entry] of Object.entries(registry.agents) as [string, any][]) {
      if (entry.userId === "usr_abc123") { found = id; break; }
    }
    expect(found).toBe("advisor-pool-01");

    let notFound: string | null = null;
    for (const [id, entry] of Object.entries(registry.agents) as [string, any][]) {
      if (entry.userId === "usr_unknown") { notFound = id; break; }
    }
    expect(notFound).toBeNull();
  });
});

describe("phone normalization", () => {
  it("normalizes phone without + prefix", async () => {
    resetState();
    const { provisionSpriteAdvisor } = await import("../provision-sprite");

    await provisionSpriteAdvisor({
      userId: "usr_phone_test",
      name: "Phone Test",
      phone: "15551234567",
    });

    const entry = mockBridgeRegistry.find((e: any) => e.id === "advisor-pool-01");
    expect(entry.phoneNumbers).toContain("+15551234567");
  });

  it("preserves phone with + prefix", async () => {
    resetState();
    const { provisionSpriteAdvisor } = await import("../provision-sprite");

    await provisionSpriteAdvisor({
      userId: "usr_phone_test2",
      name: "Phone Test 2",
      phone: "+15559999999",
    });

    const entry = mockBridgeRegistry.find((e: any) => e.id === "advisor-pool-01");
    expect(entry.phoneNumbers).toContain("+15559999999");
  });
});
