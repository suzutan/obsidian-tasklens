import { h } from "preact";

interface LabelBadgeProps {
  label: string;
  onClick?: () => void;
}

export function LabelBadge({ label, onClick }: LabelBadgeProps) {
  return (
    <span class="tasklens-label-badge" onClick={onClick}>
      #{label}
    </span>
  );
}
