import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, daysBetween, formatDate, formatDateTimeForFrontmatter, getDateLabel, today } from "./DateUtils";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T09:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("today", () => {
  it("returns current date as YYYY-MM-DD", () => {
    expect(today()).toBe("2026-03-10");
  });
});

describe("formatDate", () => {
  it("formats Date to YYYY-MM-DD", () => {
    expect(formatDate(new Date("2026-01-05T00:00:00"))).toBe("2026-01-05");
  });

  it("pads single-digit month and day", () => {
    expect(formatDate(new Date("2026-03-01T00:00:00"))).toBe("2026-03-01");
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    expect(addDays("2026-03-10", 5)).toBe("2026-03-15");
  });

  it("subtracts days with negative number", () => {
    expect(addDays("2026-03-10", -3)).toBe("2026-03-07");
  });

  it("handles month boundary", () => {
    expect(addDays("2026-03-30", 3)).toBe("2026-04-02");
  });

  it("handles year boundary", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });
});

describe("daysBetween", () => {
  it("returns positive for future date", () => {
    expect(daysBetween("2026-03-10", "2026-03-15")).toBe(5);
  });

  it("returns negative for past date", () => {
    expect(daysBetween("2026-03-15", "2026-03-10")).toBe(-5);
  });

  it("returns 0 for same date", () => {
    expect(daysBetween("2026-03-10", "2026-03-10")).toBe(0);
  });
});

describe("getDateLabel", () => {
  it("returns overdue label for past date", () => {
    const result = getDateLabel("2026-03-08");
    expect(result.isOverdue).toBe(true);
    expect(result.text).toContain("期限切れ");
    expect(result.color).toBe("#d1453b");
  });

  it("returns 今日 for today", () => {
    const result = getDateLabel("2026-03-10");
    expect(result.text).toBe("今日");
    expect(result.color).toBe("#058527");
    expect(result.isOverdue).toBe(false);
  });

  it("returns 明日 for tomorrow", () => {
    const result = getDateLabel("2026-03-11");
    expect(result.text).toBe("明日");
    expect(result.color).toBe("#eb8909");
  });

  it("returns weekday name for 2-6 days ahead", () => {
    // 2026-03-10 is Tuesday, so 2026-03-14 (Saturday) is 4 days ahead
    const result = getDateLabel("2026-03-14");
    expect(result.text).toBe("土曜日");
    expect(result.color).toBe("#4fc3f7");
  });

  it("returns M月D日 for dates more than 6 days ahead (same year)", () => {
    const result = getDateLabel("2026-04-15");
    expect(result.text).toBe("4月15日");
    expect(result.color).toBe("#808080");
  });

  it("returns YYYY年M月D日 for different year", () => {
    const result = getDateLabel("2027-01-01");
    expect(result.text).toBe("2027年1月1日");
    expect(result.color).toBe("#808080");
  });

  it("returns YYYY年M月D日 for overdue dates in different year", () => {
    const result = getDateLabel("2025-12-31");
    expect(result.text).toContain("2025年");
    expect(result.isOverdue).toBe(true);
  });
});

describe("formatDateTimeForFrontmatter", () => {
  it("returns YYYY-MM-DD HH:MM:SS format", () => {
    expect(formatDateTimeForFrontmatter()).toBe("2026-03-10 09:00:00");
  });
});
