import { h } from "preact";
import { useState, useCallback, useMemo } from "preact/hooks";
import { FileWatcher } from "../../store/FileWatcher";
import { parseNaturalLanguage } from "../../parser/NaturalLanguageParser";
import { getDateLabel } from "../../utils/DateUtils";

interface TaskInlineAddProps {
  fileWatcher: FileWatcher;
  projectPath: string;
  section: string;
}

export function TaskInlineAdd({ fileWatcher, projectPath, section }: TaskInlineAddProps) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");

  const parsed = useMemo(() => {
    if (!content.trim()) return null;
    return parseNaturalLanguage(content);
  }, [content]);

  const handleAdd = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    await fileWatcher.addTask(projectPath, section, trimmed);
    setContent("");
  }, [content, fileWatcher, projectPath, section]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
      if (e.key === "Escape") {
        setEditing(false);
        setContent("");
      }
    },
    [handleAdd]
  );

  if (!editing) {
    return (
      <div class="tasklens-inline-add" onClick={() => setEditing(true)}>
        <span class="tasklens-inline-add-icon">+</span>
        <span class="tasklens-inline-add-text">タスクを追加</span>
      </div>
    );
  }

  return (
    <div class="tasklens-inline-add-form">
      <input
        type="text"
        class="tasklens-input tasklens-inline-add-input"
        value={content}
        onInput={(e) => setContent((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!content.trim()) setEditing(false);
        }}
        placeholder="タスク名を入力（例: 3/10 に買い物、明日 レポート提出）"
        autoFocus
      />
      {parsed && (parsed.dueDate || parsed.scheduledDate || parsed.startDate || parsed.priority !== 4 || parsed.labels.length > 0) && (
        <div class="tasklens-nlp-preview">
          <span class="tasklens-nlp-preview-label">解析結果:</span>
          <span class="tasklens-nlp-preview-content">{parsed.content}</span>
          {parsed.dueDate && (
            <span
              class="tasklens-nlp-preview-chip"
              style={{ color: getDateLabel(parsed.dueDate).color }}
            >
              📅 {parsed.dueDate}{parsed.dueTime ? ` ${parsed.dueTime}` : ""}
            </span>
          )}
          {parsed.scheduledDate && (
            <span class="tasklens-nlp-preview-chip" style={{ color: "#692fc2" }}>
              ⏳ {parsed.scheduledDate}{parsed.scheduledTime ? ` ${parsed.scheduledTime}` : ""}
            </span>
          )}
          {parsed.startDate && (
            <span class="tasklens-nlp-preview-chip" style={{ color: "#808080" }}>
              🛫 {parsed.startDate}{parsed.startTime ? ` ${parsed.startTime}` : ""}
            </span>
          )}
          {parsed.priority !== 4 && (
            <span class="tasklens-nlp-preview-chip">P{parsed.priority}</span>
          )}
          {parsed.labels.map((l) => (
            <span key={l} class="tasklens-nlp-preview-chip">#{l}</span>
          ))}
        </div>
      )}
      <div class="tasklens-inline-add-actions">
        <button class="tasklens-btn tasklens-btn-primary" onClick={handleAdd}>
          追加
        </button>
        <button
          class="tasklens-btn"
          onClick={() => {
            setEditing(false);
            setContent("");
          }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
