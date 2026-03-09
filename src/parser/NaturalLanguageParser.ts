import { Priority } from "../models/Task";
import { today, formatDate } from "../utils/DateUtils";

export interface ParsedInput {
  content: string;
  dueDate: string | null;
  dueTime: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startDate: string | null;
  startTime: string | null;
  priority: Priority;
  labels: string[];
}

/**
 * Parse natural language task input (Japanese + common patterns).
 *
 * Examples:
 *   "3/10 12:00 に買い物"        → due:2026-03-10, dueTime:12:00, content:"買い物"
 *   "明日 牛乳を買う"             → due:tomorrow, content:"牛乳を買う"
 *   "来週月曜 レポート提出"        → due:next monday, content:"レポート提出"
 *   "買い物 p1"                  → priority:1, content:"買い物"
 *   "買い物 #家事"               → labels:["家事"], content:"買い物"
 */
export function parseNaturalLanguage(input: string): ParsedInput {
  let text = input.trim();
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let scheduledDate: string | null = null;
  let scheduledTime: string | null = null;
  let startDate: string | null = null;
  let startTime: string | null = null;
  let priority: Priority = 4;
  const labels: string[] = [];

  // Extract priority: p1, p2, p3, p4 (word boundary)
  text = text.replace(/\bp([1-4])\b/g, (_, p) => {
    priority = parseInt(p) as Priority;
    return "";
  });

  // Extract labels: #xxx
  text = text.replace(/#(\S+)/g, (_, label) => {
    labels.push(label);
    return "";
  });

  // Extract brace-enclosed due date: {YYYY-MM-DD HH:MM} or {YYYY-MM-DD}
  // Also supports {M/D}, {M/D HH:MM}, {M月D日}, {M月D日 HH:MM}
  text = text.replace(/\{([^}]+)\}/g, (_, inner: string) => {
    const trimmed = inner.trim();
    const braceResult = parseBraceDate(trimmed);
    if (braceResult) {
      if (!dueDate) dueDate = braceResult.date;
      if (braceResult.time && !dueTime) dueTime = braceResult.time;
    }
    return "";
  });

  // --- Date extraction ---
  // Natural language dates (3/10, 明日, etc.) → 予定日 (scheduled)
  // Brace dates ({3/10 13:00}) → 期限 (due) — already extracted above
  const result = extractDates(text);
  text = result.remaining;
  if (result.dueDate) {
    // Natural language dates become scheduled date
    if (!scheduledDate) {
      scheduledDate = result.dueDate;
      scheduledTime = result.dueTime;
    }
  }
  if (!scheduledDate && result.scheduledDate) {
    scheduledDate = result.scheduledDate;
    scheduledTime = result.scheduledTime;
  }
  if (!startDate && result.startDate) {
    startDate = result.startDate;
    startTime = result.startTime;
  }

  // Clean up
  text = text.replace(/\s{2,}/g, " ").trim();

  return { content: text, dueDate, dueTime, scheduledDate, scheduledTime, startDate, startTime, priority, labels };
}

interface DateExtractResult {
  remaining: string;
  dueDate: string | null;
  dueTime: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startDate: string | null;
  startTime: string | null;
}

