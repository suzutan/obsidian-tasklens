export function today(): string {
  return formatDate(new Date());
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

export type DateLabel = {
  text: string;
  color: string;
  isOverdue: boolean;
};

const DAY_NAMES_JA = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

export function getDateLabel(dueDate: string): DateLabel {
  const todayStr = today();
  const diff = daysBetween(todayStr, dueDate);
  const d = new Date(`${dueDate}T00:00:00`);
  const currentYear = new Date().getFullYear();
  const dateYear = d.getFullYear();
  const showYear = dateYear !== currentYear;

  if (diff < 0) {
    // 期限切れ: show actual date so user can see why
    const dateText = showYear
      ? `${dateYear}年${d.getMonth() + 1}月${d.getDate()}日`
      : `${d.getMonth() + 1}月${d.getDate()}日`;
    return { text: `期限切れ ${dateText}`, color: "#d1453b", isOverdue: true };
  }
  if (diff === 0) {
    return { text: "今日", color: "#058527", isOverdue: false };
  }
  if (diff === 1) {
    return { text: "明日", color: "#eb8909", isOverdue: false };
  }
  if (diff <= 6) {
    return { text: DAY_NAMES_JA[d.getDay()], color: "#4fc3f7", isOverdue: false };
  }

  // Format as "M月D日" or "YYYY年M月D日"
  const text = showYear
    ? `${dateYear}年${d.getMonth() + 1}月${d.getDate()}日`
    : `${d.getMonth() + 1}月${d.getDate()}日`;
  return { text, color: "#808080", isOverdue: false };
}

export function formatDateTimeForFrontmatter(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}
