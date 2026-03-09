import type { Priority } from "../../models/Task";

interface TaskCheckboxProps {
  priority: Priority;
  completed: boolean;
  onChange: () => void;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  1: "#d1453b",
  2: "#eb8909",
  3: "#246fe0",
  4: "#808080",
};

export function TaskCheckbox({ priority, completed, onChange }: TaskCheckboxProps) {
  const color = PRIORITY_COLORS[priority];

  return (
    <button
      type="button"
      class={`tasklens-checkbox ${completed ? "tasklens-checkbox--done" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      style={{
        borderColor: color,
        backgroundColor: completed ? color : priority !== 4 ? `${color}20` : "transparent",
      }}
    >
      {completed && (
        <svg viewBox="0 0 16 16" class="tasklens-checkbox-check">
          <path d="M4 8l3 3 5-6" stroke="white" stroke-width="2" fill="none" />
        </svg>
      )}
    </button>
  );
}
