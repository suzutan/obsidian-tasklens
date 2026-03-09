import { h } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import { App, TFile } from "obsidian";
import { TaskStore } from "../../store/TaskStore";
import { FileWatcher } from "../../store/FileWatcher";
import { Task, Priority, RecurrenceRule } from "../../models/Task";
import { TaskCheckbox } from "./TaskCheckbox";
import { RenderContent } from "./TaskItem";
import { DatePicker } from "../common/DatePicker";
import { TimerDisplay } from "../common/TimerDisplay";
import {
  recurrenceToDisplayText,
  RECURRENCE_PRESETS,
} from "../../models/RecurrenceRule";
import { getTimerType } from "../../utils/TimerUtils";
import { parseNaturalLanguage } from "../../parser/NaturalLanguageParser";

interface TaskDetailPanelProps {
  store: TaskStore;
  fileWatcher: FileWatcher;
  app: App;
  taskId: string;
}

export function TaskDetailPanel({ store, fileWatcher, app, taskId }: TaskDetailPanelProps) {
  const task = store.getTaskById(taskId);

  if (!task) {
    return (
      <div class="tasklens-detail-panel">
        <div class="tasklens-empty">タスクが見つかりません</div>
      </div>
    );
  }

  // Display file name as "project" label
  const fileName = task.projectPath.replace(/\.md$/, "").split("/").pop() || task.projectPath;

  const [editingContent, setEditingContent] = useState(false);
  const [contentValue, setContentValue] = useState(task.content);
  const [priorityValue, setPriorityValue] = useState<Priority>(task.priority);
  const [editingRecurrence, setEditingRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState(task.recurrence?.type || "daily");
  const [recurrenceInterval, setRecurrenceInterval] = useState(task.recurrence?.interval || 1);
  const [recurrenceOn, setRecurrenceOn] = useState(task.recurrence?.on || "");
  const [editingLabels, setEditingLabels] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationValue, setLocationValue] = useState(task.location || "");
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [scheduledDateOpen, setScheduledDateOpen] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);

  useEffect(() => {
    setContentValue(task.content);
    setPriorityValue(task.priority);
    setEditingContent(false);
    setEditingRecurrence(false);
    setEditingLabels(false);
    setEditingLocation(false);
    setLocationValue(task.location || "");
    setRecurrenceType(task.recurrence?.type || "daily");
    setRecurrenceInterval(task.recurrence?.interval || 1);
    setRecurrenceOn(task.recurrence?.on || "");
  }, [taskId]);

  const saveField = useCallback(
    async (updates: Partial<Task>) => {
      await fileWatcher.writeTask({ ...task, ...updates });
    },
    [task, fileWatcher]
  );

  const handleSaveContent = async () => {
    const trimmed = contentValue.trim();
    if (!trimmed || trimmed === task.content) {
      setEditingContent(false);
      return;
    }

    // Parse NLP from content (labels, dates, priority, brace dates)
    const parsed = parseNaturalLanguage(trimmed);
    const updates: Partial<Task> = { content: parsed.content };

    // Merge new labels (add, don't replace existing)
    if (parsed.labels.length > 0) {
      const merged = [...new Set([...task.labels, ...parsed.labels])];
      updates.labels = merged;
    }
    if (parsed.dueDate) {
      updates.dueDate = parsed.dueDate;
      updates.dueTime = parsed.dueTime;
    }
    if (parsed.scheduledDate) {
      updates.scheduledDate = parsed.scheduledDate;
      updates.scheduledTime = parsed.scheduledTime;
    }
    if (parsed.startDate) {
      updates.startDate = parsed.startDate;
      updates.startTime = parsed.startTime;
    }
    if (parsed.priority !== 4) {
      updates.priority = parsed.priority;
      setPriorityValue(parsed.priority);
    }

    await saveField(updates);
    setContentValue(parsed.content);
    setEditingContent(false);
  };

  const handlePriorityChange = async (p: Priority) => {
    setPriorityValue(p);
    await saveField({ priority: p });
  };

  const handleToggle = async () => {
    if (task.completed) {
      await fileWatcher.uncompleteTask(task.id);
    } else {
      await fileWatcher.completeTask(task.id);
    }
  };

  const handleRecurrencePreset = async (preset: typeof RECURRENCE_PRESETS[number]) => {
    await saveField({ recurrence: preset.rule });
    setEditingRecurrence(false);
    if (preset.rule) {
      setRecurrenceType(preset.rule.type);
      setRecurrenceInterval(preset.rule.interval);
      setRecurrenceOn(preset.rule.on || "");
    }
  };

  const handleRecurrenceSave = async () => {
    const rule: RecurrenceRule = {
      type: recurrenceType as RecurrenceRule["type"],
      interval: recurrenceInterval,
      on: recurrenceOn || undefined,
    };
    await saveField({ recurrence: rule });
    setEditingRecurrence(false);
  };

  const handleRecurrenceClear = async () => {
    await saveField({ recurrence: null });
    setEditingRecurrence(false);
  };

  const handleAddLabel = async () => {
    const label = labelInput.trim().replace(/^#/, "");
    if (!label) return;
    if (task.labels.includes(label)) { setLabelInput(""); return; }
    await saveField({ labels: [...task.labels, label] });
    setLabelInput("");
  };

  const handleRemoveLabel = async (label: string) => {
    await saveField({ labels: task.labels.filter((l) => l !== label) });
  };

  const handleDeleteTask = async () => {
    await fileWatcher.deleteTask(task.id);
    store.selectTask(null);
  };

  return (
    <div class="tasklens-detail-panel">
      {/* Header bar */}
      <div class="tasklens-detail-header">
        <span
          class="tasklens-detail-header-note"
          onClick={() => {
            const file = app.vault.getAbstractFileByPath(task.projectPath);
            if (file instanceof TFile) {
              app.workspace.getLeaf(false).openFile(file);
            }
          }}
          title={task.projectPath}
        >
          📄 {fileName}
        </span>
        <div class="tasklens-detail-header-actions">
          <button class="tasklens-btn-icon" onClick={handleDeleteTask} title="削除">🗑</button>
          <button class="tasklens-btn-icon" onClick={() => store.selectTask(null)} title="閉じる">✕</button>
        </div>
      </div>

      {/* Two-column body */}
      <div class="tasklens-detail-body">
        {/* Left: task content */}
        <div class="tasklens-detail-left">
          <div class="tasklens-detail-task-header">
            <TaskCheckbox priority={task.priority} completed={task.completed} onChange={handleToggle} />
            {editingContent ? (
              <input
                class="tasklens-input tasklens-detail-title-input"
                value={contentValue}
                onInput={(e) => setContentValue((e.target as HTMLInputElement).value)}
                onBlur={handleSaveContent}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveContent(); }}
                autoFocus
              />
            ) : (
              <span
                class={`tasklens-detail-title ${task.completed ? "tasklens-task-text--done" : ""}`}
                onClick={(e: MouseEvent) => {
                  // Don't enter edit mode if clicking a link
                  if ((e.target as HTMLElement).closest("a, .tasklens-task-wikilink")) return;
                  setEditingContent(true);
                }}
              >
                <RenderContent text={task.content} />
              </span>
            )}
          </div>

          {/* Description / Notes */}
          {task.children.length > 0 && (
            <div class="tasklens-detail-description">
              {task.children.map((child, i) => (
                <div key={i} class="tasklens-detail-child">{child}</div>
              ))}
            </div>
          )}

          {/* Timer display */}
          {getTimerType(task.labels) && (
            <div class="tasklens-detail-timer">
              <TimerDisplay task={task} variant="detail" />
            </div>
          )}

          {/* Done date */}
          {task.doneDate && (
            <div class="tasklens-detail-done">
              完了: {task.doneDate}
            </div>
          )}
        </div>

        {/* Right: metadata fields (TaskLens style) */}
        <div class="tasklens-detail-right">
          {/* Note */}
          <div class="tasklens-detail-field">
            <span class="tasklens-detail-field-label">Note</span>
            <div
              class="tasklens-detail-field-value tasklens-detail-field-value--clickable"
              onClick={() => {
                const file = app.vault.getAbstractFileByPath(task.projectPath);
                if (file instanceof TFile) {
                  app.workspace.getLeaf(false).openFile(file);
                }
              }}
              title={task.projectPath}
            >
              <span class="tasklens-detail-field-icon">📄</span>
              <span class="tasklens-detail-note-link">{fileName}</span>
            </div>
          </div>

          {/* Start date */}
          <div class="tasklens-detail-field">
            <div class="tasklens-detail-field-row">
              <span class="tasklens-detail-field-label">開始日</span>
              <button class="tasklens-detail-field-add" onClick={() => setStartDateOpen(true)} title="設定">+</button>
            </div>
            <DatePicker
              icon="🛫"
              label=""
              value={task.startDate}
              time={task.startTime}
              onChange={(d, t) => { saveField({ startDate: d, startTime: t }); setStartDateOpen(false); }}
              externalOpen={startDateOpen}
              onOpenChange={setStartDateOpen}
            />
          </div>

          {/* Scheduled date */}
          <div class="tasklens-detail-field">
            <div class="tasklens-detail-field-row">
              <span class="tasklens-detail-field-label">予定日</span>
              <button class="tasklens-detail-field-add" onClick={() => setScheduledDateOpen(true)} title="設定">+</button>
            </div>
            <DatePicker
              icon="⏳"
              label=""
              value={task.scheduledDate}
              time={task.scheduledTime}
              onChange={(d, t) => { saveField({ scheduledDate: d, scheduledTime: t }); setScheduledDateOpen(false); }}
              externalOpen={scheduledDateOpen}
              onOpenChange={setScheduledDateOpen}
            />
          </div>

          {/* Due date (期限) */}
          <div class="tasklens-detail-field">
            <div class="tasklens-detail-field-row">
              <span class="tasklens-detail-field-label">期限</span>
              <button class="tasklens-detail-field-add" onClick={() => setDueDateOpen(true)} title="設定">+</button>
            </div>
            <DatePicker
              icon="📅"
              label=""
              value={task.dueDate}
              time={task.dueTime}
              onChange={(d, t) => { saveField({ dueDate: d, dueTime: t }); setDueDateOpen(false); }}
              externalOpen={dueDateOpen}
              onOpenChange={setDueDateOpen}
            />
          </div>

          {/* Priority */}
          <div class="tasklens-detail-field">
            <span class="tasklens-detail-field-label">優先度</span>
            <div class="tasklens-detail-priority-group">
              {([1, 2, 3, 4] as Priority[]).map((p) => {
                const colors: Record<number, string> = { 1: "#d1453b", 2: "#eb8909", 3: "#246fe0", 4: "#808080" };
                return (
                  <button
                    key={p}
                    class={`tasklens-priority-btn ${priorityValue === p ? "tasklens-priority-btn--active" : ""}`}
                    onClick={() => handlePriorityChange(p)}
                    data-priority={p}
                  >
                    <span class="tasklens-priority-flag" style={{ color: colors[p] }}>⚑</span> P{p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Labels */}
          <div class="tasklens-detail-field">
            <div class="tasklens-detail-field-row">
              <span class="tasklens-detail-field-label">ラベル</span>
              <button class="tasklens-detail-field-add" onClick={() => setEditingLabels(true)} title="追加">+</button>
            </div>
            {(task.labels.length > 0 || editingLabels) && (
              <div class="tasklens-detail-labels">
                {task.labels.map((label) => (
                  <span key={label} class="tasklens-label-badge tasklens-label-badge--removable">
                    #{label}
                    <button class="tasklens-label-remove" onClick={() => handleRemoveLabel(label)}>✕</button>
                  </span>
                ))}
                {editingLabels && (
                  <div class="tasklens-label-add-form">
                    <input type="text" class="tasklens-input tasklens-input--small" value={labelInput} placeholder="ラベル名"
                      onInput={(e) => setLabelInput((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddLabel();
                        if (e.key === "Escape") { setEditingLabels(false); setLabelInput(""); }
                      }} autoFocus />
                    <button class="tasklens-btn tasklens-btn--small" onClick={handleAddLabel}>追加</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recurrence */}
          <div class="tasklens-detail-field">
            <div class="tasklens-detail-field-row">
              <span class="tasklens-detail-field-label">繰り返し</span>
              {task.recurrence ? (
                <button class="tasklens-detail-field-add" onClick={handleRecurrenceClear} title="解除">✕</button>
              ) : (
                <button class="tasklens-detail-field-add" onClick={() => setEditingRecurrence(true)} title="設定">+</button>
              )}
            </div>
            {!editingRecurrence && task.recurrence && (
              <div
                class="tasklens-detail-field-value tasklens-detail-field-value--clickable"
                onClick={() => setEditingRecurrence(true)}
              >
                <span class="tasklens-detail-field-icon">🔁</span>
                <span>{recurrenceToDisplayText(task.recurrence)}</span>
              </div>
            )}
            {editingRecurrence && (
              <div class="tasklens-detail-recurrence-editor">
                <div class="tasklens-recurrence-presets">
                  {RECURRENCE_PRESETS.map((preset) => (
                    <button key={preset.label} class="tasklens-btn tasklens-btn--small" onClick={() => handleRecurrencePreset(preset)}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div class="tasklens-recurrence-custom">
                  <div class="tasklens-recurrence-row">
                    <select class="tasklens-select" value={recurrenceType} onChange={(e) => setRecurrenceType((e.target as HTMLSelectElement).value)}>
                      <option value="daily">日</option>
                      <option value="weekly">週</option>
                      <option value="monthly">月</option>
                      <option value="yearly">年</option>
                    </select>
                    <label class="tasklens-recurrence-interval-label">ごと</label>
                    <input type="number" class="tasklens-input tasklens-input--small" value={recurrenceInterval} min={1} max={99}
                      onInput={(e) => setRecurrenceInterval(parseInt((e.target as HTMLInputElement).value) || 1)} />
                    <span class="tasklens-recurrence-interval-label">間隔</span>
                  </div>
                  {(recurrenceType === "weekly" || recurrenceType === "monthly") && (
                    <div class="tasklens-recurrence-row">
                      <label class="tasklens-recurrence-interval-label">{recurrenceType === "weekly" ? "曜日:" : "日:"}</label>
                      {recurrenceType === "weekly" ? (
                        <select class="tasklens-select" value={recurrenceOn} onChange={(e) => setRecurrenceOn((e.target as HTMLSelectElement).value)}>
                          <option value="">指定なし</option>
                          <option value="mon">月曜</option><option value="tue">火曜</option><option value="wed">水曜</option>
                          <option value="thu">木曜</option><option value="fri">金曜</option><option value="sat">土曜</option><option value="sun">日曜</option>
                        </select>
                      ) : (
                        <input type="number" class="tasklens-input tasklens-input--small" value={recurrenceOn} min={1} max={31} placeholder="1-31"
                          onInput={(e) => setRecurrenceOn((e.target as HTMLInputElement).value)} />
                      )}
                    </div>
                  )}
                  <div class="tasklens-recurrence-row">
                    <button class="tasklens-btn tasklens-btn-primary tasklens-btn--small" onClick={handleRecurrenceSave}>設定</button>
                    <button class="tasklens-btn tasklens-btn--small" onClick={() => setEditingRecurrence(false)}>キャンセル</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div class="tasklens-detail-field">
            <div class="tasklens-detail-field-row">
              <span class="tasklens-detail-field-label">位置情報</span>
              <button class="tasklens-detail-field-add" onClick={() => setEditingLocation(true)} title="追加">+</button>
            </div>
            {editingLocation ? (
              <div class="tasklens-location-edit">
                <input
                  class="tasklens-input"
                  value={locationValue}
                  placeholder="URL、住所、座標など"
                  onInput={(e) => setLocationValue((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { saveField({ location: locationValue.trim() || null }); setEditingLocation(false); }
                    if (e.key === "Escape") { setLocationValue(task.location || ""); setEditingLocation(false); }
                  }}
                  autoFocus
                />
                <div class="tasklens-location-edit-actions">
                  <button class="tasklens-btn tasklens-btn-primary tasklens-btn-sm" onClick={() => { saveField({ location: locationValue.trim() || null }); setEditingLocation(false); }}>保存</button>
                  <button class="tasklens-btn tasklens-btn-sm" onClick={() => { setLocationValue(task.location || ""); setEditingLocation(false); }}>キャンセル</button>
                  {task.location && (
                    <button class="tasklens-btn tasklens-btn-sm" onClick={() => { saveField({ location: null }); setLocationValue(""); setEditingLocation(false); }}>削除</button>
                  )}
                </div>
              </div>
            ) : task.location ? (
              <div class="tasklens-detail-field-value">
                <LocationValue value={task.location} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationValue({ value }: { value: string }) {
  const isUrl = /^https?:\/\//.test(value);
  const isGeo = /^geo:/.test(value);
  const isCoords = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(value);

  const openUrl = (url: string) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, "_blank");
  };

  if (isUrl) {
    return (
      <a class="tasklens-location-link" href={value} onClick={openUrl(value)}>
        🔗 {value.replace(/^https?:\/\//, "").split("/")[0]}
      </a>
    );
  }

  if (isGeo) {
    const coords = value.replace("geo:", "");
    const url = `https://www.google.com/maps/search/?api=1&query=${coords}`;
    return <a class="tasklens-location-link" href={url} onClick={openUrl(url)}>📍 {coords}</a>;
  }

  if (isCoords) {
    const url = `https://www.google.com/maps/search/?api=1&query=${value}`;
    return <a class="tasklens-location-link" href={url} onClick={openUrl(url)}>📍 {value}</a>;
  }

  return <span class="tasklens-location-text">📍 {value}</span>;
}
