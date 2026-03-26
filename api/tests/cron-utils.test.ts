import { describe, it, expect } from "vitest";
import { matchesCron, toLocalTime, formatMinuteKey } from "../cron-utils";

describe("matchesCron", () => {
  it("matches exact minute and hour", () => {
    expect(matchesCron("0 6 * * *", 6, 0)).toBe(true);
    expect(matchesCron("30 14 * * *", 14, 30)).toBe(true);
  });

  it("rejects non-matching minute or hour", () => {
    expect(matchesCron("0 6 * * *", 6, 1)).toBe(false);
    expect(matchesCron("0 6 * * *", 7, 0)).toBe(false);
  });

  it("handles wildcard *", () => {
    expect(matchesCron("0 * * * *", 14, 0)).toBe(true);
    expect(matchesCron("* 6 * * *", 6, 45)).toBe(true);
    expect(matchesCron("* * * * *", 23, 59)).toBe(true);
  });

  it("handles comma-separated values", () => {
    expect(matchesCron("0 6,12,18 * * *", 12, 0)).toBe(true);
    expect(matchesCron("0 6,12,18 * * *", 14, 0)).toBe(false);
    expect(matchesCron("0,30 * * * *", 8, 30)).toBe(true);
    expect(matchesCron("0,30 * * * *", 8, 15)).toBe(false);
  });

  it("handles malformed input", () => {
    expect(matchesCron("", 0, 0)).toBe(false);
    expect(matchesCron("0", 0, 0)).toBe(false);
  });
});

describe("toLocalTime", () => {
  it("converts UTC to Eastern", () => {
    // 10:00 UTC = 6:00 ET (during EDT, March 26)
    const date = new Date("2026-03-26T10:00:00Z");
    const { hour, minute } = toLocalTime(date, "America/New_York");
    expect(hour).toBe(6);
    expect(minute).toBe(0);
  });

  it("converts UTC to Pacific", () => {
    // 14:00 UTC = 7:00 PT (during PDT)
    const date = new Date("2026-03-26T14:00:00Z");
    const { hour, minute } = toLocalTime(date, "America/Los_Angeles");
    expect(hour).toBe(7);
    expect(minute).toBe(0);
  });

  it("converts UTC to Central", () => {
    // 11:00 UTC = 6:00 CT (during CDT)
    const date = new Date("2026-03-26T11:00:00Z");
    const { hour, minute } = toLocalTime(date, "America/Chicago");
    expect(hour).toBe(6);
    expect(minute).toBe(0);
  });

  it("handles UTC timezone", () => {
    const date = new Date("2026-03-26T08:00:00Z");
    const { hour, minute } = toLocalTime(date, "UTC");
    expect(hour).toBe(8);
    expect(minute).toBe(0);
  });
});

describe("formatMinuteKey", () => {
  it("formats correctly", () => {
    const date = new Date("2026-03-26T10:05:00Z");
    expect(formatMinuteKey(date)).toBe("2026-03-26-10-05");
  });

  it("pads single digits", () => {
    const date = new Date("2026-01-02T03:04:00Z");
    expect(formatMinuteKey(date)).toBe("2026-01-02-03-04");
  });
});
