import { RecurrenceRule } from "./Task";

/**
 * Parse recurrence from Obsidian Tasks natural language format:
 * "every day", "every week", "every week on Saturday", "every 2 weeks",
 * "every month", "every month on the 1st", "every year"
 *
 * Also supports compact format for backward compat:
 * "daily", "weekly/sat", "monthly/1", etc.
 */
export function parseRecurrence(raw: string): RecurrenceRule | null {
  if (!raw) return null;

  const lower = raw.toLowerCase().trim();

  // --- Natural language format (Obsidian Tasks) ---

  // "every day" / "every 3 days"
  const dailyMatch = lower.match(/^every\s+(?:(\d+)\s+)?days?$/);
  if (dailyMatch || lower === "every day") {
    return { type: "daily", interval: dailyMatch?.[1] ? parseInt(dailyMatch[1]) : 1 };
  }

  // "every week on Saturday" / "every 2 weeks on Monday" / "every week" / "every 2 weeks"
  const weeklyMatch = lower.match(/^every\s+(?:(\d+)\s+)?weeks?\s*(?:on\s+(\w+))?$/);
  if (weeklyMatch) {
    const rule: RecurrenceRule = {
      type: "weekly",
      interval: weeklyMatch[1] ? parseInt(weeklyMatch[1]) : 1,
    };
    if (weeklyMatch[2]) {
      rule.on = weeklyMatch[2].slice(0, 3); // "saturday" → "sat"
    }
    return rule;
  }

  // "every month on the 1st" / "every 2 months on the 15th" / "every month"
  const monthlyMatch = lower.match(/^every\s+(?:(\d+)\s+)?months?\s*(?:on\s+the\s+(\d+))?/);
  if (monthlyMatch) {
    const rule: RecurrenceRule = {
      type: "monthly",
      interval: monthlyMatch[1] ? parseInt(monthlyMatch[1]) : 1,
    };
    if (monthlyMatch[2]) {
      rule.on = monthlyMatch[2];
    }
    return rule;
  }

  // "every year" / "every 2 years"
  const yearlyMatch = lower.match(/^every\s+(?:(\d+)\s+)?years?$/);
  if (yearlyMatch || lower === "every year") {
    return { type: "yearly", interval: yearlyMatch?.[1] ? parseInt(yearlyMatch[1]) : 1 };
  }

  // --- Compact format (backward compat) ---
  const parts = raw.split("/");
  const type = parts[0] as RecurrenceRule["type"];
  if (!["daily", "weekly", "monthly", "yearly"].includes(type)) return null;

  const rule: RecurrenceRule = { type, interval: 1 };

  if (parts[1]) {
    const num = parseInt(parts[1]);
    if (type === "weekly" && isNaN(num)) {
      rule.on = parts[1];
    } else if (type === "monthly") {
      rule.on = parts[1];
    } else if (type === "daily" && !isNaN(num)) {
      rule.interval = num;
    } else if (type === "weekly" && !isNaN(num)) {
      rule.interval = num;
      if (parts[2]) rule.on = parts[2];
    } else {
      rule.on = parts[1];
    }
  }

  if (parts.length >= 3 && type === "weekly") {
    const num = parseInt(parts[1]);
    if (!isNaN(num)) {
      rule.interval = num;
      rule.on = parts[2];
    }
  }

  return rule;
}

const WEEKDAY_FULL: Record<string, string> = {
  sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday",
};

/**
 * Serialize RecurrenceRule to Obsidian Tasks natural language format:
 * "every day", "every week", "every week on Saturday", "every month on the 1st"
 */
export function serializeRecurrence(rule: RecurrenceRule): string {
  const n = rule.interval;

  switch (rule.type) {
    case "daily":
      return n > 1 ? `every ${n} days` : "every day";
    case "weekly": {
      let base = n > 1 ? `every ${n} weeks` : "every week";
      if (rule.on) {
        const full = WEEKDAY_FULL[rule.on.toLowerCase().slice(0, 3)];
        if (full) base += ` on ${full}`;
      }
      return base;
    }
    case "monthly": {
      let base = n > 1 ? `every ${n} months` : "every month";
      if (rule.on) {
        const day = parseInt(rule.on);
        if (!isNaN(day)) {
          base += ` on the ${ordinal(day)}`;
        }
      }
      return base;
    }
    case "yearly":
      return n > 1 ? `every ${n} years` : "every year";
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Compute the next due date based on recurrence rule
 */
export function getNextDueDate(currentDue: string, rule: RecurrenceRule): string {
  const date = new Date(currentDue + "T00:00:00");

  switch (rule.type) {
    case "daily":
      date.setDate(date.getDate() + rule.interval);
      break;
    case "weekly": {
      date.setDate(date.getDate() + 7 * rule.interval);
      break;
    }
    case "monthly": {
      date.setMonth(date.getMonth() + rule.interval);
      if (rule.on) {
        const day = parseInt(rule.on);
        if (!isNaN(day)) date.setDate(day);
      }
      break;
    }
    case "yearly":
      date.setFullYear(date.getFullYear() + rule.interval);
      break;
  }

  return fmtDate(date);
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// --- Human-readable display ---

const TYPE_LABELS_JA: Record<string, string> = {
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
  yearly: "毎年",
};

const WEEKDAY_LABELS_JA: Record<string, string> = {
  sun: "日", mon: "月", tue: "火", wed: "水", thu: "木", fri: "金", sat: "土",
  sunday: "日", monday: "月", tuesday: "火", wednesday: "水", thursday: "木", friday: "金", saturday: "土",
};

export function recurrenceToDisplayText(rule: RecurrenceRule): string {
  let text = "";

  if (rule.interval > 1) {
    switch (rule.type) {
      case "daily": text = `${rule.interval}日ごと`; break;
      case "weekly": text = `${rule.interval}週ごと`; break;
      case "monthly": text = `${rule.interval}ヶ月ごと`; break;
      case "yearly": text = `${rule.interval}年ごと`; break;
    }
  } else {
    text = TYPE_LABELS_JA[rule.type] || rule.type;
  }

  if (rule.on) {
    const weekday = WEEKDAY_LABELS_JA[rule.on.toLowerCase()];
    if (weekday) {
      text += ` ${weekday}曜日`;
    } else {
      const num = parseInt(rule.on);
      if (!isNaN(num) && rule.type === "monthly") {
        text += ` ${num}日`;
      } else {
        text += ` ${rule.on}`;
      }
    }
  }

  return text;
}

/** All available recurrence presets for the UI */
export interface RecurrencePreset {
  label: string;
  rule: RecurrenceRule | null;
}

export const RECURRENCE_PRESETS: RecurrencePreset[] = [
  { label: "なし", rule: null },
  { label: "毎日", rule: { type: "daily", interval: 1 } },
  { label: "毎週", rule: { type: "weekly", interval: 1 } },
  { label: "隔週", rule: { type: "weekly", interval: 2 } },
  { label: "毎月", rule: { type: "monthly", interval: 1 } },
  { label: "毎年", rule: { type: "yearly", interval: 1 } },
];
