import { serializeRecurrence } from "../models/RecurrenceRule";
import type { Task, TimerConfig } from "../models/Task";

/**
 * Serialize a Task to Obsidian Tasks emoji format:
 * - [ ] タスク名 ⏫ 🔁 every week 📅 2026-03-31 ⏳ 2026-03-01 🛫 2026-02-01 ✅ 2026-03-08
 */
export function serializeTask(task: Task): string {
  const checkbox = task.completed ? "[x]" : "[ ]";
  const indent = "  ".repeat(task.indent);
  const content = task.noteMode ? `* ${task.content}` : task.content;
  const parts: string[] = [content];

  // Labels/tags
  for (const label of task.labels) {
    parts.push(`#${label}`);
  }

  // Priority emoji
  if (task.priority === 1) {
    parts.push("⏫");
  } else if (task.priority === 2) {
    parts.push("🔼");
  } else if (task.priority === 3) {
    parts.push("🔽");
  }

  // Recurrence
  if (task.recurrence) {
    parts.push(`🔁 ${serializeRecurrence(task.recurrence)}`);
  }

  // Due date
  if (task.dueDate) {
    const time = task.dueTime ? `T${task.dueTime}` : "";
    parts.push(`📅 ${task.dueDate}${time}`);
  }

  // Scheduled date
  if (task.scheduledDate) {
    const time = task.scheduledTime ? `T${task.scheduledTime}` : "";
    parts.push(`⏳ ${task.scheduledDate}${time}`);
  }

  // Start date
  if (task.startDate) {
    const time = task.startTime ? `T${task.startTime}` : "";
    parts.push(`🛫 ${task.startDate}${time}`);
  }

  // Done date
  if (task.doneDate) {
    parts.push(`✅ ${task.doneDate}`);
  }

  // Timer config (inline emoji format)
  if (task.timerConfig) {
    parts.push(serializeTimerConfig(task.timerConfig));
  }

  let result = `${indent}- ${checkbox} ${parts.join(" ")}`;

  // Add children
  for (const child of task.children) {
    result += `\n${indent}  ${child}`;
  }

  return result;
}

/**
 * Serialize timer config to inline emoji format:
 *   ⚡ 120/200 🔄 432s 📌 2026-03-10T06:00:00Z
 *   📈 30/100 +10 🕐 06:00,12:00,18:00 📌 2026-03-09T18:00:00Z
 */
function serializeTimerConfig(config: TimerConfig): string {
  if (config.type === "stamina") {
    return `⚡ ${config.currentValue}/${config.maxValue} 🔄 ${config.recoveryIntervalSeconds}s 📌 ${config.lastUpdatedAt}`;
  }
  const amountPart = config.incrementAmount > 1 ? ` +${config.incrementAmount}` : "";
  return `📈 ${config.currentValue}/${config.maxValue}${amountPart} 🕐 ${config.scheduleTimes.join(",")} 📌 ${config.lastUpdatedAt}`;
}

/**
 * Serialize an entire file with sections and tasks
 */
export function serializeTaskFile(
  frontmatter: Record<string, unknown>,
  title: string,
  description: string | null,
  sectionOrder: string[],
  sections: Map<string, Task[]>,
): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push("---");
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---");
  lines.push("");

  // Title
  lines.push(`# ${title}`);
  lines.push("");

  // Description
  if (description) {
    lines.push(description);
    lines.push("");
  }

  // Sections
  for (const sectionName of sectionOrder) {
    lines.push(`## ${sectionName}`);
    lines.push("");
    const tasks = sections.get(sectionName) || [];
    for (const task of tasks) {
      lines.push(serializeTask(task));
    }
    if (tasks.length > 0) {
      lines.push("");
    }
  }

  return lines.join("\n");
}
