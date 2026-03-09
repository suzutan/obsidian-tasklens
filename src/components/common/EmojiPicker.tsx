import { h } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: "よく使う",
    emojis: ["🔍", "📅", "📆", "⚡", "📋", "⏫", "🔼", "🏷", "📥", "⭐", "🎯", "🔥", "💡", "✅", "❌", "⏰", "📌", "🚀", "💪", "🎮"],
  },
  {
    name: "顔",
    emojis: ["😀", "😊", "🤔", "😎", "🥳", "😴", "🤯", "😱", "🥺", "😈"],
  },
  {
    name: "記号",
    emojis: ["❤️", "💜", "💙", "💚", "💛", "🧡", "🤍", "🖤", "⭕", "❗", "❓", "💯", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚪", "⚫"],
  },
  {
    name: "物",
    emojis: ["📁", "📂", "📝", "📎", "🔗", "🔒", "🔑", "🛠", "⚙️", "🧪", "💻", "📱", "🏠", "🏢", "🏦", "🎓", "🎨", "🎵", "📸", "🎬"],
  },
  {
    name: "自然",
    emojis: ["🌟", "⚡", "🔥", "❄️", "🌈", "☀️", "🌙", "⭐", "💧", "🌊", "🌸", "🍀", "🌲", "🍎", "🍕", "☕", "🍺", "🧊", "🎂", "🍰"],
  },
  {
    name: "動物",
    emojis: ["🐶", "🐱", "🐻", "🦊", "🐸", "🐵", "🦄", "🐝", "🦋", "🐙"],
  },
];

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div class="tasklens-emoji-picker" ref={containerRef}>
      <button
        class="tasklens-emoji-picker-trigger"
        onClick={() => setOpen(!open)}
        type="button"
        title="絵文字を選択"
      >
        {value || "🔍"}
      </button>
      {open && (
        <div class="tasklens-emoji-picker-popover">
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.name} class="tasklens-emoji-picker-category">
              <div class="tasklens-emoji-picker-category-name">{cat.name}</div>
              <div class="tasklens-emoji-picker-grid">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    class={`tasklens-emoji-picker-item ${emoji === value ? "tasklens-emoji-picker-item--active" : ""}`}
                    onClick={() => { onChange(emoji); setOpen(false); }}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
