import type { RecurrenceRule } from "../../models/Task";
import { getDateLabel } from "../../utils/DateUtils";

interface DateChipProps {
  dueDate: string;
  dueTime?: string | null;
  recurrence?: RecurrenceRule | null;
}

export function DateChip({ dueDate, dueTime, recurrence }: DateChipProps) {
  const label = getDateLabel(dueDate);

  return (
    <span
      class={`tasklens-date-chip ${label.isOverdue ? "tasklens-date-chip--overdue" : ""}`}
      style={{ color: label.color }}
    >
      {recurrence && <span class="tasklens-date-chip-repeat">🔁 </span>}
      {label.text}
      {dueTime && <span class="tasklens-date-chip-time"> {dueTime}</span>}
    </span>
  );
}
