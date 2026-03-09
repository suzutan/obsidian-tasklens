import { describe, expect, it } from "vitest";
import { getDefaultTask, type Task } from "../models/Task";
import { parseTaskLine } from "./TaskParser";
import { serializeTask, serializeTaskFile } from "./TaskSerializer";

function makeTask(overrides: Partial<Task> = {}): Task {
  return { ...getDefaultTask("test.md", "Tasks", 0), ...overrides };
}

describe("serializeTask", () => {
  it("serializes a simple task", () => {
    const task = makeTask({ content: "買い物に行く" });
    expect(serializeTask(task)).toBe("- [ ] 買い物に行く");
  });

  it("serializes a completed task", () => {
    const task = makeTask({ content: "完了タスク", completed: true });
    expect(serializeTask(task)).toBe("- [x] 完了タスク");
  });

  it("serializes priority", () => {
    expect(serializeTask(makeTask({ content: "タスク", priority: 1 }))).toContain("⏫");
    expect(serializeTask(makeTask({ content: "タスク", priority: 2 }))).toContain("🔼");
    expect(serializeTask(makeTask({ content: "タスク", priority: 3 }))).toContain("🔽");
    expect(serializeTask(makeTask({ content: "タスク", priority: 4 }))).not.toContain("⏫");
  });

  it("serializes labels", () => {
    const task = makeTask({ content: "タスク", labels: ["家事", "買い物"] });
    const result = serializeTask(task);
    expect(result).toContain("#家事");
    expect(result).toContain("#買い物");
  });

  it("serializes due date", () => {
    const task = makeTask({ content: "タスク", dueDate: "2026-03-31" });
    expect(serializeTask(task)).toContain("📅 2026-03-31");
  });

  it("serializes due date with time", () => {
    const task = makeTask({ content: "タスク", dueDate: "2026-03-31", dueTime: "14:00" });
    expect(serializeTask(task)).toContain("📅 2026-03-31T14:00");
  });

  it("serializes scheduled date", () => {
    const task = makeTask({ content: "タスク", scheduledDate: "2026-03-01" });
    expect(serializeTask(task)).toContain("⏳ 2026-03-01");
  });

  it("serializes start date", () => {
    const task = makeTask({ content: "タスク", startDate: "2026-02-01" });
    expect(serializeTask(task)).toContain("🛫 2026-02-01");
  });

  it("serializes recurrence", () => {
    const task = makeTask({ content: "タスク", recurrence: { type: "weekly", interval: 1 } });
    expect(serializeTask(task)).toContain("🔁 every week");
  });

  it("serializes done date", () => {
    const task = makeTask({ content: "タスク", completed: true, doneDate: "2026-03-08" });
    expect(serializeTask(task)).toContain("✅ 2026-03-08");
  });

  it("serializes indented task", () => {
    const task = makeTask({ content: "サブタスク", indent: 1 });
    expect(serializeTask(task)).toBe("  - [ ] サブタスク");
  });

  it("serializes children", () => {
    const task = makeTask({ content: "タスク", children: ["メモ1", "メモ2"] });
    const result = serializeTask(task);
    expect(result).toContain("\n  メモ1");
    expect(result).toContain("\n  メモ2");
  });

  it("serializes stamina timer config", () => {
    const task = makeTask({
      content: "ゲームスタミナ",
      labels: ["stamina"],
      timerConfig: {
        type: "stamina",
        currentValue: 120,
        maxValue: 200,
        recoveryIntervalSeconds: 432,
        lastUpdatedAt: "2026-03-10T06:00:00Z",
      },
    });
    const result = serializeTask(task);
    expect(result).toContain("⚡ 120/200 🔄 432s 📌 2026-03-10T06:00:00Z");
  });

  it("serializes periodic timer config", () => {
    const task = makeTask({
      content: "デイリーボーナス",
      labels: ["periodic"],
      timerConfig: {
        type: "periodic",
        currentValue: 30,
        maxValue: 100,
        incrementAmount: 10,
        scheduleTimes: ["06:00", "12:00", "18:00"],
        lastUpdatedAt: "2026-03-09T18:00:00Z",
      },
    });
    const result = serializeTask(task);
    expect(result).toContain("📈 30/100 +10 🕐 06:00,12:00,18:00 📌 2026-03-09T18:00:00Z");
  });

  it("serializes note mode task with * prefix", () => {
    const task = makeTask({ content: "メモ内容", noteMode: true });
    expect(serializeTask(task)).toBe("- [ ] * メモ内容");
  });

  it("serializes full task with correct field order", () => {
    const task = makeTask({
      content: "タスク名",
      labels: ["label"],
      priority: 1,
      recurrence: { type: "weekly", interval: 1 },
      dueDate: "2026-03-31",
      scheduledDate: "2026-03-01",
      startDate: "2026-02-01",
      doneDate: "2026-03-08",
    });
    const result = serializeTask(task);
    // Verify order: content, labels, priority, recurrence, due, scheduled, start, done
    const labelIdx = result.indexOf("#label");
    const prioIdx = result.indexOf("⏫");
    const recurIdx = result.indexOf("🔁");
    const dueIdx = result.indexOf("📅");
    const schedIdx = result.indexOf("⏳");
    const startIdx = result.indexOf("🛫");
    const doneIdx = result.indexOf("✅");
    expect(labelIdx).toBeLessThan(prioIdx);
    expect(prioIdx).toBeLessThan(recurIdx);
    expect(recurIdx).toBeLessThan(dueIdx);
    expect(dueIdx).toBeLessThan(schedIdx);
    expect(schedIdx).toBeLessThan(startIdx);
    expect(startIdx).toBeLessThan(doneIdx);
  });
});

