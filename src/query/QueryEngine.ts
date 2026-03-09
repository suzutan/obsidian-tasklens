import { Task, Priority } from "../models/Task";
import {
  FilterNode,
  ParsedQuery,
  SortRule,
  GroupField,
  PriorityLevel,
  DateField,
  DateOp,
} from "./QueryParser";
import { today, formatDate } from "../utils/DateUtils";

/**
 * Evaluate a parsed query against a list of tasks.
 * Returns filtered, sorted, optionally limited tasks.
 */
export function executeQuery(tasks: Task[], query: ParsedQuery): Task[] {
  let result = tasks;

  // Filter
  if (query.filter) {
    result = result.filter((t) => evaluateFilter(t, query.filter!));
  }

  // Sort
  if (query.sort.length > 0) {
    result = sortTasks(result, query.sort);
  }

  // Limit
  if (query.limit !== null && query.limit > 0) {
    result = result.slice(0, query.limit);
  }

  return result;
}

/**
 * Group tasks by specified field. Returns ordered entries.
 */
export function groupTasks(
  tasks: Task[],
  groupBy: GroupField[]
): { key: string; tasks: Task[] }[] {
  if (groupBy.length === 0) {
    return [{ key: "", tasks }];
  }

  // Use first group field (single-level grouping for now)
  const field = groupBy[0];
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const keys = getGroupKeys(task, field);
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }
  }

  // Sort group keys
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (field === "priority") {
      return priorityOrder(a) - priorityOrder(b);
    }
    if (field === "due") {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    }
    return a.localeCompare(b);
  });

  return sortedKeys.map((key) => ({ key, tasks: groups.get(key)! }));
}

function getGroupKeys(task: Task, field: GroupField): string[] {
  switch (field) {
    case "filename": {
      const parts = task.projectPath.split("/");
      return [parts[parts.length - 1].replace(/\.md$/, "")];
    }
    case "folder": {
      const lastSlash = task.projectPath.lastIndexOf("/");
      return [lastSlash > 0 ? task.projectPath.substring(0, lastSlash) : "(root)"];
    }
    case "path":
      return [task.projectPath];
    case "due":
      return [task.dueDate || "(no due date)"];
    case "priority":
      return [priorityLabel(task.priority)];
    case "heading":
      return [task.section || "(no heading)"];
    case "tags":
      return task.labels.length > 0 ? task.labels.map((l) => `#${l}`) : ["(no tags)"];
  }
}

function priorityLabel(p: Priority): string {
  switch (p) {
    case 1: return "⏫ Highest";
    case 2: return "🔼 High";
    case 3: return "🔽 Low";
    case 4: return "Normal";
  }
}

function priorityOrder(label: string): number {
  if (label.includes("Highest")) return 1;
  if (label.includes("High")) return 2;
  if (label.includes("Low")) return 3;
  return 4;
}

// --- Filter evaluation ---

function evaluateFilter(task: Task, node: FilterNode): boolean {
  switch (node.type) {
    case "done":
      return task.completed;
    case "not_done":
      return !task.completed;
    case "date_filter":
      return evaluateDateFilter(task, node.field, node.op, node.value);
    case "has_date":
      return getDateValue(task, node.field) !== null;
    case "no_date":
      return getDateValue(task, node.field) === null;
    case "priority_is":
      return task.priority === priorityLevelToNumber(node.level);
    case "priority_above":
      return task.priority < priorityLevelToNumber(node.level);
    case "priority_below":
      return task.priority > priorityLevelToNumber(node.level);
    case "path_includes":
      return task.projectPath.toLowerCase().includes(node.text.toLowerCase());
    case "description_includes":
      return task.content.toLowerCase().includes(node.text.toLowerCase());
    case "heading_includes":
      return task.section.toLowerCase().includes(node.text.toLowerCase());
    case "tag_includes": {
      const searchTag = node.tag.toLowerCase().replace(/^#/, "");
      return task.labels.some((l) => l.toLowerCase() === searchTag);
    }
    case "is_recurring":
      return task.recurrence !== null;
    case "not_recurring":
      return task.recurrence === null;
    case "and":
      return evaluateFilter(task, node.left) && evaluateFilter(task, node.right);
    case "or":
      return evaluateFilter(task, node.left) || evaluateFilter(task, node.right);
    case "not":
      return !evaluateFilter(task, node.child);
  }
}

function getDateValue(task: Task, field: DateField): string | null {
  switch (field) {
    case "due": return task.dueDate;
    case "scheduled": return task.scheduledDate;
    case "start": return task.startDate;
    case "done": return task.doneDate;
  }
}

function evaluateDateFilter(
  task: Task,
  field: DateField,
  op: DateOp,
  value: string
): boolean {
  const dateVal = getDateValue(task, field);
  const todayStr = today();

  switch (op) {
    case "today":
      return dateVal === todayStr;
    case "before_today":
      return dateVal !== null && dateVal < todayStr;
    case "after_today":
      return dateVal !== null && dateVal > todayStr;
    case "on":
      return dateVal === value;
    case "before":
      return dateVal !== null && dateVal < value;
    case "after":
      return dateVal !== null && dateVal > value;
  }
}

function priorityLevelToNumber(level: PriorityLevel): Priority {
  switch (level) {
    case "highest": return 1;
    case "high": return 2;
    case "medium": return 3;
    case "low": return 3;
    case "none": return 4;
  }
}

// --- Sorting ---

function sortTasks(tasks: Task[], rules: SortRule[]): Task[] {
  return [...tasks].sort((a, b) => {
    for (const rule of rules) {
      const cmp = compareTasks(a, b, rule);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

function compareTasks(a: Task, b: Task, rule: SortRule): number {
  const dir = rule.direction === "desc" ? -1 : 1;

  switch (rule.field) {
    case "due":
      return compareNullableDates(a.dueDate, b.dueDate) * dir;
    case "scheduled":
      return compareNullableDates(a.scheduledDate, b.scheduledDate) * dir;
    case "start":
      return compareNullableDates(a.startDate, b.startDate) * dir;
    case "done":
      return compareNullableDates(a.doneDate, b.doneDate) * dir;
    case "priority":
      return (a.priority - b.priority) * dir;
    case "path":
      return a.projectPath.localeCompare(b.projectPath) * dir;
    case "description":
      return a.content.localeCompare(b.content) * dir;
  }
}

function compareNullableDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}
