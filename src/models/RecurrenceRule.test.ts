import { describe, expect, it } from "vitest";
import { getNextDueDate, parseRecurrence, recurrenceToDisplayText, serializeRecurrence } from "./RecurrenceRule";

describe("parseRecurrence", () => {
  describe("natural language format", () => {
    it("parses 'every day'", () => {
      expect(parseRecurrence("every day")).toEqual({ type: "daily", interval: 1 });
    });

    it("parses 'every 3 days'", () => {
      expect(parseRecurrence("every 3 days")).toEqual({ type: "daily", interval: 3 });
    });

    it("parses 'every week'", () => {
      expect(parseRecurrence("every week")).toEqual({ type: "weekly", interval: 1 });
    });

    it("parses 'every week on Saturday'", () => {
      // Input is lowercased internally, so "saturday" → .slice(0,3) → "sat"
      expect(parseRecurrence("every week on Saturday")).toEqual({ type: "weekly", interval: 1, on: "sat" });
    });

    it("parses 'every 2 weeks'", () => {
      expect(parseRecurrence("every 2 weeks")).toEqual({ type: "weekly", interval: 2 });
    });

    it("parses 'every month'", () => {
      expect(parseRecurrence("every month")).toEqual({ type: "monthly", interval: 1 });
    });

    it("parses 'every month on the 15'", () => {
      const result = parseRecurrence("every month on the 15");
      expect(result).toEqual({ type: "monthly", interval: 1, on: "15" });
    });

    it("parses 'every 2 months'", () => {
      expect(parseRecurrence("every 2 months")).toEqual({ type: "monthly", interval: 2 });
    });

    it("parses 'every year'", () => {
      expect(parseRecurrence("every year")).toEqual({ type: "yearly", interval: 1 });
    });

    it("parses 'every 2 years'", () => {
      expect(parseRecurrence("every 2 years")).toEqual({ type: "yearly", interval: 2 });
    });
  });

  describe("compact format", () => {
    it("parses 'daily'", () => {
      expect(parseRecurrence("daily")).toEqual({ type: "daily", interval: 1 });
    });

    it("parses 'weekly/sat'", () => {
      expect(parseRecurrence("weekly/sat")).toEqual({ type: "weekly", interval: 1, on: "sat" });
    });

    it("parses 'monthly/1'", () => {
      expect(parseRecurrence("monthly/1")).toEqual({ type: "monthly", interval: 1, on: "1" });
    });

    it("parses 'yearly'", () => {
      expect(parseRecurrence("yearly")).toEqual({ type: "yearly", interval: 1 });
    });
  });

  it("returns null for empty string", () => {
    expect(parseRecurrence("")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseRecurrence("invalid")).toBeNull();
  });
});

describe("serializeRecurrence", () => {
  it("serializes daily", () => {
    expect(serializeRecurrence({ type: "daily", interval: 1 })).toBe("every day");
  });

  it("serializes daily with interval", () => {
    expect(serializeRecurrence({ type: "daily", interval: 3 })).toBe("every 3 days");
  });

  it("serializes weekly", () => {
    expect(serializeRecurrence({ type: "weekly", interval: 1 })).toBe("every week");
  });

  it("serializes weekly with day", () => {
    expect(serializeRecurrence({ type: "weekly", interval: 1, on: "sat" })).toBe("every week on Saturday");
  });

  it("serializes biweekly", () => {
    expect(serializeRecurrence({ type: "weekly", interval: 2 })).toBe("every 2 weeks");
  });

  it("serializes monthly", () => {
    expect(serializeRecurrence({ type: "monthly", interval: 1 })).toBe("every month");
  });

  it("serializes monthly with day", () => {
    expect(serializeRecurrence({ type: "monthly", interval: 1, on: "1" })).toBe("every month on the 1st");
  });

  it("serializes monthly with ordinals", () => {
    expect(serializeRecurrence({ type: "monthly", interval: 1, on: "2" })).toBe("every month on the 2nd");
    expect(serializeRecurrence({ type: "monthly", interval: 1, on: "3" })).toBe("every month on the 3rd");
    expect(serializeRecurrence({ type: "monthly", interval: 1, on: "15" })).toBe("every month on the 15th");
  });

  it("serializes yearly", () => {
    expect(serializeRecurrence({ type: "yearly", interval: 1 })).toBe("every year");
  });

  it("serializes yearly with interval", () => {
    expect(serializeRecurrence({ type: "yearly", interval: 2 })).toBe("every 2 years");
  });
});

describe("getNextDueDate", () => {
  it("adds days for daily recurrence", () => {
    expect(getNextDueDate("2026-03-10", { type: "daily", interval: 1 })).toBe("2026-03-11");
    expect(getNextDueDate("2026-03-10", { type: "daily", interval: 3 })).toBe("2026-03-13");
  });

  it("adds weeks for weekly recurrence", () => {
    expect(getNextDueDate("2026-03-10", { type: "weekly", interval: 1 })).toBe("2026-03-17");
    expect(getNextDueDate("2026-03-10", { type: "weekly", interval: 2 })).toBe("2026-03-24");
  });

  it("adds months for monthly recurrence", () => {
    expect(getNextDueDate("2026-03-10", { type: "monthly", interval: 1 })).toBe("2026-04-10");
  });

  it("sets specific day for monthly with on", () => {
    expect(getNextDueDate("2026-03-10", { type: "monthly", interval: 1, on: "1" })).toBe("2026-04-01");
  });

  it("adds years for yearly recurrence", () => {
    expect(getNextDueDate("2026-03-10", { type: "yearly", interval: 1 })).toBe("2027-03-10");
  });
});

describe("recurrenceToDisplayText", () => {
  it("displays 毎日", () => {
    expect(recurrenceToDisplayText({ type: "daily", interval: 1 })).toBe("毎日");
  });

  it("displays interval with ごと", () => {
    expect(recurrenceToDisplayText({ type: "daily", interval: 3 })).toBe("3日ごと");
    expect(recurrenceToDisplayText({ type: "weekly", interval: 2 })).toBe("2週ごと");
    expect(recurrenceToDisplayText({ type: "monthly", interval: 3 })).toBe("3ヶ月ごと");
    expect(recurrenceToDisplayText({ type: "yearly", interval: 2 })).toBe("2年ごと");
  });

  it("displays weekday", () => {
    expect(recurrenceToDisplayText({ type: "weekly", interval: 1, on: "sat" })).toBe("毎週 土曜日");
  });

  it("displays monthly day", () => {
    expect(recurrenceToDisplayText({ type: "monthly", interval: 1, on: "15" })).toBe("毎月 15日");
  });
});
