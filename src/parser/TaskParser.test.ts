import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseTaskFile, parseTaskLine } from "./TaskParser";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T09:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("parseTaskLine", () => {
  it("parses a simple task", () => {
    const task = parseTaskLine("- [ ] 買い物に行く", "inbox.md", "Tasks", 0);
    expect(task).not.toBeNull();
    expect(task?.content).toBe("買い物に行く");
    expect(task?.completed).toBe(false);
    expect(task?.priority).toBe(4);
  });

  it("parses a completed task", () => {
    const task = parseTaskLine("- [x] 完了したタスク", "inbox.md", "Tasks", 0);
    expect(task).not.toBeNull();
    expect(task?.completed).toBe(true);
  });

  it("parses priority ⏫ (highest)", () => {
    const task = parseTaskLine("- [ ] タスク ⏫", "inbox.md", "Tasks", 0);
    expect(task?.priority).toBe(1);
  });

  it("parses priority 🔼 (high)", () => {
    const task = parseTaskLine("- [ ] タスク 🔼", "inbox.md", "Tasks", 0);
    expect(task?.priority).toBe(2);
  });

  it("parses priority 🔽 (low)", () => {
    const task = parseTaskLine("- [ ] タスク 🔽", "inbox.md", "Tasks", 0);
    expect(task?.priority).toBe(3);
  });

  it("parses due date", () => {
    const task = parseTaskLine("- [ ] タスク 📅 2026-03-31", "inbox.md", "Tasks", 0);
    expect(task?.dueDate).toBe("2026-03-31");
    expect(task?.dueTime).toBeNull();
  });

  it("parses due date with time", () => {
    const task = parseTaskLine("- [ ] タスク 📅 2026-03-31T14:00", "inbox.md", "Tasks", 0);
    expect(task?.dueDate).toBe("2026-03-31");
    expect(task?.dueTime).toBe("14:00");
  });

  it("parses scheduled date", () => {
    const task = parseTaskLine("- [ ] タスク ⏳ 2026-03-01", "inbox.md", "Tasks", 0);
    expect(task?.scheduledDate).toBe("2026-03-01");
  });

  it("parses start date", () => {
    const task = parseTaskLine("- [ ] タスク 🛫 2026-02-01", "inbox.md", "Tasks", 0);
    expect(task?.startDate).toBe("2026-02-01");
  });

  it("parses recurrence", () => {
    const task = parseTaskLine("- [ ] タスク 🔁 every week", "inbox.md", "Tasks", 0);
    expect(task?.recurrence).toEqual({ type: "weekly", interval: 1 });
  });

  it("parses done date", () => {
    const task = parseTaskLine("- [x] タスク ✅ 2026-03-08", "inbox.md", "Tasks", 0);
    expect(task?.doneDate).toBe("2026-03-08");
  });

  it("parses labels", () => {
    const task = parseTaskLine("- [ ] タスク #家事 #買い物", "inbox.md", "Tasks", 0);
    expect(task?.labels).toContain("家事");
    expect(task?.labels).toContain("買い物");
  });

  it("parses a full task line with all fields", () => {
    const line = "- [ ] タスク名 #label ⏫ 🔁 every week 📅 2026-03-31 ⏳ 2026-03-01 🛫 2026-02-01";
    const task = parseTaskLine(line, "project.md", "Tasks", 0);
    expect(task?.content).toBe("タスク名");
    expect(task?.labels).toContain("label");
    expect(task?.priority).toBe(1);
    expect(task?.recurrence).toEqual({ type: "weekly", interval: 1 });
    expect(task?.dueDate).toBe("2026-03-31");
    expect(task?.scheduledDate).toBe("2026-03-01");
    expect(task?.startDate).toBe("2026-02-01");
  });

  it("parses stamina timer config", () => {
    const line = "- [ ] ゲームスタミナ #stamina ⚡ 120/200 🔄 432s 📌 2026-03-10T06:00:00Z";
    const task = parseTaskLine(line, "test.md", "Tasks", 0);
    expect(task?.timerConfig).not.toBeNull();
    expect(task?.timerConfig?.type).toBe("stamina");
    if (task?.timerConfig?.type === "stamina") {
      expect(task?.timerConfig?.currentValue).toBe(120);
      expect(task?.timerConfig?.maxValue).toBe(200);
      expect(task?.timerConfig?.recoveryIntervalSeconds).toBe(432);
      expect(task?.timerConfig?.lastUpdatedAt).toBe("2026-03-10T06:00:00Z");
    }
  });

  it("parses periodic timer config", () => {
    const line = "- [ ] デイリーボーナス #periodic 📈 30/100 +10 🕐 06:00,12:00,18:00 📌 2026-03-09T18:00:00Z";
    const task = parseTaskLine(line, "test.md", "Tasks", 0);
    expect(task?.timerConfig).not.toBeNull();
    expect(task?.timerConfig?.type).toBe("periodic");
    if (task?.timerConfig?.type === "periodic") {
      expect(task?.timerConfig?.currentValue).toBe(30);
      expect(task?.timerConfig?.maxValue).toBe(100);
      expect(task?.timerConfig?.incrementAmount).toBe(10);
      expect(task?.timerConfig?.scheduleTimes).toEqual(["06:00", "12:00", "18:00"]);
      expect(task?.timerConfig?.lastUpdatedAt).toBe("2026-03-09T18:00:00Z");
    }
  });

  it("returns null for non-task lines", () => {
    expect(parseTaskLine("## Section", "inbox.md", "Tasks", 0)).toBeNull();
    expect(parseTaskLine("普通のテキスト", "inbox.md", "Tasks", 0)).toBeNull();
  });

  it("parses indented tasks", () => {
    const task = parseTaskLine("  - [ ] サブタスク", "inbox.md", "Tasks", 0, 1);
    expect(task).not.toBeNull();
    expect(task?.indent).toBe(1);
  });

  it("parses note mode task with * prefix", () => {
    const task = parseTaskLine("- [ ] * メモ内容", "inbox.md", "Tasks", 0);
    expect(task).not.toBeNull();
    expect(task?.noteMode).toBe(true);
    expect(task?.content).toBe("メモ内容");
  });

  it("parses note mode task with metadata", () => {
    const task = parseTaskLine("- [ ] * メモ #label 📅 2026-03-31", "inbox.md", "Tasks", 0);
    expect(task).not.toBeNull();
    expect(task?.noteMode).toBe(true);
    expect(task?.content).toBe("メモ");
    expect(task?.labels).toContain("label");
    expect(task?.dueDate).toBe("2026-03-31");
  });

  it("does not set note mode for normal tasks", () => {
    const task = parseTaskLine("- [ ] 普通のタスク", "inbox.md", "Tasks", 0);
    expect(task?.noteMode).toBe(false);
  });
});

