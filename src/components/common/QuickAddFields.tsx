import { useState } from "preact/hooks";
import { RECURRENCE_PRESETS, recurrenceToDisplayText } from "../../models/RecurrenceRule";
import type { Priority, RecurrenceRule } from "../../models/Task";
import { DatePicker } from "./DatePicker";

export interface QuickAddFieldValues {
  priority: Priority;
  dueDate: string | null;
  dueTime: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startDate: string | null;
  startTime: string | null;
  labels: string[];
  recurrence: RecurrenceRule | null;
}

interface QuickAddFieldsProps {
  values: QuickAddFieldValues;
  onChange: (values: QuickAddFieldValues) => void;
  allLabels: string[];
}

const PRIORITY_COLORS: Record<number, string> = {
  1: "#d1453b",
  2: "#eb8909",
  3: "#246fe0",
  4: "#808080",
};

export function QuickAddFields({ values, onChange, allLabels }: QuickAddFieldsProps) {
  const [labelInput, setLabelInput] = useState("");
  const [editingRecurrence, setEditingRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceRule["type"]>(values.recurrence?.type || "daily");
  const [recurrenceInterval, setRecurrenceInterval] = useState(values.recurrence?.interval || 1);
  const [recurrenceOn, setRecurrenceOn] = useState(values.recurrence?.on || "");
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [scheduledDateOpen, setScheduledDateOpen] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);

  const update = (patch: Partial<QuickAddFieldValues>) => {
    onChange({ ...values, ...patch });
  };

  const handleAddLabel = () => {
    const label = labelInput.trim().replace(/^#/, "");
    if (!label || values.labels.includes(label)) {
      setLabelInput("");
      return;
    }
    update({ labels: [...values.labels, label] });
    setLabelInput("");
  };

  const handleRemoveLabel = (label: string) => {
    update({ labels: values.labels.filter((l) => l !== label) });
  };

  const handleRecurrencePreset = (preset: (typeof RECURRENCE_PRESETS)[number]) => {
    update({ recurrence: preset.rule });
    setEditingRecurrence(false);
    if (preset.rule) {
      setRecurrenceType(preset.rule.type);
      setRecurrenceInterval(preset.rule.interval);
      setRecurrenceOn(preset.rule.on || "");
    }
  };

  const handleRecurrenceSave = () => {
    const rule: RecurrenceRule = {
      type: recurrenceType,
      interval: recurrenceInterval,
      on: recurrenceOn || undefined,
    };
    update({ recurrence: rule });
    setEditingRecurrence(false);
  };

  // Filter label suggestions
  const labelSuggestions =
    labelInput.trim().length > 0
      ? allLabels.filter((l) => l.toLowerCase().includes(labelInput.trim().toLowerCase()) && !values.labels.includes(l))
      : [];

  return (
    <div class="tasklens-quickadd-fields">
      {/* Priority */}
      <div class="tasklens-quickadd-field-group">
        <span class="tasklens-quickadd-field-label">優先度</span>
        <div class="tasklens-detail-priority-group">
          {([1, 2, 3, 4] as Priority[]).map((p) => (
            <button
              type="button"
              key={p}
              class={`tasklens-priority-btn ${values.priority === p ? "tasklens-priority-btn--active" : ""}`}
              onClick={() => update({ priority: p })}
              data-priority={p}
            >
              <span class="tasklens-priority-flag" style={{ color: PRIORITY_COLORS[p] }}>
                ⚑
              </span>{" "}
              P{p}
            </button>
          ))}
        </div>
      </div>

      {/* Dates row */}
      <div class="tasklens-quickadd-dates-row">
        {/* Start date */}
        <div class="tasklens-quickadd-field-group tasklens-quickadd-date-field">
          <div class="tasklens-quickadd-field-label-row">
            <span class="tasklens-quickadd-field-label">開始日</span>
            {!values.startDate && (
              <button type="button" class="tasklens-detail-field-add" onClick={() => setStartDateOpen(true)}>
                +
              </button>
            )}
          </div>
          <DatePicker
            icon="🛫"
            label=""
            value={values.startDate}
            time={values.startTime}
            onChange={(d, t) => {
              update({ startDate: d, startTime: t });
              setStartDateOpen(false);
            }}
            externalOpen={startDateOpen}
            onOpenChange={setStartDateOpen}
          />
        </div>

        {/* Scheduled date */}
        <div class="tasklens-quickadd-field-group tasklens-quickadd-date-field">
          <div class="tasklens-quickadd-field-label-row">
            <span class="tasklens-quickadd-field-label">予定日</span>
            {!values.scheduledDate && (
              <button type="button" class="tasklens-detail-field-add" onClick={() => setScheduledDateOpen(true)}>
                +
              </button>
            )}
          </div>
          <DatePicker
            icon="⏳"
            label=""
            value={values.scheduledDate}
            time={values.scheduledTime}
            onChange={(d, t) => {
              update({ scheduledDate: d, scheduledTime: t });
              setScheduledDateOpen(false);
            }}
            externalOpen={scheduledDateOpen}
            onOpenChange={setScheduledDateOpen}
          />
        </div>

        {/* Due date */}
        <div class="tasklens-quickadd-field-group tasklens-quickadd-date-field">
          <div class="tasklens-quickadd-field-label-row">
            <span class="tasklens-quickadd-field-label">期限</span>
            {!values.dueDate && (
              <button type="button" class="tasklens-detail-field-add" onClick={() => setDueDateOpen(true)}>
                +
              </button>
            )}
          </div>
          <DatePicker
            icon="📅"
            label=""
            value={values.dueDate}
            time={values.dueTime}
            onChange={(d, t) => {
              update({ dueDate: d, dueTime: t });
              setDueDateOpen(false);
            }}
            externalOpen={dueDateOpen}
            onOpenChange={setDueDateOpen}
          />
        </div>
      </div>

      {/* Labels */}
      <div class="tasklens-quickadd-field-group">
        <span class="tasklens-quickadd-field-label">ラベル</span>
        <div class="tasklens-quickadd-labels">
          {values.labels.map((label) => (
            <span key={label} class="tasklens-label-badge tasklens-label-badge--removable">
              #{label}
              <button type="button" class="tasklens-label-remove" onClick={() => handleRemoveLabel(label)}>
                ✕
              </button>
            </span>
          ))}
          <div class="tasklens-quickadd-label-input-wrapper">
            <input
              type="text"
              class="tasklens-input tasklens-input--small"
              value={labelInput}
              placeholder="ラベル名"
              onInput={(e) => setLabelInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddLabel();
                }
              }}
            />
            <button type="button" class="tasklens-btn tasklens-btn--small" onClick={handleAddLabel}>
              追加
            </button>
          </div>
          {labelSuggestions.length > 0 && (
            <div class="tasklens-quickadd-label-suggestions">
              {labelSuggestions.slice(0, 5).map((l) => (
                <button
                  type="button"
                  key={l}
                  class="tasklens-quickadd-label-suggestion"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    update({ labels: [...values.labels, l] });
                    setLabelInput("");
                  }}
                >
                  #{l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recurrence */}
      <div class="tasklens-quickadd-field-group">
        <div class="tasklens-quickadd-field-label-row">
          <span class="tasklens-quickadd-field-label">繰り返し</span>
          {values.recurrence && !editingRecurrence && (
            <button
              type="button"
              class="tasklens-detail-field-add"
              onClick={() => {
                update({ recurrence: null });
              }}
              title="解除"
            >
              ✕
            </button>
          )}
        </div>
        {!editingRecurrence && values.recurrence && (
          <div class="tasklens-quickadd-recurrence-display" onClick={() => setEditingRecurrence(true)}>
            <span>🔁</span>
            <span>{recurrenceToDisplayText(values.recurrence)}</span>
          </div>
        )}
        {!editingRecurrence && !values.recurrence && (
          <div class="tasklens-recurrence-presets">
            {RECURRENCE_PRESETS.filter((p) => p.rule !== null).map((preset) => (
              <button
                type="button"
                key={preset.label}
                class="tasklens-btn tasklens-btn--small"
                onClick={() => handleRecurrencePreset(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
        {editingRecurrence && (
          <div class="tasklens-detail-recurrence-editor">
            <div class="tasklens-recurrence-presets">
              {RECURRENCE_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  class="tasklens-btn tasklens-btn--small"
                  onClick={() => handleRecurrencePreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div class="tasklens-recurrence-custom">
              <div class="tasklens-recurrence-row">
                <select
                  class="tasklens-select"
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType((e.target as HTMLSelectElement).value as RecurrenceRule["type"])}
                >
                  <option value="daily">日</option>
                  <option value="weekly">週</option>
                  <option value="monthly">月</option>
                  <option value="yearly">年</option>
                </select>
                <label class="tasklens-recurrence-interval-label">ごと</label>
                <input
                  type="number"
                  class="tasklens-input tasklens-input--small"
                  value={recurrenceInterval}
                  min={1}
                  max={99}
                  onInput={(e) => setRecurrenceInterval(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                />
                <span class="tasklens-recurrence-interval-label">間隔</span>
              </div>
              {(recurrenceType === "weekly" || recurrenceType === "monthly") && (
                <div class="tasklens-recurrence-row">
                  <label class="tasklens-recurrence-interval-label">
                    {recurrenceType === "weekly" ? "曜日:" : "日:"}
                  </label>
                  {recurrenceType === "weekly" ? (
                    <select
                      class="tasklens-select"
                      value={recurrenceOn}
                      onChange={(e) => setRecurrenceOn((e.target as HTMLSelectElement).value)}
                    >
                      <option value="">指定なし</option>
                      <option value="mon">月曜</option>
                      <option value="tue">火曜</option>
                      <option value="wed">水曜</option>
                      <option value="thu">木曜</option>
                      <option value="fri">金曜</option>
                      <option value="sat">土曜</option>
                      <option value="sun">日曜</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      class="tasklens-input tasklens-input--small"
                      value={recurrenceOn}
                      min={1}
                      max={31}
                      placeholder="1-31"
                      onInput={(e) => setRecurrenceOn((e.target as HTMLInputElement).value)}
                    />
                  )}
                </div>
              )}
              <div class="tasklens-recurrence-row">
                <button
                  type="button"
                  class="tasklens-btn tasklens-btn-primary tasklens-btn--small"
                  onClick={handleRecurrenceSave}
                >
                  設定
                </button>
                <button
                  type="button"
                  class="tasklens-btn tasklens-btn--small"
                  onClick={() => setEditingRecurrence(false)}
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
