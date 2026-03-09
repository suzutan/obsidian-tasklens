import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { parseNaturalLanguage } from "../../parser/NaturalLanguageParser";
import type { FileWatcher } from "../../store/FileWatcher";
import type { TaskStore } from "../../store/TaskStore";
import { getDateLabel } from "../../utils/DateUtils";
import { applyTagSuggestion, getTagSuggestions, type TagSuggestState } from "../../utils/TagSuggest";

interface TaskInlineAddProps {
  fileWatcher: FileWatcher;
  store: TaskStore;
  projectPath: string;
  section: string;
}

export function TaskInlineAdd({ fileWatcher, store, projectPath, section }: TaskInlineAddProps) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [tagState, setTagState] = useState<TagSuggestState | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    if (!content.trim()) return null;
    return parseNaturalLanguage(content);
  }, [content]);

  const handleAdd = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    await fileWatcher.addTask(projectPath, section, trimmed);
    setContent("");
    setTagState(null);
  }, [content, fileWatcher, projectPath, section]);

  const updateTagSuggestions = useCallback(
    (text: string) => {
      const el = inputRef.current;
      if (!el) {
        setTagState(null);
        return;
      }
      const cursor = el.selectionStart ?? text.length;
      const allLabels = store.allLabels.value;
      const state = getTagSuggestions(text, cursor, allLabels);
      setTagState(state);
      setSelectedIdx(0);
    },
    [store],
  );

  const handleInput = useCallback(
    (e: Event) => {
      const val = (e.target as HTMLInputElement).value;
      setContent(val);
      updateTagSuggestions(val);
    },
    [updateTagSuggestions],
  );

  const selectTag = useCallback(
    (label: string) => {
      if (!tagState || !inputRef.current) return;
      const cursor = inputRef.current.selectionStart ?? content.length;
      const result = applyTagSuggestion(content, cursor, tagState, label);
      setContent(result.text);
      setTagState(null);
      // Restore cursor position
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(result.newCursorPos, result.newCursorPos);
        }
      });
    },
    [content, tagState],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Tag suggestion navigation
      if (tagState && tagState.suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIdx((i) => Math.min(i + 1, tagState.suggestions.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIdx((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          selectTag(tagState.suggestions[selectedIdx]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setTagState(null);
          return;
        }
      }

      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
      if (e.key === "Escape") {
        setEditing(false);
        setContent("");
        setTagState(null);
      }
    },
    [handleAdd, tagState, selectedIdx, selectTag],
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
      <div class="tasklens-tag-suggest-wrapper">
        <input
          ref={inputRef}
          type="text"
          class="tasklens-input tasklens-inline-add-input"
          value={content}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onClick={() => updateTagSuggestions(content)}
          onBlur={() => {
            // Delay so click on suggestion works
            setTimeout(() => {
              setTagState(null);
              if (!content.trim()) setEditing(false);
            }, 150);
          }}
          placeholder="タスク名を入力（例: 買い物 {3/12 19:00} #countdown p1）"
        />
        {tagState && tagState.suggestions.length > 0 && (
          <div class="tasklens-tag-suggest-dropdown">
            {tagState.suggestions.map((label, i) => (
              <div
                key={label}
                class={`tasklens-tag-suggest-item ${i === selectedIdx ? "tasklens-tag-suggest-item--active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectTag(label);
                }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                #{label}
              </div>
            ))}
          </div>
        )}
      </div>
      {parsed &&
        (parsed.dueDate ||
          parsed.scheduledDate ||
          parsed.startDate ||
          parsed.priority !== 4 ||
          parsed.labels.length > 0) && (
          <div class="tasklens-nlp-preview">
            <span class="tasklens-nlp-preview-label">解析結果:</span>
            <span class="tasklens-nlp-preview-content">{parsed.content}</span>
            {parsed.dueDate && (
              <span class="tasklens-nlp-preview-chip" style={{ color: getDateLabel(parsed.dueDate).color }}>
                📅 {parsed.dueDate}
                {parsed.dueTime ? ` ${parsed.dueTime}` : ""}
              </span>
            )}
            {parsed.scheduledDate && (
              <span class="tasklens-nlp-preview-chip" style={{ color: "#4fc3f7" }}>
                ⏳ {parsed.scheduledDate}
                {parsed.scheduledTime ? ` ${parsed.scheduledTime}` : ""}
              </span>
            )}
            {parsed.startDate && (
              <span class="tasklens-nlp-preview-chip" style={{ color: "#808080" }}>
                🛫 {parsed.startDate}
                {parsed.startTime ? ` ${parsed.startTime}` : ""}
              </span>
            )}
            {parsed.priority !== 4 && <span class="tasklens-nlp-preview-chip">P{parsed.priority}</span>}
            {parsed.labels.map((l) => (
              <span key={l} class="tasklens-nlp-preview-chip">
                #{l}
              </span>
            ))}
          </div>
        )}
      <div class="tasklens-inline-add-actions">
        <button type="button" class="tasklens-btn tasklens-btn-primary" onClick={handleAdd}>
          追加
        </button>
        <button
          type="button"
          class="tasklens-btn"
          onClick={() => {
            setEditing(false);
            setContent("");
            setTagState(null);
          }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
