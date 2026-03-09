import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { PeriodicIncrementConfig, StaminaConfig, Task } from "../../models/Task";
import {
  computePeriodicState,
  computeStaminaState,
  computeTimerState,
  formatDuration,
  formatTime,
  getResourceColor,
  getTimerColor,
  getTimerType,
  hasResourceTimer,
  type PeriodicIncrementState,
  type StaminaState,
  type TimerState,
} from "../../utils/TimerUtils";

interface TimerDisplayProps {
  task: Task;
  /** "chip" for task list, "detail" for detail panel */
  variant?: "chip" | "detail";
  /** Callback to persist timer config changes (for value adjustments) */
  onUpdateTimerConfig?: (config: Task["timerConfig"]) => void;
}

/** Format ms-from-now as an absolute time string like "3/10 15:30" */
function formatAbsoluteTime(ms: number): string {
  const target = new Date(Date.now() + ms);
  const hh = String(target.getHours()).padStart(2, "0");
  const mm = String(target.getMinutes()).padStart(2, "0");
  return `${target.getMonth() + 1}/${target.getDate()} ${hh}:${mm}`;
}

/**
 * Real-time timer display for all timer types.
 * Updates every second.
 */
export function TimerDisplay({ task, variant = "chip", onUpdateTimerConfig }: TimerDisplayProps) {
  const timerType = getTimerType(task.labels);
  const isResource = hasResourceTimer(task.labels);

  if (!timerType && !isResource) return null;

  // Resource timers (stamina / periodic)
  if (isResource && task.timerConfig) {
    if (task.timerConfig.type === "stamina") {
      return <StaminaDisplay config={task.timerConfig} variant={variant} onUpdate={onUpdateTimerConfig} />;
    }
    if (task.timerConfig.type === "periodic") {
      return <PeriodicDisplay config={task.timerConfig} variant={variant} onUpdate={onUpdateTimerConfig} />;
    }
  }

  // Countdown/elapsed timers
  if (!timerType) return null;
  return <CountdownTimerDisplay task={task} timerType={timerType} variant={variant} />;
}

// --- Countdown/Elapsed/Countdown-Elapsed ---

