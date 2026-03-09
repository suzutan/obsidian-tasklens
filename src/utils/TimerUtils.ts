/**
 * Timer utility functions for countdown, elapsed, and countdown-elapsed timers.
 *
 * Timer type is determined by task labels:
 * - #countdown + 📅 dueDate → countdown to due date
 * - #elapsed + 🛫 startDate → elapsed since start date
 * - #countdown-elapsed + 📅 dueDate → countdown before due, elapsed after
 */

export type TimerType = "countdown" | "elapsed" | "countdown-elapsed" | null;

export interface TimerState {
  type: TimerType;
  /** Milliseconds remaining (countdown) or elapsed */
  ms: number;
  /** For countdown-elapsed: current mode */
  mode: "countdown" | "elapsed";
  /** Whether the countdown has expired */
  isExpired: boolean;
  /** Progress ratio 0-1 (for countdown: how much time has passed) */
  progress: number;
}

/**
 * Detect timer type from task labels.
 */
export function getTimerType(labels: string[]): TimerType {
  if (labels.includes("countdown-elapsed")) return "countdown-elapsed";
  if (labels.includes("countdown")) return "countdown";
  if (labels.includes("elapsed")) return "elapsed";
  return null;
}

/**
 * Build a target Date from a date string and optional time string.
 */
function buildDateTime(dateStr: string, timeStr: string | null): Date {
  if (timeStr) {
    return new Date(`${dateStr}T${timeStr}:00`);
  }
  // Default to end of day for due dates, start of day for start dates
  return new Date(`${dateStr}T00:00:00`);
}

/**
 * Compute the current timer state.
 */
export function computeTimerState(
  timerType: TimerType,
  dueDate: string | null,
  dueTime: string | null,
  startDate: string | null,
  startTime: string | null,
  createdAt?: Date
): TimerState | null {
  const now = Date.now();

  switch (timerType) {
    case "countdown": {
      if (!dueDate) return null;
      const target = buildDateTime(dueDate, dueTime).getTime();
      const remaining = target - now;
      const isExpired = remaining <= 0;

      // Progress: from creation to target
      let progress = 0;
      if (createdAt) {
        const total = target - createdAt.getTime();
        if (total > 0) {
          progress = Math.min(1, Math.max(0, (now - createdAt.getTime()) / total));
        }
      }

      return {
        type: "countdown",
        ms: Math.abs(remaining),
        mode: "countdown",
        isExpired,
        progress: isExpired ? 1 : progress,
      };
    }

    case "elapsed": {
      if (!startDate) return null;
      const start = buildDateTime(startDate, startTime).getTime();
      const elapsed = now - start;
      const isPending = elapsed < 0;

      return {
        type: "elapsed",
        ms: Math.abs(elapsed),
        mode: "elapsed",
        isExpired: false,
        progress: 0,
      };
    }

    case "countdown-elapsed": {
      if (!dueDate) return null;
      const target = buildDateTime(dueDate, dueTime).getTime();
      const diff = target - now;
      const isExpired = diff <= 0;

      let progress = 0;
      if (!isExpired && createdAt) {
        const total = target - createdAt.getTime();
        if (total > 0) {
          progress = Math.min(1, Math.max(0, (now - createdAt.getTime()) / total));
        }
      }

      return {
        type: "countdown-elapsed",
        ms: Math.abs(diff),
        mode: isExpired ? "elapsed" : "countdown",
        isExpired,
        progress: isExpired ? 1 : progress,
      };
    }

    default:
      return null;
  }
}

/**
 * Format milliseconds into a human-readable duration string.
 * Examples: "3日 5時間 12分", "2時間 30分 15秒", "45秒"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}日`);
  if (hours > 0) parts.push(`${hours}時間`);
  if (minutes > 0) parts.push(`${minutes}分`);

  // Show seconds only when total duration is less than 1 hour
  if (days === 0 && hours === 0) {
    parts.push(`${seconds}秒`);
  }

  return parts.join(" ") || "0秒";
}

/**
 * Get a color for the timer progress (green → blue → yellow → orange → red).
 */
export function getTimerColor(state: TimerState): string {
  if (state.mode === "elapsed" && state.type !== "countdown-elapsed") {
    return "#246fe0"; // blue for pure elapsed
  }
  if (state.isExpired) {
    return "#d1453b"; // red
  }

  const p = state.progress;
  if (p < 0.25) return "#058527"; // green
  if (p < 0.5) return "#246fe0";  // blue
  if (p < 0.75) return "#eb8909"; // orange
  return "#d1453b";               // red
}
