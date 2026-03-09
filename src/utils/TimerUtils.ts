/**
 * Timer utility functions for all timer types:
 * - #countdown + 📅 dueDate → countdown to due date
 * - #elapsed + 🛫 startDate → elapsed since start date
 * - #countdown-elapsed + 📅 dueDate → countdown before due, elapsed after
 * - #stamina → recovers +1 every N seconds up to max
 * - #periodic → +N at scheduled HH:MM times up to max
 */

import type { PeriodicIncrementConfig, StaminaConfig } from "../models/Task";

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

/** Computed state for stamina timer */
export interface StaminaState {
  type: "stamina";
  currentValue: number;
  maxValue: number;
  isFull: boolean;
  /** ms until next +1 recovery */
  nextRecoveryMs: number;
  /** ms until fully recovered */
  timeToFullMs: number;
  /** Progress ratio 0-1 */
  progress: number;
}

/** Computed state for periodic increment timer */
export interface PeriodicIncrementState {
  type: "periodic";
  currentValue: number;
  maxValue: number;
  isAtMax: boolean;
  /** Next increment time (Date) or null if at max */
  nextIncrementAt: Date | null;
  /** ms until next increment */
  nextIncrementMs: number;
  /** increment amount */
  incrementAmount: number;
  /** ms until max */
  timeToMaxMs: number;
  /** Progress ratio 0-1 */
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

/** Check if task has a resource timer (stamina or periodic) */
export function hasResourceTimer(labels: string[]): boolean {
  return labels.includes("stamina") || labels.includes("periodic");
}

/**
 * Build a target Date from a date string and optional time string.
 */
function buildDateTime(dateStr: string, timeStr: string | null): Date {
  if (timeStr) {
    return new Date(`${dateStr}T${timeStr}:00`);
  }
  return new Date(`${dateStr}T00:00:00`);
}

/**
 * Compute the current timer state for countdown/elapsed/countdown-elapsed.
 */
export function computeTimerState(
  timerType: TimerType,
  dueDate: string | null,
  dueTime: string | null,
  startDate: string | null,
  startTime: string | null,
  createdAt?: Date,
): TimerState | null {
  const now = Date.now();

  switch (timerType) {
    case "countdown": {
      if (!dueDate) return null;
      const target = buildDateTime(dueDate, dueTime).getTime();
      const remaining = target - now;
      const isExpired = remaining <= 0;

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
 * Compute stamina timer state.
 */
export function computeStaminaState(config: StaminaConfig): StaminaState {
  const now = Date.now();
  const lastUpdated = new Date(config.lastUpdatedAt).getTime();
  const intervalMs = config.recoveryIntervalSeconds * 1000;
  const elapsedMs = now - lastUpdated;

  const recoveries = Math.floor(elapsedMs / intervalMs);
  const currentValue = Math.min(config.currentValue + recoveries, config.maxValue);
  const isFull = currentValue >= config.maxValue;

  let nextRecoveryMs = 0;
  let timeToFullMs = 0;

  if (!isFull) {
    const elapsedInCurrentInterval = elapsedMs % intervalMs;
    nextRecoveryMs = intervalMs - elapsedInCurrentInterval;
    const remaining = config.maxValue - currentValue;
    timeToFullMs = nextRecoveryMs + (remaining - 1) * intervalMs;
  }

  return {
    type: "stamina",
    currentValue,
    maxValue: config.maxValue,
    isFull,
    nextRecoveryMs,
    timeToFullMs,
    progress: currentValue / config.maxValue,
  };
}

/**
 * Compute periodic increment timer state.
 */
export function computePeriodicState(config: PeriodicIncrementConfig): PeriodicIncrementState {
  const now = new Date();
  const lastUpdated = new Date(config.lastUpdatedAt);

  // Count scheduled events between lastUpdated and now
  const eventCount = countScheduledEvents(lastUpdated, now, config.scheduleTimes);
  const totalIncrement = eventCount * config.incrementAmount;
  const currentValue = Math.min(config.currentValue + totalIncrement, config.maxValue);
  const isAtMax = currentValue >= config.maxValue;

  // Find next scheduled time
  let nextIncrementAt: Date | null = null;
  let nextIncrementMs = 0;

  if (!isAtMax) {
    nextIncrementAt = findNextScheduleTime(now, config.scheduleTimes);
    nextIncrementMs = nextIncrementAt ? nextIncrementAt.getTime() - now.getTime() : 0;
  }

  // Compute time to max
  let timeToMaxMs = 0;
  if (!isAtMax && nextIncrementAt) {
    const remaining = config.maxValue - currentValue;
    const eventsNeeded = Math.ceil(remaining / config.incrementAmount);
    timeToMaxMs = computeTimeForNEvents(now, config.scheduleTimes, eventsNeeded);
  }

  return {
    type: "periodic",
    currentValue,
    maxValue: config.maxValue,
    isAtMax,
    nextIncrementAt,
    nextIncrementMs,
    incrementAmount: config.incrementAmount,
    timeToMaxMs,
    progress: currentValue / config.maxValue,
  };
}

/** Count how many scheduled events occurred between start and end */
function countScheduledEvents(start: Date, end: Date, scheduleTimes: string[]): number {
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);

  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);

  while (d <= endDay) {
    for (const timeStr of scheduleTimes) {
      const [h, m] = timeStr.split(":").map(Number);
      const eventTime = new Date(d);
      eventTime.setHours(h, m, 0, 0);

      if (eventTime > start && eventTime <= end) {
        count++;
      }
    }
    d.setDate(d.getDate() + 1);
  }

  return count;
}

/** Find the next scheduled time after now */
function findNextScheduleTime(now: Date, scheduleTimes: string[]): Date | null {
  if (scheduleTimes.length === 0) return null;

  const sorted = [...scheduleTimes].sort();

  // Check remaining times today
  for (const timeStr of sorted) {
    const [h, m] = timeStr.split(":").map(Number);
    const candidate = new Date(now);
    candidate.setHours(h, m, 0, 0);
    if (candidate > now) return candidate;
  }

  // First time tomorrow
  const [h, m] = sorted[0].split(":").map(Number);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(h, m, 0, 0);
  return tomorrow;
}

/** Compute ms until N events have passed from now */
function computeTimeForNEvents(now: Date, scheduleTimes: string[], n: number): number {
  if (n <= 0 || scheduleTimes.length === 0) return 0;

  const sorted = [...scheduleTimes].sort();
  let count = 0;
  const d = new Date(now);

  for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
    const checkDay = new Date(d);
    checkDay.setDate(d.getDate() + dayOffset);

    for (const timeStr of sorted) {
      const [h, m] = timeStr.split(":").map(Number);
      const eventTime = new Date(checkDay);
      eventTime.setHours(h, m, 0, 0);

      if (eventTime > now) {
        count++;
        if (count >= n) {
          return eventTime.getTime() - now.getTime();
        }
      }
    }
  }

  return 0;
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

/** Format a short HH:MM time string from a Date */
export function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  if (p < 0.5) return "#246fe0"; // blue
  if (p < 0.75) return "#eb8909"; // orange
  return "#d1453b"; // red
}

/** Get color for resource timer based on fill ratio (bright, readable on dark bg) */
export function getResourceColor(progress: number): string {
  if (progress >= 0.75) return "#4caf50"; // bright green - mostly full
  if (progress >= 0.5) return "#42a5f5"; // bright blue
  if (progress >= 0.25) return "#ffa726"; // bright orange
  return "#ef5350"; // bright red - nearly empty
}