describe("parseTaskFile", () => {
  it("parses frontmatter", () => {
    const content = ["---", "title: テスト", "tags: [tag1, tag2]", "---", "", "## Tasks", "- [ ] タスク1"].join("\n");

    const result = parseTaskFile(content, "test.md");
    expect(result.frontmatter.title).toBe("テスト");
    expect(result.frontmatter.tags).toEqual(["tag1", "tag2"]);
  });

  it("parses sections and tasks", () => {
    const content = ["## Section A", "- [ ] タスク1", "- [ ] タスク2", "", "## Section B", "- [ ] タスク3"].join("\n");

    const result = parseTaskFile(content, "test.md");
    expect(result.sectionOrder).toEqual(["Section A", "Section B"]);
    expect(result.sections.get("Section A")?.length).toBe(2);
    expect(result.sections.get("Section B")?.length).toBe(1);
  });

  it("parses child content", () => {
    const content = ["## Tasks", "- [ ] 親タスク", "  メモ1", "  メモ2"].join("\n");

    const result = parseTaskFile(content, "test.md");
    const tasks = result.sections.get("Tasks") ?? [];
    expect(tasks[0].children).toEqual(["メモ1", "メモ2"]);
  });

  it("assigns correct order to tasks", () => {
    const content = ["## Tasks", "- [ ] タスク1", "- [ ] タスク2", "- [ ] タスク3"].join("\n");

    const result = parseTaskFile(content, "test.md");
    const tasks = result.sections.get("Tasks") ?? [];
    expect(tasks[0].order).toBe(0);
    expect(tasks[1].order).toBe(1);
    expect(tasks[2].order).toBe(2);
  });

  it("handles file without frontmatter", () => {
    const content = ["## Tasks", "- [ ] タスク1"].join("\n");

    const result = parseTaskFile(content, "test.md");
    expect(result.frontmatter).toEqual({});
    expect(result.sections.get("Tasks")?.length).toBe(1);
  });

  it("handles tasks before any section heading", () => {
    const content = "- [ ] タスク1";
    const result = parseTaskFile(content, "test.md");
    expect(result.sections.get("")?.length).toBe(1);
  });
});