describe("serializeTaskFile", () => {
  it("serializes a file with frontmatter, title, sections", () => {
    const sections = new Map<string, Task[]>();
    sections.set("Tasks", [makeTask({ content: "タスク1" })]);
    const result = serializeTaskFile(
      { title: "テスト", created: "2026-03-10" },
      "テストプロジェクト",
      null,
      ["Tasks"],
      sections,
    );
    expect(result).toContain("---");
    expect(result).toContain("title: テスト");
    expect(result).toContain("# テストプロジェクト");
    expect(result).toContain("## Tasks");
    expect(result).toContain("- [ ] タスク1");
  });

  it("includes description when provided", () => {
    const sections = new Map<string, Task[]>();
    const result = serializeTaskFile({}, "タイトル", "これは説明文です", [], sections);
    expect(result).toContain("これは説明文です");
  });
});

describe("roundtrip: parse → serialize", () => {
  it("roundtrips a simple task", () => {
    const line = "- [ ] 買い物に行く #家事 📅 2026-03-31";
    const task = parseTaskLine(line, "test.md", "Tasks", 0);
    if (!task) throw new Error("Expected task to be parsed");
    const serialized = serializeTask(task);
    expect(serialized).toBe("- [ ] 買い物に行く #家事 📅 2026-03-31");
  });

  it("roundtrips a full task", () => {
    const line = "- [ ] タスク名 #label ⏫ 🔁 every week 📅 2026-03-31 ⏳ 2026-03-01 🛫 2026-02-01";
    const task = parseTaskLine(line, "test.md", "Tasks", 0);
    if (!task) throw new Error("Expected task to be parsed");
    const serialized = serializeTask(task);
    expect(serialized).toContain("タスク名");
    expect(serialized).toContain("#label");
    expect(serialized).toContain("⏫");
    expect(serialized).toContain("🔁 every week");
    expect(serialized).toContain("📅 2026-03-31");
    expect(serialized).toContain("⏳ 2026-03-01");
    expect(serialized).toContain("🛫 2026-02-01");
  });

  it("roundtrips a note mode task", () => {
    const line = "- [ ] * メモ内容 #label 📅 2026-03-31";
    const task = parseTaskLine(line, "test.md", "Tasks", 0);
    if (!task) throw new Error("Expected task to be parsed");
    expect(task.noteMode).toBe(true);
    const serialized = serializeTask(task);
    expect(serialized).toBe("- [ ] * メモ内容 #label 📅 2026-03-31");
  });

  it("roundtrips a completed task with done date", () => {
    const line = "- [x] 完了タスク ✅ 2026-03-08";
    const task = parseTaskLine(line, "test.md", "Tasks", 0);
    if (!task) throw new Error("Expected task to be parsed");
    const serialized = serializeTask(task);
    expect(serialized).toBe("- [x] 完了タスク ✅ 2026-03-08");
  });
});
