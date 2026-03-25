import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Bun.spawn before importing
const mockSpawn = vi.fn();
vi.stubGlobal("Bun", {
  spawn: mockSpawn,
  sleep: vi.fn().mockResolvedValue(undefined),
});

// Helper to create a mock process
function mockProcess(stdout: string, stderr: string = "", exitCode: number = 0) {
  return {
    stdout: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stdout));
        controller.close();
      },
    }),
    stderr: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stderr));
        controller.close();
      },
    }),
    exited: Promise.resolve(exitCode),
    kill: vi.fn(),
  };
}

describe("sprite CLI wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sprite() returns stdout on success", async () => {
    mockSpawn.mockReturnValue(mockProcess("sprite-123\n"));

    const { sprite } = await import("../sprite");
    const result = await sprite(["list"]);
    expect(result).toBe("sprite-123");
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.arrayContaining(["sprite", "list"]),
      expect.any(Object),
    );
  });

  it("sprite() throws with stderr on failure", async () => {
    mockSpawn.mockReturnValue(mockProcess("", "sprite not found", 1));

    const { sprite } = await import("../sprite");
    await expect(sprite(["list"])).rejects.toThrow("sprite list failed (exit 1): sprite not found");
  });

  it("execOnSprite() constructs correct args", async () => {
    mockSpawn.mockReturnValue(mockProcess("ok"));

    const { execOnSprite } = await import("../sprite");
    await execOnSprite("my-sprite", "echo hello");

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.arrayContaining(["sprite", "exec", "-s", "my-sprite", "--", "bash", "-c", "echo hello"]),
      expect.any(Object),
    );
  });

  it("getSpriteUrl() parses URL from output", async () => {
    mockSpawn.mockReturnValue(mockProcess("https://advisor-pool-01-abc12.sprites.app\n"));

    const { getSpriteUrl } = await import("../sprite");
    const url = await getSpriteUrl("advisor-pool-01");
    expect(url).toBe("https://advisor-pool-01-abc12.sprites.app");
  });

  it("getSpriteUrl() throws if no URL found", async () => {
    mockSpawn.mockReturnValue(mockProcess("no url here"));

    const { getSpriteUrl } = await import("../sprite");
    await expect(getSpriteUrl("bad-sprite")).rejects.toThrow("Could not parse sprite URL");
  });

  it("writeToSprite() writes content via temp file", async () => {
    mockSpawn.mockReturnValue(mockProcess(""));

    const { writeToSprite } = await import("../sprite");
    await writeToSprite("my-sprite", "/home/sprite/test.txt", "hello world");

    expect(mockSpawn).toHaveBeenCalled();
  });
});
