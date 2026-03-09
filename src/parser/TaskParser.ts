import { parseRecurrence } from "../models/RecurrenceRule";
import { getDefaultTask, type Task } from "../models/Task";

/**
 * Parse a single task line in Obsidian Tasks emoji format:
 * - [ ] タスク名 ⏫ 📅 2026-03-31 ⏳ 2026-03-01 🛫 2026-02-01 🔁 every week ✅ 2026-03-08 #label
 */
export function parseTaskLine(
  line: string,
  projectPath: string,
  section: string,
  order: number,
  indent: number = 0,
): Task | null {
  // Match checkbox pattern: - [ ] or - [x]
  const match = line.match(/^(\s*)- \[([ x])\]\s+(.+)$/);
  if (!match) return null;

  const completed = match[2] === "x";
  let rawContent = match[3].trim();

  const task = getDefaultTask(projectPath, section, order);
  task.completed = completed;
  task.indent = indent;

  // Extract emoji metadata from the content

  // Priority
  if (rawContent.includes("⏫")) {
    task.priority = 1;
    rawContent = rawContent.replace(/\s*⏫\s*/g, " ");
  } else if (rawContent.includes("🔼")) {
    task.priority = 2;
    rawContent = rawContent.replace(/\s*🔼\s*/g, " ");
  } else if (rawContent.includes("🔽")) {
    task.priority = 3;
    rawContent = rawContent.replace(/\s*🔽\s*/g, " ");
  }

  // Due date: 📅 YYYY-MM-DD or 📅 YYYY-MM-DDTHH:MM
  const dueMatch = rawContent.match(/📅\s*(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  if (dueMatch) {
    task.dueDate = dueMatch[1];
    task.dueTime = dueMatch[2] || null;
    rawContent = rawContent.replace(/\s*📅\s*\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?\s*/g, " ");
  }

  // Scheduled date: ⏳ YYYY-MM-DD or ⏳ YYYY-MM-DDTHH:MM
  const scheduledMatch = rawContent.match(/⏳\s*(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  if (scheduledMatch) {
    task.scheduledDate = scheduledMatch[1];
    task.scheduledTime = scheduledMatch[2] || null;
    rawContent = rawContent.replace(/\s*⏳\s*\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?\s*/g, " ");
  }

  // Start date: 🛫 YYYY-MM-DD or 🛫 YYYY-MM-DDTHH:MM
  const startMatch = rawContent.match(/🛫\s*(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  if (startMatch) {
    task.startDate = startMatch[1];
    task.startTime = startMatch[2] || null;
    rawContent = rawContent.replace(/\s*🛫\s*\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?\s*/g, " ");
  }

  // Recurrence: 🔁 every ...  (greedy up to next emoji or end)
  const recurMatch = rawContent.match(/🔁\s*(.+?)(?=\s*(?:📅|⏳|🛫|✅|⏫|🔼|🔽|⚡|📈|#\S|$))/);
  if (recurMatch) {
    task.recurrence = parseRecurrence(recurMatch[1].trim());
    rawContent = rawContent.replace(/\s*🔁\s*.+?(?=\s*(?:📅|⏳|🛫|✅|⏫|🔼|🔽|⚡|📈|#\S|$))/g, " ");
  }

  // Done date: ✅ YYYY-MM-DD
  const doneMatch = rawContent.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
  if (doneMatch) {
    task.doneDate = doneMatch[1];
    rawContent = rawContent.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}\s*/g, " ");
  }

  // Stamina timer: ⚡ current/max 🔄 Ns [📌 ISO] (📌 optional, defaults to now)
  const staminaMatch = rawContent.match(/⚡\s*(\d+)\/(\d+)\s*🔄\s*(\d+)s(?:\s*📌\s*(\S+))?/);
  if (staminaMatch) {
    task.timerConfig = {
      type: "stamina",
      currentValue: parseInt(staminaMatch[1], 10),
      maxValue: parseInt(staminaMatch[2], 10),
      recoveryIntervalSeconds: parseInt(staminaMatch[3], 10),
      lastUpdatedAt: staminaMatch[4] || new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    };
    rawContent = rawContent.replace(/\s*⚡\s*\d+\/\d+\s*🔄\s*\d+s(?:\s*📌\s*\S+)?\s*/g, " ");
  }

  // Periodic increment timer: 📈 current/max [+amount] 🕐 HH:MM,HH:MM [📌 ISO]
  // +amount is optional (defaults to 1), 📌 is optional (defaults to now)
  const periodicMatch = rawContent.match(/📈\s*(\d+)\/(\d+)(?:\s*\+(\d+))?\s*🕐\s*([\d:,]+)(?:\s*📌\s*(\S+))?/);
  if (periodicMatch) {
    task.timerConfig = {
      type: "periodic",
      currentValue: parseInt(periodicMatch[1], 10),
      maxValue: parseInt(periodicMatch[2], 10),
      incrementAmount: periodicMatch[3] ? parseInt(periodicMatch[3], 10) : 1,
      scheduleTimes: periodicMatch[4].split(","),
      lastUpdatedAt: periodicMatch[5] || new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    };
    rawContent = rawContent.replace(/\s*📈\s*\d+\/\d+(?:\s*\+\d+)?\s*🕐\s*[\d:,]+(?:\s*📌\s*\S+)?\s*/g, " ");
  }

  // Labels/tags: #tag (but not inside words)
  const tagRegex = /(?:^|\s)#(\S+)/g;
  let tagMatch: RegExpExecArray | null = tagRegex.exec(rawContent);
  while (tagMatch !== null) {
    task.labels.push(tagMatch[1]);
    tagMatch = tagRegex.exec(rawContent);
  }
  rawContent = rawContent.replace(/(?:^|\s)#\S+/g, " ");

  // Auto-add timer labels after label extraction to avoid duplicates
  if (task.timerConfig?.type === "stamina" && !task.labels.includes("stamina")) {
    task.labels.push("stamina");
  }
  if (task.timerConfig?.type === "periodic" && !task.labels.includes("periodic")) {
    task.labels.push("periodic");
  }

  // Clean up remaining content
  task.content = rawContent.replace(/\s+/g, " ").trim();

  // Note mode: content starting with "* " prefix
  if (task.content.startsWith("* ")) {
    task.noteMode = true;
    task.content = task.content.slice(2);
  }

  return task;
}

export interface ParsedFile {
  frontmatter: Record<string, unknown>;
  sections: Map<string, Task[]>;
  sectionOrder: string[];
  rawLines: string[];
}

/**
 * Parse an entire task file into sections and tasks
 */
export function parseTaskFile(content: string, projectPath: string): ParsedFile {
  const lines = content.split("\n");
  const sections = new Map<string, Task[]>();
  const sectionOrder: string[] = [];
  let frontmatter: Record<string, unknown> = {};
  let currentSection = "";
  let inFrontmatter = false;
  let _frontmatterDone = false;
  const frontmatterLines: string[] = [];
  let taskOrder = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle frontmatter
    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---") {
        inFrontmatter = false;
        _frontmatterDone = true;
        frontmatter = parseFrontmatter(frontmatterLines);
        continue;
      }
      frontmatterLines.push(line);
      continue;
    }

    // Skip H1 (file title)
    if (line.match(/^# /)) continue;

    // Section heading (## )
    const sectionMatch = line.match(/^## (.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
        sectionOrder.push(currentSection);
      }
      taskOrder = 0;
      continue;
    }

    // Task line
    const indentMatch = line.match(/^(\s*)/);
    const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;

    const task = parseTaskLine(line, projectPath, currentSection, taskOrder, indentLevel);
    if (task) {
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
        sectionOrder.push(currentSection);
      }
      sections.get(currentSection)?.push(task);
      taskOrder++;
      continue;
    }

    // Indented content below a task (child content)
    if (line.match(/^\s{2,}/) && !line.match(/^\s*- \[/) && currentSection) {
      const sectionTasks = sections.get(currentSection);
      if (sectionTasks && sectionTasks.length > 0) {
        const lastTask = sectionTasks[sectionTasks.length - 1];
        lastTask.children.push(line.trim());
      }
    }
  }

  return { frontmatter, sections, sectionOrder, rawLines: lines };
}

function parseFrontmatter(lines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)?$/);
    if (match) {
      const key = match[1];
      const rawValue: string = match[2]?.trim() ?? "";
      // Handle array notation [a, b]
      if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
        result[key] = rawValue
          .slice(1, -1)
          .split(",")
          .map((s: string) => s.trim());
      } else {
        result[key] = rawValue;
      }
    }
  }
  return result;
}