function extractDates(text: string): DateExtractResult {
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let scheduledDate: string | null = null;
  let scheduledTime: string | null = null;
  let startDate: string | null = null;
  let startTime: string | null = null;
  let remaining = text;

  // --- Relative date keywords (Japanese) ---

  // "今日 HH:MM" with time
  {
    const m = /(?:^|\s)今日\s+(\d{1,2}:\d{2})\s*(?:に|まで(?:に)?)?\s*/g.exec(remaining);
    if (m) {
      const d = new Date();
      dueDate = formatDate(d);
      dueTime = normalizeTime(m[1]);
      remaining = remaining.slice(0, m.index) + " " + remaining.slice(m.index + m[0].length);
    }
  }

  // "今日" without time
  if (!dueDate) {
    remaining = tryExtractRelativeDate(remaining, /(?:^|\s)今日\s*(?:の|に|まで(?:に)?)?\s*/g, 0, (d) => {
      dueDate = d;
    }) || remaining;
  }

  // "明日 HH:MM"
  if (!dueDate) {
    const m = /(?:^|\s)明日\s+(\d{1,2}:\d{2})\s*(?:に|まで(?:に)?)?\s*/g.exec(remaining);
    if (m) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dueDate = formatDate(d);
      dueTime = normalizeTime(m[1]);
      remaining = remaining.slice(0, m.index) + " " + remaining.slice(m.index + m[0].length);
    }
  }

  // "明日" without time
  if (!dueDate) {
    remaining = tryExtractRelativeDate(remaining, /(?:^|\s)明日\s*(?:の|に|まで(?:に)?)?\s*/g, 1, (d) => {
      dueDate = d;
    }) || remaining;
  }

  // "明後日"
  if (!dueDate) {
    remaining = tryExtractRelativeDate(remaining, /(?:^|\s)明後日\s*(?:の|に|まで(?:に)?)?\s*/g, 2, (d) => {
      dueDate = d;
    }) || remaining;
  }

  // "今週X曜日" / "今週X曜"
  if (!dueDate) {
    remaining = tryExtractWeekday(remaining, /(?:^|\s)今週\s*([月火水木金土日])曜(?:日)?\s*(?:の|に|まで(?:に)?)?\s*/g, 0, (d) => {
      dueDate = d;
    }) || remaining;
  }

  // "来週X曜日" / "来週X曜"
  if (!dueDate) {
    remaining = tryExtractWeekday(remaining, /(?:^|\s)来週\s*([月火水木金土日])曜(?:日)?\s*(?:の|に|まで(?:に)?)?\s*/g, 1, (d) => {
      dueDate = d;
    }) || remaining;
  }

  // "X曜日" (this week, next occurrence)
  if (!dueDate) {
    remaining = tryExtractWeekday(remaining, /(?:^|\s)([月火水木金土日])曜(?:日)?\s*(?:の|に|まで(?:に)?)?\s*/g, -1, (d) => {
      if (!dueDate) dueDate = d;
    }) || remaining;
  }

  // "来週"
  if (!dueDate) {
    remaining = tryExtractRelativeDate(remaining, /(?:^|\s)来週\s*(?:の|に|まで(?:に)?)?\s*/g, 7, (d) => {
      if (!dueDate) dueDate = d;
    }) || remaining;
  }

  // --- Absolute dates ---

  // "M/D HH:MM に" or "M/D HH:MMに" — date with time
  if (!dueDate) {
    const mdTimeRe = /(?:^|\s)(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})\s*(?:に|まで(?:に)?)?\s*/g;
    const match = mdTimeRe.exec(remaining);
    if (match) {
      const parsed = resolveMonthDay(parseInt(match[1]), parseInt(match[2]));
      if (parsed) {
        dueDate = parsed;
        dueTime = normalizeTime(match[3]);
        remaining = remaining.slice(0, match.index) + " " + remaining.slice(match.index + match[0].length);
      }
    }
  }

  // "M月D日 HH:MM" — Japanese date with time
  if (!dueDate) {
    const jpDateTimeRe = /(?:^|\s)(\d{1,2})月(\d{1,2})日\s+(\d{1,2}:\d{2})\s*(?:に|まで(?:に)?)?\s*/g;
    const match = jpDateTimeRe.exec(remaining);
    if (match) {
      const parsed = resolveMonthDay(parseInt(match[1]), parseInt(match[2]));
      if (parsed) {
        dueDate = parsed;
        dueTime = normalizeTime(match[3]);
        remaining = remaining.slice(0, match.index) + " " + remaining.slice(match.index + match[0].length);
      }
    }
  }

  // "M/D に" or "M/Dに" or just "M/D " at start (without time)
  if (!dueDate) {
    const mdRe = /(?:^|\s)(\d{1,2})\/(\d{1,2})\s*(?:に|まで(?:に)?)?\s*/g;
    const match = mdRe.exec(remaining);
    if (match) {
      const parsed = resolveMonthDay(parseInt(match[1]), parseInt(match[2]));
      if (parsed) {
        dueDate = parsed;
        remaining = remaining.slice(0, match.index) + " " + remaining.slice(match.index + match[0].length);
      }
    }
  }

  // "M月D日" pattern (without time)
  if (!dueDate) {
    const jpDateRe = /(?:^|\s)(\d{1,2})月(\d{1,2})日\s*(?:に|まで(?:に)?)?\s*/g;
    const match = jpDateRe.exec(remaining);
    if (match) {
      const parsed = resolveMonthDay(parseInt(match[1]), parseInt(match[2]));
      if (parsed) {
        dueDate = parsed;
        remaining = remaining.slice(0, match.index) + " " + remaining.slice(match.index + match[0].length);
      }
    }
  }

  // "YYYY-MM-DD HH:MM" or "YYYY/MM/DD HH:MM"
  if (!dueDate) {
    const isoTimeRe = /(?:^|\s)(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}:\d{2})\s*(?:に|まで(?:に)?)?\s*/g;
    const match = isoTimeRe.exec(remaining);
    if (match) {
      const y = parseInt(match[1]);
      const mo = parseInt(match[2]);
      const d = parseInt(match[3]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        dueDate = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        dueTime = normalizeTime(match[4]);
        remaining = remaining.slice(0, match.index) + " " + remaining.slice(match.index + match[0].length);
      }
    }
  }

  // "YYYY-MM-DD" or "YYYY/MM/DD" (without time)
  if (!dueDate) {
    const isoRe = /(?:^|\s)(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*(?:に|まで(?:に)?)?\s*/g;
    const match = isoRe.exec(remaining);
    if (match) {
      const y = parseInt(match[1]);
      const mo = parseInt(match[2]);
      const d = parseInt(match[3]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        dueDate = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        remaining = remaining.slice(0, match.index) + " " + remaining.slice(match.index + match[0].length);
      }
    }
  }

  return { remaining, dueDate, dueTime, scheduledDate, scheduledTime, startDate, startTime };
}

