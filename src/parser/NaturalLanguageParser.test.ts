import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseNaturalLanguage } from "./NaturalLanguageParser";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T09:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("parseNaturalLanguage", () => {
  describe("priority", () => {
    it("extracts p1 as highest priority", () => {
      const result = parseNaturalLanguage("買い物 p1");
      expect(result.priority).toBe(1);
      expect(result.content).toBe("買い物");
    });

    it("extracts p2 as high priority", () => {
      const result = parseNaturalLanguage("タスク p2");
      expect(result.priority).toBe(2);
    });

    it("extracts p3 as low priority", () => {
      const result = parseNaturalLanguage("タスク p3");
      expect(result.priority).toBe(3);
    });

    it("defaults to p4 when no priority specified", () => {
      const result = parseNaturalLanguage("タスク");
      expect(result.priority).toBe(4);
    });
  });

  describe("labels", () => {
    it("extracts single label", () => {
      const result = parseNaturalLanguage("買い物 #家事");
      expect(result.labels).toEqual(["家事"]);
      expect(result.content).toBe("買い物");
    });

    it("extracts multiple labels", () => {
      const result = parseNaturalLanguage("タスク #仕事 #重要");
      expect(result.labels).toContain("仕事");
      expect(result.labels).toContain("重要");
    });
  });

  describe("brace-enclosed due dates", () => {
    it("extracts {YYYY-MM-DD} as due date", () => {
      const result = parseNaturalLanguage("タスク {2026-03-15}");
      expect(result.dueDate).toBe("2026-03-15");
      expect(result.content).toBe("タスク");
    });

    it("extracts {YYYY-MM-DD HH:MM} with time", () => {
      const result = parseNaturalLanguage("タスク {2026-03-15 14:00}");
      expect(result.dueDate).toBe("2026-03-15");
      expect(result.dueTime).toBe("14:00");
    });

    it("extracts {M/D} as due date", () => {
      const result = parseNaturalLanguage("タスク {3/20}");
      expect(result.dueDate).toBe("2026-03-20");
    });

    it("extracts {M/D HH:MM} with time", () => {
      const result = parseNaturalLanguage("タスク {3/20 18:00}");
      expect(result.dueDate).toBe("2026-03-20");
      expect(result.dueTime).toBe("18:00");
    });

    it("extracts {M月D日} as due date", () => {
      const result = parseNaturalLanguage("タスク {3月20日}");
      expect(result.dueDate).toBe("2026-03-20");
    });
  });

  describe("natural language dates → scheduled date", () => {
    it("parses 今日 → scheduledDate", () => {
      const result = parseNaturalLanguage("今日 買い物");
      expect(result.scheduledDate).toBe("2026-03-10");
    });

    it("parses 明日 → scheduledDate", () => {
      const result = parseNaturalLanguage("明日 牛乳を買う");
      expect(result.scheduledDate).toBe("2026-03-11");
      expect(result.content).toBe("牛乳を買う");
    });

    it("parses 明後日 → scheduledDate", () => {
      const result = parseNaturalLanguage("明後日 タスク");
      expect(result.scheduledDate).toBe("2026-03-12");
    });

    it("parses M/D → scheduledDate", () => {
      const result = parseNaturalLanguage("3/15 レポート提出");
      expect(result.scheduledDate).toBe("2026-03-15");
    });

    it("parses M/D HH:MM → scheduledDate with time", () => {
      const result = parseNaturalLanguage("3/15 14:00 ミーティング");
      expect(result.scheduledDate).toBe("2026-03-15");
      expect(result.scheduledTime).toBe("14:00");
    });

    it("parses 来週 → scheduledDate (7 days later)", () => {
      const result = parseNaturalLanguage("来週 タスク");
      expect(result.scheduledDate).toBe("2026-03-17");
    });
  });

  describe("combined inputs", () => {
    it("parses date + priority + label", () => {
      const result = parseNaturalLanguage("明日 買い物に行く p1 #家事");
      expect(result.scheduledDate).toBe("2026-03-11");
      expect(result.priority).toBe(1);
      expect(result.labels).toEqual(["家事"]);
      expect(result.content).toBe("買い物に行く");
    });

    it("parses brace date + label", () => {
      const result = parseNaturalLanguage("レポート提出 {2026-03-20} #仕事");
      expect(result.dueDate).toBe("2026-03-20");
      expect(result.labels).toEqual(["仕事"]);
      expect(result.content).toBe("レポート提出");
    });
  });

  describe("plain text", () => {
    it("returns content with no metadata", () => {
      const result = parseNaturalLanguage("単純なタスク");
      expect(result.content).toBe("単純なタスク");
      expect(result.dueDate).toBeNull();
      expect(result.scheduledDate).toBeNull();
      expect(result.priority).toBe(4);
      expect(result.labels).toEqual([]);
    });
  });
});