function CountdownTimerDisplay({
  task,
  timerType,
  variant,
}: {
  task: Task;
  timerType: NonNullable<ReturnType<typeof getTimerType>>;
  variant: "chip" | "detail";
}) {
  const [state, setState] = useState<TimerState | null>(null);

  useEffect(() => {
    const update = () => {
      const s = computeTimerState(timerType, task.dueDate, task.dueTime, task.startDate, task.startTime);
      setState(s);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timerType, task.dueDate, task.dueTime, task.startDate, task.startTime]);

  if (!state) return null;
  const color = getTimerColor(state);
  const duration = formatDuration(state.ms);

  if (variant === "chip") {
    return (
      <span class="tasklens-timer-chip" style={{ color }}>
        <span class="tasklens-timer-icon">{state.isExpired ? "🔴" : "⏱"}</span>
        <span class="tasklens-timer-label">{getCountdownLabel(state)}</span>
        <span class="tasklens-timer-value">{duration}</span>
      </span>
    );
  }

  const progressPercent = Math.round(state.progress * 100);
  return (
    <div class="tasklens-timer-detail">
      <div class="tasklens-timer-detail-header" style={{ color }}>
        <span class="tasklens-timer-detail-icon">⏱</span>
        <span class="tasklens-timer-detail-label">{getCountdownLabel(state)}</span>
      </div>
      <div class="tasklens-timer-detail-value" style={{ color }}>
        {duration}
      </div>
      {(state.type === "countdown" || (state.type === "countdown-elapsed" && state.mode === "countdown")) && (
        <div class="tasklens-timer-progress">
          <div class="tasklens-timer-progress-bar">
            <div
              class="tasklens-timer-progress-fill"
              style={{ width: `${progressPercent}%`, backgroundColor: color }}
            />
          </div>
          <span class="tasklens-timer-progress-text">{progressPercent}%</span>
        </div>
      )}
      {state.type === "countdown-elapsed" && (
        <div class="tasklens-timer-detail-sub">
          {state.mode === "countdown"
            ? `UNTIL ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ""}`
            : `SINCE ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ""}`}
        </div>
      )}
      {state.type === "elapsed" && task.startDate && (
        <div class="tasklens-timer-detail-sub">
          SINCE {task.startDate}
          {task.startTime ? ` ${task.startTime}` : ""}
        </div>
      )}
    </div>
  );
}

function getCountdownLabel(state: TimerState): string {
  switch (state.type) {
    case "countdown":
      return state.isExpired ? "期限切れ " : "残り ";
    case "elapsed":
      return "経過 ";
    case "countdown-elapsed":
      return state.mode === "countdown" ? "残り " : "経過 ";
    default:
      return "";
  }
}

// --- Stamina Timer ---

function StaminaDisplay({
  config,
  variant,
  onUpdate,
}: {
  config: StaminaConfig;
  variant: "chip" | "detail";
  onUpdate?: (config: Task["timerConfig"]) => void;
}) {
  const [state, setState] = useState<StaminaState>(() => computeStaminaState(config));

  useEffect(() => {
    const update = () => setState(computeStaminaState(config));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [config.currentValue, config.maxValue, config.recoveryIntervalSeconds, config.lastUpdatedAt]);

  const color = getResourceColor(state.progress);

  const adjustValue = useCallback(
    (delta: number) => {
      if (!onUpdate) return;
      const now = new Date().toISOString();
      const newVal = Math.max(0, Math.min(state.currentValue + delta, config.maxValue));
      onUpdate({ ...config, currentValue: newVal, lastUpdatedAt: now });
    },
    [config, state.currentValue, onUpdate],
  );

  if (variant === "chip") {
    const fullAt = !state.isFull ? formatAbsoluteTime(state.timeToFullMs) : null;
    return (
      <span class="tasklens-timer-chip" style={{ color }}>
        <span class="tasklens-timer-icon">⚡</span>
        <span class="tasklens-timer-value">
          {state.currentValue}/{state.maxValue} (+1)
        </span>
        {!state.isFull && (
          <>
            <span class="tasklens-timer-sep">|</span>
            <span class="tasklens-timer-sub">{formatDuration(state.nextRecoveryMs)}</span>
          </>
        )}
        {fullAt && (
          <>
            <span class="tasklens-timer-sep">|</span>
            <span class="tasklens-timer-eta">
              全回復 {formatDuration(state.timeToFullMs)} ({fullAt})
            </span>
          </>
        )}
      </span>
    );
  }

  // Detail variant
  const progressPercent = Math.round(state.progress * 100);

  return (
    <div class="tasklens-timer-detail">
      <div class="tasklens-timer-detail-header" style={{ color }}>
        <span class="tasklens-timer-detail-icon">⚡</span>
        <span class="tasklens-timer-detail-label">スタミナ</span>
      </div>
      <div class="tasklens-timer-detail-value" style={{ color }}>
        {state.currentValue} / {state.maxValue}
      </div>
      <div class="tasklens-timer-progress">
        <div class="tasklens-timer-progress-bar">
          <div class="tasklens-timer-progress-fill" style={{ width: `${progressPercent}%`, backgroundColor: color }} />
        </div>
        <span class="tasklens-timer-progress-text">{progressPercent}%</span>
      </div>
      {!state.isFull ? (
        <div class="tasklens-timer-detail-sub">
          次の回復まで {formatDuration(state.nextRecoveryMs)} ・ 全回復まで {formatDuration(state.timeToFullMs)}
        </div>
      ) : (
        <div class="tasklens-timer-detail-sub tasklens-timer-full">全回復済み</div>
      )}
      {onUpdate && (
        <ResourceActions
          currentValue={state.currentValue}
          maxValue={config.maxValue}
          onAdjust={adjustValue}
          onSet={(v) => {
            if (!onUpdate) return;
            onUpdate({ ...config, currentValue: v, lastUpdatedAt: new Date().toISOString() });
          }}
        />
      )}
    </div>
  );
}

// --- Shared Resource Actions ---

function ResourceActions({
  currentValue,
  maxValue,
  onAdjust,
  onSet,
}: {
  currentValue: number;
  maxValue: number;
  onAdjust: (delta: number) => void;
  onSet: (value: number) => void;
}) {
  const [customValue, setCustomValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div class="tasklens-timer-actions">
      <div class="tasklens-timer-actions-row">
        <span class="tasklens-timer-actions-label">消費</span>
        <button
          type="button"
          class="tasklens-btn tasklens-btn--small"
          onClick={() => onAdjust(-1)}
          disabled={currentValue <= 0}
        >
          -1
        </button>
        <button
          type="button"
          class="tasklens-btn tasklens-btn--small"
          onClick={() => onAdjust(-10)}
          disabled={currentValue <= 0}
        >
          -10
        </button>
        <button
          type="button"
          class="tasklens-btn tasklens-btn--small"
          onClick={() => onAdjust(-50)}
          disabled={currentValue <= 0}
        >
          -50
        </button>
      </div>
      <div class="tasklens-timer-actions-row">
        <span class="tasklens-timer-actions-label">回復</span>
        <button
          type="button"
          class="tasklens-btn tasklens-btn--small"
          onClick={() => onAdjust(1)}
          disabled={currentValue >= maxValue}
        >
          +1
        </button>
        <button
          type="button"
          class="tasklens-btn tasklens-btn--small"
          onClick={() => onAdjust(10)}
          disabled={currentValue >= maxValue}
        >
          +10
        </button>
        <button
          type="button"
          class="tasklens-btn tasklens-btn--small"
          onClick={() => onAdjust(50)}
          disabled={currentValue >= maxValue}
        >
          +50
        </button>
      </div>
      <div class="tasklens-timer-actions-row">
        <input
          ref={inputRef}
          type="number"
          class="tasklens-timer-actions-input"
          placeholder="値を直接入力"
          value={customValue}
          min={0}
          max={maxValue}
          onInput={(e) => setCustomValue((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = parseInt(customValue, 10);
              if (!Number.isNaN(v)) {
                onSet(Math.max(0, Math.min(v, maxValue)));
                setCustomValue("");
              }
            }
          }}
        />
        <button
          type="button"
          class="tasklens-btn tasklens-btn--small"
          onClick={() => {
            const v = parseInt(customValue, 10);
            if (!Number.isNaN(v)) {
              onSet(Math.max(0, Math.min(v, maxValue)));
              setCustomValue("");
            }
          }}
        >
          設定
        </button>
        <button type="button" class="tasklens-btn tasklens-btn--small" onClick={() => onSet(0)}>
          0
        </button>
        <button type="button" class="tasklens-btn tasklens-btn--small" onClick={() => onSet(maxValue)}>
          MAX
        </button>
      </div>
    </div>
  );
}

// --- Periodic Increment Timer ---

function PeriodicDisplay({
  config,
  variant,
  onUpdate,
}: {
  config: PeriodicIncrementConfig;
  variant: "chip" | "detail";
  onUpdate?: (config: Task["timerConfig"]) => void;
}) {
  const [state, setState] = useState<PeriodicIncrementState>(() => computePeriodicState(config));

  useEffect(() => {
    const update = () => setState(computePeriodicState(config));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [
    config.currentValue,
    config.maxValue,
    config.incrementAmount,
    config.scheduleTimes.join(","),
    config.lastUpdatedAt,
  ]);

  const color = getResourceColor(state.progress);

  const adjustValue = useCallback(
    (delta: number) => {
      if (!onUpdate) return;
      const now = new Date().toISOString();
      const newVal = Math.max(0, Math.min(state.currentValue + delta, config.maxValue));
      onUpdate({ ...config, currentValue: newVal, lastUpdatedAt: now });
    },
    [config, state.currentValue, onUpdate],
  );

  if (variant === "chip") {
    const maxAt = !state.isAtMax && state.timeToMaxMs > 0 ? formatAbsoluteTime(state.timeToMaxMs) : null;
    return (
      <span class="tasklens-timer-chip" style={{ color }}>
        <span class="tasklens-timer-icon">📈</span>
        <span class="tasklens-timer-value">
          {state.currentValue}/{state.maxValue} (+{state.incrementAmount})
        </span>
        {!state.isAtMax && state.nextIncrementAt && (
          <>
            <span class="tasklens-timer-sep">|</span>
            <span class="tasklens-timer-sub">次 {formatTime(state.nextIncrementAt)}</span>
          </>
        )}
        {maxAt && (
          <>
            <span class="tasklens-timer-sep">|</span>
            <span class="tasklens-timer-eta">
              MAX {formatDuration(state.timeToMaxMs)} ({maxAt})
            </span>
          </>
        )}
      </span>
    );
  }

  // Detail variant
  const progressPercent = Math.round(state.progress * 100);

  return (
    <div class="tasklens-timer-detail">
      <div class="tasklens-timer-detail-header" style={{ color }}>
        <span class="tasklens-timer-detail-icon">📈</span>
        <span class="tasklens-timer-detail-label">定期増加</span>
      </div>
      <div class="tasklens-timer-detail-value" style={{ color }}>
        {state.currentValue} / {state.maxValue}
      </div>
      <div class="tasklens-timer-progress">
        <div class="tasklens-timer-progress-bar">
          <div class="tasklens-timer-progress-fill" style={{ width: `${progressPercent}%`, backgroundColor: color }} />
        </div>
        <span class="tasklens-timer-progress-text">{progressPercent}%</span>
      </div>
      {!state.isAtMax && state.nextIncrementAt ? (
        <div class="tasklens-timer-detail-sub">
          次の増加 {formatTime(state.nextIncrementAt)} (+{state.incrementAmount}) ・ MAX到達まで{" "}
          {formatDuration(state.timeToMaxMs)}
        </div>
      ) : (
        <div class="tasklens-timer-detail-sub tasklens-timer-full">最大値到達</div>
      )}
      <div class="tasklens-timer-detail-sub">スケジュール: {config.scheduleTimes.join(", ")}</div>
      {onUpdate && (
        <ResourceActions
          currentValue={state.currentValue}
          maxValue={config.maxValue}
          onAdjust={adjustValue}
          onSet={(v) => {
            if (!onUpdate) return;
            onUpdate({ ...config, currentValue: v, lastUpdatedAt: new Date().toISOString() });
          }}
        />
      )}
    </div>
  );
}
