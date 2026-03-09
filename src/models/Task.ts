export type Priority = 1 | 2 | 3 | 4;

export interface RecurrenceRule {
  type: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  /** For weekly: day names (mon, tue, ..., sun). For monthly: day number. */
  on?: string;
}

/** Stamina timer: recovers +1 every N seconds up to max */
export interface StaminaConfig {
  type: "stamina";
  currentValue: number;
  maxValue: number;
  recoveryIntervalSeconds: number;
  lastUpdatedAt: string; // ISO 8601
}

/** Periodic increment: +N at scheduled HH:MM times daily up to max */
export interface PeriodicIncrementConfig {
  type: "periodic";
  currentValue: number;
  maxValue: number;
  incrementAmount: number;
  scheduleTimes: string[]; // ["06:00", "12:00", "18:00"]
  lastUpdatedAt: string; // ISO 8601
}

export type TimerConfig = StaminaConfig | PeriodicIncrementConfig;

export interface Task {
  id: string;
  content: string;
  completed: boolean;
  priority: Priority;
  /** 期限日 (due date) — タスクの締め切り */
  dueDate: string | null;
  /** 期限時刻 "HH:MM" */
  dueTime: string | null;
  /** 予定日 (scheduled date) — 取り組む予定の日 */
  scheduledDate: string | null;
  /** 予定時刻 "HH:MM" */
  scheduledTime: string | null;
  /** 開始日 (start date) — タスクが有効になる日 */
  startDate: string | null;
  /** 開始時刻 "HH:MM" */
  startTime: string | null;
  /** 完了日 (done date) — 自動付与 */
  doneDate: string | null;
  recurrence: RecurrenceRule | null;
  labels: string[];
  /** Sub-items as raw markdown lines (indented content below the task) */
  children: string[];
  /** File path relative to vault root */
  projectPath: string;
  /** Section heading within the file */
  section: string;
  /** Order within the section */
  order: number;
  /** Indentation level (0 = top-level, 1 = subtask) */
  indent: number;
  /** 場所 — URL, 住所, 座標など */
  location: string | null;
  /** Parent task ID if this is a subtask */
  parentId: string | null;
  /** Timer configuration for stamina / periodic-increment */
  timerConfig: TimerConfig | null;
}

export function createTaskId(projectPath: string, section: string, order: number): string {
  return `${projectPath}::${section}::${order}`;
}

export function getDefaultTask(projectPath: string, section: string, order: number): Task {
  return {
    id: createTaskId(projectPath, section, order),
    content: "",
    completed: false,
    priority: 4,
    dueDate: null,
    dueTime: null,
    scheduledDate: null,
    scheduledTime: null,
    startDate: null,
    startTime: null,
    doneDate: null,
    recurrence: null,
    labels: [],
    location: null,
    children: [],
    projectPath,
    section,
    order,
    indent: 0,
    parentId: null,
    timerConfig: null,
  };
}
