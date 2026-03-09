import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultTask, type Task } from "../models/Task";
import { executeQuery, groupTasks } from "./QueryEngine";
import type { ParsedQuery } from "./QueryParser";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T09:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

function makeTask(overrides: Partial<Task> = {}): Task {
  return { ...getDefaultTask("test.md", "Tasks", 0), ...overrides };
}

describe("executeQuery", () => {
  const tasks: Task[] = [
    makeTask({ content: "タスク1", completed: false, dueDate: "2026-03-15", priority: 1, order: 0 }),
    makeTask({
      content: "タスク2",
      completed: true,
      dueDate: "2026-03-10",
      priority: 4,
      doneDate: "2026-03-10",
      order: 1,
    }),
    makeTask({ content: "タスク3", completed: false, dueDate: "2026-03-08", priority: 2, order: 2 }),
    makeTask({ content: "タスク4", completed: false, priority: 3, order: 3 }),
    makeTask({
      content: "タスク5",
      completed: false,
      scheduledDate: "2026-03-10",
      labels: ["仕事"],
      recurrence: { type: "weekly", interval: 1 },
      order: 4,
    }),
  ];

  it("filters by not done", () => {
    const query: ParsedQuery = { filter: { type: "not_done" }, sort: [], group: [], limit: null };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(4);
    expect(result.every((t) => !t.completed)).toBe(true);
  });

  it("filters by done", () => {
    const query: ParsedQuery = { filter: { type: "done" }, sort: [], group: [], limit: null };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(1);
    expect(result[0].content).toBe("タスク2");
  });

  it("filters by due today", () => {
    const query: ParsedQuery = {
      filter: { type: "date_filter", field: "due", op: "today", value: "" },
      sort: [],
      group: [],
      limit: null,
    };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(1);
    expect(result[0].content).toBe("タスク2");
  });

  it("filters by due before today (overdue)", () => {
    const query: ParsedQuery = {
      filter: { type: "date_filter", field: "due", op: "before_today", value: "" },
      sort: [],
      group: [],
      limit: null,
    };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(1);
    expect(result[0].content).toBe("タスク3");
  });

  it("filters by has due date", () => {
    const query: ParsedQuery = { filter: { type: "has_date", field: "due" }, sort: [], group: [], limit: null };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(3);
  });

  it("filters by no due date", () => {
    const query: ParsedQuery = { filter: { type: "no_date", field: "due" }, sort: [], group: [], limit: null };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(2);
  });

  it("filters by priority is highest", () => {
    const query: ParsedQuery = { filter: { type: "priority_is", level: "highest" }, sort: [], group: [], limit: null };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(1);
    expect(result[0].priority).toBe(1);
  });

  it("filters by priority above none (has priority)", () => {
    const query: ParsedQuery = { filter: { type: "priority_above", level: "none" }, sort: [], group: [], limit: null };
    const result = executeQuery(tasks, query);
    expect(result.every((t) => t.priority < 4)).toBe(true);
  });

  it("filters by description includes", () => {
    const query: ParsedQuery = {
      filter: { type: "description_includes", text: "タスク1" },
      sort: [],
      group: [],
      limit: null,
    };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(1);
    expect(result[0].content).toBe("タスク1");
  });

  it("filters by tag includes", () => {
    const query: ParsedQuery = { filter: { type: "tag_includes", tag: "仕事" }, sort: [], group: [], limit: null };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(1);
    expect(result[0].content).toBe("タスク5");
  });

  it("filters by is recurring", () => {
    const query: ParsedQuery = { filter: { type: "is_recurring" }, sort: [], group: [], limit: null };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(1);
    expect(result[0].content).toBe("タスク5");
  });

  it("filters by is not recurring", () => {
    const query: ParsedQuery = { filter: { type: "not_recurring" }, sort: [], group: [], limit: null };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(4);
  });

  it("handles AND filter", () => {
    const query: ParsedQuery = {
      filter: { type: "and", left: { type: "not_done" }, right: { type: "has_date", field: "due" } },
      sort: [],
      group: [],
      limit: null,
    };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(2); // タスク1, タスク3
  });

  it("handles OR filter", () => {
    const query: ParsedQuery = {
      filter: { type: "or", left: { type: "done" }, right: { type: "priority_is", level: "highest" } },
      sort: [],
      group: [],
      limit: null,
    };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(2); // タスク1 (p1), タスク2 (done)
  });

  it("handles NOT filter", () => {
    const query: ParsedQuery = {
      filter: { type: "not", child: { type: "done" } },
      sort: [],
      group: [],
      limit: null,
    };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(4);
  });

  it("sorts by due date", () => {
    const query: ParsedQuery = {
      filter: { type: "has_date", field: "due" },
      sort: [{ field: "due", direction: "asc" }],
      group: [],
      limit: null,
    };
    const result = executeQuery(tasks, query);
    expect(result[0].dueDate).toBe("2026-03-08");
    expect(result[1].dueDate).toBe("2026-03-10");
    expect(result[2].dueDate).toBe("2026-03-15");
  });

  it("sorts by priority", () => {
    const query: ParsedQuery = {
      filter: { type: "not_done" },
      sort: [{ field: "priority", direction: "asc" }],
      group: [],
      limit: null,
    };
    const result = executeQuery(tasks, query);
    expect(result[0].priority).toBe(1);
    expect(result[1].priority).toBe(2);
  });

  it("sorts descending", () => {
    const query: ParsedQuery = {
      filter: { type: "has_date", field: "due" },
      sort: [{ field: "due", direction: "desc" }],
      group: [],
      limit: null,
    };
    const result = executeQuery(tasks, query);
    expect(result[0].dueDate).toBe("2026-03-15");
    expect(result[2].dueDate).toBe("2026-03-08");
  });

  it("limits results", () => {
    const query: ParsedQuery = { filter: null, sort: [], group: [], limit: 2 };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(2);
  });

  it("returns all tasks when no filter specified", () => {
    const query: ParsedQuery = { filter: null, sort: [], group: [], limit: null };
    const result = executeQuery(tasks, query);
    expect(result.length).toBe(5);
  });
});

