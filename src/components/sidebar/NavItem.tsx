interface NavItemProps {
  icon: string;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}

export function NavItem({ icon, label, count, active, onClick }: NavItemProps) {
  return (
    <div class={`tasklens-nav-item ${active ? "tasklens-nav-item--active" : ""}`} onClick={onClick}>
      <span class="tasklens-nav-icon">{icon}</span>
      <span class="tasklens-nav-label">{label}</span>
      {count !== undefined && count > 0 && <span class="tasklens-nav-count">{count}</span>}
    </div>
  );
}
