import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { Task } from "../../models/Task";
import {
  getTimerType,
  computeTimerState,
  formatDuration,
  getTimerColor,
  TimerState,
} from "../../utils/TimerUtils";

interface TimerDisplayProps {
  task: Task;
  /** "chip" for task list, "detail" for detail panel */
  variant?: "chip" | "detail";
}

/**
 * Real-time timer display for countdown/elapsed/countdown-elapsed tasks.
 * Updates every second.
 */
export function TimerDisplay({ task, variant = "chip" }: TimerDisplayProps) {
  const timerType = getTimerType(task.labels);
  if (!timerType) return null;

  const [state, setState] = useState<TimerState | null>(null);

  useEffect(() => {
    const update = () => {
      const s = computeTimerState(
        timerType,
        task.dueDate,
        task.dueTime,
        task.startDate,
        task.startTime
      );
      setState(s);
    };

    update();
    const intervalId = setInterval(update, 1000);
    return () => clearInterval(intervalId);
  }, [timerType, task.dueDate, task.dueTime, task.startDate, task.startTime]);

  if (!state) return null;

  const color = getTimerColor(state);
  const duration = formatDuration(state.ms);

  if (variant === "chip") {
    return (
      <span class="tasklens-timer-chip" style={{ color }}>
        <span class="tasklens-timer-icon">
          {state.mode === "countdown" ? (state.isExpired ? "🔴" : "⏱") : "⏱"}
        </span>
        <span class="tasklens-timer-label">
          {getLabel(state)}
        </span>
        <span class="tasklens-timer-value">{duration}</span>
      </span>
    );
  }

  // Detail variant
  const progressPercent = Math.round(state.progress * 100);

  return (
    <div class="tasklens-timer-detail">
      <div class="tasklens-timer-detail-header" style={{ color }}>
        <span class="tasklens-timer-detail-icon">
          {state.mode === "countdown" ? "⏱" : "⏱"}
        </span>
        <span class="tasklens-timer-detail-label">{getLabel(state)}</span>
      </div>
      <div class="tasklens-timer-detail-value" style={{ color }}>
        {duration}
      </div>
      {state.type === "countdown" || (state.type === "countdown-elapsed" && state.mode === "countdown") ? (
        <div class="tasklens-timer-progress">
          <div class="tasklens-timer-progress-bar">
            <div
              class="tasklens-timer-progress-fill"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <span class="tasklens-timer-progress-text">{progressPercent}%</span>
        </div>
      ) : null}
      {state.type === "countdown-elapsed" && (
        <div class="tasklens-timer-detail-sub">
          {state.mode === "countdown"
            ? `UNTIL ${task.dueDate}${task.dueTime ? " " + task.dueTime : ""}`
            : `SINCE ${task.dueDate}${task.dueTime ? " " + task.dueTime : ""}`}
        </div>
      )}
      {state.type === "elapsed" && task.startDate && (
        <div class="tasklens-timer-detail-sub">
          SINCE {task.startDate}{task.startTime ? " " + task.startTime : ""}
        </div>
      )}
    </div>
  );
}

function getLabel(state: TimerState): string {
  switch (state.type) {
    case "countdown":
      return state.isExpired ? "期限切れ " : "残り ";
    case "elapsed":
      return "経過 ";
    case "countdown-elapsed":
      return state.mode === "countdown"
        ? "残り "
        : "経過 ";
    default:
      return "";
  }
}