describe("groupTasks", () => {
  const tasks: Task[] = [
    makeTask({
      content: "タスク1",
      projectPath: "project-a.md",
      dueDate: "2026-03-10",
      priority: 1,
      labels: ["仕事"],
      section: "Section A",
      order: 0,
    }),
    makeTask({
      content: "タスク2",
      projectPath: "project-a.md",
      dueDate: "2026-03-10",
      priority: 4,
      labels: ["家事"],
      section: "Section B",
      order: 1,
    }),
    makeTask({
      content: "タスク3",
      projectPath: "project-b.md",
      priority: 2,
      labels: ["仕事"],
      section: "Section A",
      order: 2,
    }),
  ];

  it("returns single group when no groupBy", () => {
    const result = groupTasks(tasks, []);
    expect(result.length).toBe(1);
    expect(result[0].key).toBe("");
    expect(result[0].tasks.length).toBe(3);
  });

  it("groups by filename", () => {
    const result = groupTasks(tasks, ["filename"]);
    expect(result.length).toBe(2);
    expect(result.map((g) => g.key)).toContain("project-a");
    expect(result.map((g) => g.key)).toContain("project-b");
  });

  it("groups by due date", () => {
    const result = groupTasks(tasks, ["due"]);
    expect(result.some((g) => g.key === "2026-03-10")).toBe(true);
    expect(result.some((g) => g.key === "(no due date)")).toBe(true);
  });

  it("groups by priority", () => {
    const result = groupTasks(tasks, ["priority"]);
    expect(result.length).toBe(3); // Highest, High, Normal
    // Sorted by priority order
    expect(result[0].key).toContain("Highest");
  });

  it("groups by heading", () => {
    const result = groupTasks(tasks, ["heading"]);
    expect(result.length).toBe(2);
    expect(result.map((g) => g.key)).toContain("Section A");
    expect(result.map((g) => g.key)).toContain("Section B");
  });

  it("groups by tags (tasks appear in multiple groups)", () => {
    const result = groupTasks(tasks, ["tags"]);
    const workGroup = result.find((g) => g.key === "#仕事");
    expect(workGroup).toBeDefined();
    expect(workGroup?.tasks.length).toBe(2);
  });
});
