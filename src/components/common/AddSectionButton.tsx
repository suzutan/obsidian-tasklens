import { h } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";
import { FileWatcher } from "../../store/FileWatcher";

interface AddSectionButtonProps {
  projectPath: string;
  fileWatcher: FileWatcher;
}

export function AddSectionButton({ projectPath, fileWatcher }: AddSectionButtonProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    await fileWatcher.addSection(projectPath, trimmed);
    setName("");
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        class="tasklens-add-section-btn"
        onClick={() => setEditing(true)}
      >
        <span class="tasklens-add-section-icon">+</span>
        セクションを追加
      </button>
    );
  }

  return (
    <div class="tasklens-add-section-form">
      <input
        ref={inputRef}
        class="tasklens-add-section-input"
        type="text"
        placeholder="セクション名"
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") {
            setName("");
            setEditing(false);
          }
        }}
      />
      <div class="tasklens-add-section-actions">
        <button class="tasklens-btn tasklens-btn-primary tasklens-btn-sm" onClick={handleSubmit}>
          追加
        </button>
        <button
          class="tasklens-btn tasklens-btn-sm"
          onClick={() => {
            setName("");
            setEditing(false);
          }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