/**
 * Normalize time string to HH:MM format
 */
function normalizeTime(time: string): string {
  const [h, m] = time.split(":");
  return `${String(parseInt(h)).padStart(2, "0")}:${m}`;
}

function tryExtractRelativeDate(
  text: string,
  regex: RegExp,
  daysFromToday: number,
  setter: (d: string) => void
): string | null {
  const match = regex.exec(text);
  if (!match) return null;

  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  setter(formatDate(d));

  return text.slice(0, match.index) + " " + text.slice(match.index + match[0].length);
}

const WEEKDAY_MAP: Record<string, number> = {
  "日": 0, "月": 1, "火": 2, "水": 3, "木": 4, "金": 5, "土": 6,
};

function tryExtractWeekday(
  text: string,
  regex: RegExp,
  weekOffset: number, // 0=this week, 1=next week, -1=next occurrence
  setter: (d: string) => void
): string | null {
  const match = regex.exec(text);
  if (!match) return null;

  const targetDay = WEEKDAY_MAP[match[1]];
  if (targetDay === undefined) return null;

  const now = new Date();
  const currentDay = now.getDay();

  let diff: number;
  if (weekOffset === -1) {
    diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
  } else {
    diff = targetDay - currentDay + weekOffset * 7;
    if (weekOffset === 0 && diff < 0) diff += 7;
  }

  const d = new Date();
  d.setDate(d.getDate() + diff);
  setter(formatDate(d));

  return text.slice(0, match.index) + " " + text.slice(match.index + match[0].length);
}

/**
 * Parse a date string inside braces: {YYYY-MM-DD}, {YYYY-MM-DD HH:MM},
 * {M/D}, {M/D HH:MM}, {M月D日}, {M月D日 HH:MM}
 */
function parseBraceDate(s: string): { date: string; time: string | null } | null {
  // YYYY-MM-DD HH:MM or YYYY-MM-DD
  {
    const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}:\d{2}))?$/);
    if (m) {
      const y = parseInt(m[1]);
      const mo = parseInt(m[2]);
      const d = parseInt(m[3]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        const date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        return { date, time: m[4] ? normalizeTime(m[4]) : null };
      }
    }
  }

  // M/D HH:MM or M/D
  {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}:\d{2}))?$/);
    if (m) {
      const date = resolveMonthDay(parseInt(m[1]), parseInt(m[2]));
      if (date) return { date, time: m[3] ? normalizeTime(m[3]) : null };
    }
  }

  // M月D日 HH:MM or M月D日
  {
    const m = s.match(/^(\d{1,2})月(\d{1,2})日(?:\s+(\d{1,2}:\d{2}))?$/);
    if (m) {
      const date = resolveMonthDay(parseInt(m[1]), parseInt(m[2]));
      if (date) return { date, time: m[3] ? normalizeTime(m[3]) : null };
    }
  }

  return null;
}

/**
 * Resolve M/D to a full YYYY-MM-DD, choosing the nearest future date.
 */
function resolveMonthDay(month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const now = new Date();
  const thisYear = now.getFullYear();

  const candidate = new Date(thisYear, month - 1, day);
  if (candidate.getMonth() !== month - 1) return null;

  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (candidate < todayDate) {
    candidate.setFullYear(thisYear + 1);
  }

  return formatDate(candidate);
}
