import { h } from "preact";
import { getDateLabel } from "../../utils/DateUtils";
import { RecurrenceRule } from "../../models/Task";

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
