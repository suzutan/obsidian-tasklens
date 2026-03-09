import { signal, computed, batch, Signal } from "@preact/signals";
import { Task, Priority, createTaskId } from "../models/Task";
import { today } from "../utils/DateUtils";
import { parseQuery, ParsedQuery } from "../query/QueryParser";
import { executeQuery, groupTasks } from "../query/QueryEngine";
import { FilterDefinition, BUILT_IN_FILTERS } from "../settings";

export class TaskStore {
  /** All tasks indexed by ID */
  readonly tasks: Signal<Map<string, Task>> = signal(new Map());

  /** File sections indexed by file path */
  readonly fileSections: Signal<Map<string, string[]>> = signal(new Map());

  /** Currently selected view */
  readonly currentView: Signal<ViewType> = signal({ type: "filter", filterId: "__today" });

  /** Currently selected task for detail panel */
  readonly selectedTaskId: Signal<string | null> = signal(null);

  /** Search query */
  readonly searchQuery: Signal<string> = signal("");

  /** Custom filters from settings */
  readonly customFilters: Signal<FilterDefinition[]> = signal([]);

  // All tasks as array (convenience)
  readonly allTasksArray = computed(() => {
    return Array.from(this.tasks.value.values());
  });

  // Today count for badge
  readonly todayCount = computed(() => {
    const todayStr = today();
    let count = 0;
    for (const task of this.tasks.value.values()) {
      if (task.completed) continue;
      const isDueToday = task.dueDate && task.dueDate <= todayStr;
      const isScheduledToday = task.scheduledDate && task.scheduledDate <= todayStr;
      if (isDueToday || isScheduledToday) count++;
    }
    return count;
  });

  readonly overdueCount = computed(() => {
    const todayStr = today();
    let count = 0;
    for (const task of this.tasks.value.values()) {
      if (task.completed) continue;
      if (task.dueDate && task.dueDate < todayStr) count++;
    }
    return count;
  });

  readonly allLabels = computed(() => {
    const labels = new Set<string>();
    for (const task of this.tasks.value.values()) {
      for (const label of task.labels) {
        labels.add(label);
      }
    }
    return Array.from(labels).sort();
  });

  /** All unique source file paths */
  readonly allSourcePaths = computed(() => {
    const paths = new Set<string>();
    for (const task of this.tasks.value.values()) {
      paths.add(task.projectPath);
    }
    return Array.from(paths).sort();
  });

  /** All filters (built-in + custom) */
  readonly allFilters = computed(() => {
    return [...BUILT_IN_FILTERS, ...this.customFilters.value];
  });

  /** Execute a query against all tasks */
  runQuery(queryStr: string): Task[] {
    const parsed = parseQuery(queryStr);
    return executeQuery(this.allTasksArray.value, parsed);
  }

  /** Get filter definition by ID */
  getFilter(filterId: string): FilterDefinition | undefined {
    return this.allFilters.value.find((f) => f.id === filterId);
  }

  /** Get tasks for the currently active view */
  getViewTasks(): Task[] {
    const view = this.currentView.value;
    switch (view.type) {
      case "filter": {
        const filter = this.getFilter(view.filterId);
        if (!filter) return [];
        return this.runQuery(filter.query);
      }
      case "custom_query":
        return this.runQuery(view.query);
      case "label": {
        const q = `tag includes #${view.label}\nnot done\nsort by priority\nsort by due date`;
        return this.runQuery(q);
      }
      case "source": {
        const q = `path includes ${view.path}\nnot done\nsort by priority`;
        return this.runQuery(q);
      }
      default:
        return [];
    }
  }

  getTasksForFile(filePath: string): Task[] {
    const result: Task[] = [];
    for (const task of this.tasks.value.values()) {
      if (task.projectPath === filePath) {
        result.push(task);
      }
    }
    return result.sort((a, b) => a.order - b.order);
  }

  getTasksForSection(filePath: string, section: string): Task[] {
    return this.getTasksForFile(filePath).filter((t) => t.section === section);
  }

  getTaskById(id: string): Task | undefined {
    return this.tasks.value.get(id);
  }

  getSectionsForFile(filePath: string): string[] {
    return this.fileSections.value.get(filePath) || [];
  }

  /** Replace all tasks (used on full reload) */
  setAll(tasks: Task[], fileSectionsMap: Map<string, string[]>): void {
    batch(() => {
      const taskMap = new Map<string, Task>();
      for (const t of tasks) taskMap.set(t.id, t);
      this.tasks.value = taskMap;
      this.fileSections.value = new Map(fileSectionsMap);
    });
  }

  /** Update tasks for a specific file (after file change) */
  updateFileTasks(filePath: string, newTasks: Task[], sections: string[]): void {
    batch(() => {
      const taskMap = new Map(this.tasks.value);
      // Remove old tasks for this file
      for (const [id, task] of taskMap) {
        if (task.projectPath === filePath) {
          taskMap.delete(id);
        }
      }
      // Add new tasks
      for (const t of newTasks) {
        taskMap.set(t.id, t);
      }
      this.tasks.value = taskMap;

      const secMap = new Map(this.fileSections.value);
      secMap.set(filePath, sections);
      this.fileSections.value = secMap;
    });
  }

  /** Update a single task in the store */
  updateTask(task: Task): void {
    const taskMap = new Map(this.tasks.value);
    taskMap.set(task.id, task);
    this.tasks.value = taskMap;
  }

  /** Remove all tasks from a file */
  removeFile(filePath: string): void {
    batch(() => {
      const taskMap = new Map(this.tasks.value);
      for (const [id, task] of taskMap) {
        if (task.projectPath === filePath) {
          taskMap.delete(id);
        }
      }
      this.tasks.value = taskMap;

      const secMap = new Map(this.fileSections.value);
      secMap.delete(filePath);
      this.fileSections.value = secMap;
    });
  }

  selectView(view: ViewType): void {
    this.currentView.value = view;
  }

  selectTask(taskId: string | null): void {
    this.selectedTaskId.value = taskId;
  }

  setCustomFilters(filters: FilterDefinition[]): void {
    this.customFilters.value = filters;
  }
}

export type ViewType =
  | { type: "filter"; filterId: string }
  | { type: "custom_query"; query: string; name?: string }
  | { type: "label"; label: string }
  | { type: "source"; path: string };
