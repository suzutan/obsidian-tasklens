import { describe, it, expect } from "vitest";
import { createTaskId, getDefaultTask } from "./Task";

describe("createTaskId", () => {
  it("creates id from path, section, and order", () => {
    expect(createTaskId("inbox.md", "Tasks", 0)).toBe("inbox.md::Tasks::0");
  });

  it("handles empty section", () => {
    expect(createTaskId("project.md", "", 5)).toBe("project.md::::5");
  });
});

describe("getDefaultTask", () => {
  it("creates a task with default values", () => {
    const task = getDefaultTask("inbox.md", "Tasks", 0);
    expect(task.id).toBe("inbox.md::Tasks::0");
    expect(task.content).toBe("");
    expect(task.completed).toBe(false);
    expect(task.priority).toBe(4);
    expect(task.dueDate).toBeNull();
    expect(task.dueTime).toBeNull();
    expect(task.scheduledDate).toBeNull();
    expect(task.scheduledTime).toBeNull();
    expect(task.startDate).toBeNull();
    expect(task.startTime).toBeNull();
    expect(task.doneDate).toBeNull();
    expect(task.recurrence).toBeNull();
    expect(task.labels).toEqual([]);
    expect(task.children).toEqual([]);
    expect(task.projectPath).toBe("inbox.md");
    expect(task.section).toBe("Tasks");
    expect(task.order).toBe(0);
    expect(task.indent).toBe(0);
    expect(task.parentId).toBeNull();
    expect(task.timerConfig).toBeNull();
    expect(task.location).toBeNull();
  });

  it("creates unique ids for different orders", () => {
    const task1 = getDefaultTask("inbox.md", "Tasks", 0);
    const task2 = getDefaultTask("inbox.md", "Tasks", 1);
    expect(task1.id).not.toBe(task2.id);
  });
});
