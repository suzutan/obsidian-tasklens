import type { Priority } from "../../models/Task";

interface PriorityFlagProps {
  priority: Priority;
}

const PRIORITY_LABELS: Record<Priority, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  1: "#d1453b",
  2: "#eb8909",
  3: "#246fe0",
  4: "#808080",
};

export function PriorityFlag({ priority }: PriorityFlagProps) {
  if (priority === 4) return null;

  return (
    <span class="tasklens-priority-flag" style={{ color: PRIORITY_COLORS[priority] }}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
