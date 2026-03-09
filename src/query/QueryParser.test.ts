import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseQuery } from "./QueryParser";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T09:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("parseQuery", () => {
  describe("filter: done / not done", () => {
    it("parses 'not done'", () => {
      // Tokenized as NOT + done, so parsed as NOT(done) rather than atomic "not_done"
      const result = parseQuery("not done");
      expect(result.filter).toEqual({ type: "not", child: { type: "done" } });
    });

    it("parses 'done'", () => {
      const result = parseQuery("done");
      expect(result.filter).toEqual({ type: "done" });
    });
  });

  describe("filter: date filters", () => {
    it("parses 'due today'", () => {
      const result = parseQuery("due today");
      expect(result.filter).toEqual({ type: "date_filter", field: "due", op: "today", value: "" });
    });

    it("parses 'due before today'", () => {
      const result = parseQuery("due before today");
      expect(result.filter).toEqual({ type: "date_filter", field: "due", op: "before_today", value: "" });
    });

    it("parses 'due after today'", () => {
      const result = parseQuery("due after today");
      expect(result.filter).toEqual({ type: "date_filter", field: "due", op: "after_today", value: "" });
    });

    it("parses 'due on YYYY-MM-DD'", () => {
      const result = parseQuery("due on 2026-03-15");
      expect(result.filter).toEqual({ type: "date_filter", field: "due", op: "on", value: "2026-03-15" });
    });

    it("parses 'due before YYYY-MM-DD'", () => {
      const result = parseQuery("due before 2026-03-15");
      expect(result.filter).toEqual({ type: "date_filter", field: "due", op: "before", value: "2026-03-15" });
    });

    it("parses 'scheduled today'", () => {
      const result = parseQuery("scheduled today");
      expect(result.filter).toEqual({ type: "date_filter", field: "scheduled", op: "today", value: "" });
    });

    it("parses 'starts today'", () => {
      const result = parseQuery("starts today");
      expect(result.filter).toEqual({ type: "date_filter", field: "start", op: "today", value: "" });
    });

    it("parses relative dates: 'due before 7 days ago'", () => {
      const result = parseQuery("due before 7 days ago");
      expect(result.filter).toEqual({ type: "date_filter", field: "due", op: "before", value: "2026-03-03" });
    });

    it("parses relative dates: 'due after in 3 days'", () => {
      const result = parseQuery("due after in 3 days");
      expect(result.filter).toEqual({ type: "date_filter", field: "due", op: "after", value: "2026-03-13" });
    });
  });

  describe("filter: has/no date", () => {
    it("parses 'has due date'", () => {
      const result = parseQuery("has due date");
      expect(result.filter).toEqual({ type: "has_date", field: "due" });
    });

    it("parses 'no due date'", () => {
      const result = parseQuery("no due date");
      expect(result.filter).toEqual({ type: "no_date", field: "due" });
    });

    it("parses 'has scheduled date'", () => {
      const result = parseQuery("has scheduled date");
      expect(result.filter).toEqual({ type: "has_date", field: "scheduled" });
    });

    it("parses 'no start date'", () => {
      const result = parseQuery("no start date");
      expect(result.filter).toEqual({ type: "no_date", field: "start" });
    });
  });

  describe("filter: priority", () => {
    it("parses 'priority is highest'", () => {
      const result = parseQuery("priority is highest");
      expect(result.filter).toEqual({ type: "priority_is", level: "highest" });
    });

    it("parses 'priority above none'", () => {
      const result = parseQuery("priority above none");
      expect(result.filter).toEqual({ type: "priority_above", level: "none" });
    });

    it("parses 'priority below highest'", () => {
      const result = parseQuery("priority below highest");
      expect(result.filter).toEqual({ type: "priority_below", level: "highest" });
    });
  });

  describe("filter: text search", () => {
    it("parses 'path includes'", () => {
      const result = parseQuery("path includes inbox");
      expect(result.filter).toEqual({ type: "path_includes", text: "inbox" });
    });

    it("parses 'description includes'", () => {
      const result = parseQuery("description includes 買い物");
      expect(result.filter).toEqual({ type: "description_includes", text: "買い物" });
    });

    it("parses 'heading includes'", () => {
      const result = parseQuery("heading includes Tasks");
      expect(result.filter).toEqual({ type: "heading_includes", text: "Tasks" });
    });

    it("parses 'tag includes'", () => {
      const result = parseQuery("tag includes 家事");
      expect(result.filter).toEqual({ type: "tag_includes", tag: "家事" });
    });

    it("parses 'tags include' (plural)", () => {
      const result = parseQuery("tags include 家事");
      expect(result.filter).toEqual({ type: "tag_includes", tag: "家事" });
    });

    it("strips # prefix from tag", () => {
      const result = parseQuery("tag includes #家事");
      expect(result.filter).toEqual({ type: "tag_includes", tag: "家事" });
    });
  });

  describe("filter: recurring", () => {
    it("parses 'is recurring'", () => {
      const result = parseQuery("is recurring");
      expect(result.filter).toEqual({ type: "is_recurring" });
    });

    it("parses 'is not recurring'", () => {
      const result = parseQuery("is not recurring");
      expect(result.filter).toEqual({ type: "not_recurring" });
    });
  });

  describe("filter: boolean combinators", () => {
    it("parses AND", () => {
      const result = parseQuery("(not done) AND (has due date)");
      expect(result.filter!.type).toBe("and");
    });

    it("parses OR", () => {
      const result = parseQuery("(due today) OR (due before today)");
      expect(result.filter!.type).toBe("or");
    });

    it("parses NOT", () => {
      const result = parseQuery("NOT (done)");
      expect(result.filter!.type).toBe("not");
    });
  });

  describe("multiple filter lines are ANDed", () => {
    it("combines two filter lines with AND", () => {
      const result = parseQuery("not done\nhas due date");
      expect(result.filter!.type).toBe("and");
      if (result.filter!.type === "and") {
        // "not done" is parsed as NOT(done) by the tokenizer
        expect(result.filter!.left).toEqual({ type: "not", child: { type: "done" } });
        expect(result.filter!.right).toEqual({ type: "has_date", field: "due" });
      }
    });
  });

  describe("sort", () => {
    it("parses 'sort by due date'", () => {
      const result = parseQuery("sort by due date");
      expect(result.sort).toEqual([{ field: "due", direction: "asc" }]);
    });

    it("parses 'sort by priority desc'", () => {
      const result = parseQuery("sort by priority desc");
      expect(result.sort).toEqual([{ field: "priority", direction: "desc" }]);
    });

    it("parses 'sort by priority reverse'", () => {
      const result = parseQuery("sort by priority reverse");
      expect(result.sort).toEqual([{ field: "priority", direction: "desc" }]);
    });

    it("parses multiple sort rules", () => {
      const result = parseQuery("sort by priority\nsort by due date");
      expect(result.sort.length).toBe(2);
      expect(result.sort[0].field).toBe("priority");
      expect(result.sort[1].field).toBe("due");
    });
  });

  describe("group", () => {
    it("parses 'group by filename'", () => {
      const result = parseQuery("group by filename");
      expect(result.group).toEqual(["filename"]);
    });

    it("parses 'group by due date'", () => {
      const result = parseQuery("group by due date");
      expect(result.group).toEqual(["due"]);
    });

    it("parses 'group by tags'", () => {
      const result = parseQuery("group by tags");
      expect(result.group).toEqual(["tags"]);
    });
  });

  describe("limit", () => {
    it("parses 'limit N'", () => {
      const result = parseQuery("limit 10");
      expect(result.limit).toBe(10);
    });
  });

  describe("combined query", () => {
    it("parses filter + sort + group + limit", () => {
      const query = [
        "not done",
        "has due date",
        "sort by due date",
        "group by filename",
        "limit 20",
      ].join("\n");

      const result = parseQuery(query);
      expect(result.filter).not.toBeNull();
      expect(result.sort).toEqual([{ field: "due", direction: "asc" }]);
      expect(result.group).toEqual(["filename"]);
      expect(result.limit).toBe(20);
    });
  });
});
