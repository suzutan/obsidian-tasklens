import { Task } from "../models/Task";
import { today, addDays } from "../utils/DateUtils";

export class TaskIndex {
  /**
   * Get tasks due today or overdue (not completed)
   */
  static getTodayTasks(tasks: Map<string, Task>): Task[] {
    const todayStr = today();
    const result: Task[] = [];
    for (const task of tasks.values()) {
      if (task.completed) continue;
      if (task.dueDate && task.dueDate <= todayStr) {
        result.push(task);
      }
    }
    return result.sort((a, b) => {
      // Overdue first, then by priority
      if (a.dueDate! < todayStr && b.dueDate! >= todayStr) return -1;
      if (b.dueDate! < todayStr && a.dueDate! >= todayStr) return 1;
      return a.priority - b.priority;
    });
  }

  /**
   * Get upcoming tasks grouped by date (next 14 days)
   */
  static getUpcomingTasks(tasks: Map<string, Task>, days: number = 14): Map<string, Task[]> {
    const todayStr = today();
    const endDate = addDays(todayStr, days);
    const grouped = new Map<string, Task[]>();

    for (const task of tasks.values()) {
      if (task.completed) continue;
      if (!task.dueDate) continue;
      if (task.dueDate > todayStr && task.dueDate <= endDate) {
        if (!grouped.has(task.dueDate)) {
          grouped.set(task.dueDate, []);
        }
        grouped.get(task.dueDate)!.push(task);
      }
    }

    // Sort each group by priority
    for (const [, tasks] of grouped) {
      tasks.sort((a, b) => a.priority - b.priority);
    }

    // Sort by date
    return new Map(Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)));
  }

  /**
   * Get tasks by label
   */
  static getTasksByLabel(tasks: Map<string, Task>, label: string): Task[] {
    const result: Task[] = [];
    for (const task of tasks.values()) {
      if (task.completed) continue;
      if (task.labels.includes(label)) {
        result.push(task);
      }
    }
    return result.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Search tasks by content
   */
  static searchTasks(tasks: Map<string, Task>, query: string): Task[] {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    const result: Task[] = [];
    for (const task of tasks.values()) {
      if (task.content.toLowerCase().includes(lower)) {
        result.push(task);
      }
    }
    return result;
  }
}
