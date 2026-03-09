/**
 * Convert parenthesized format back to Obsidian Tasks emoji format.
 *
 * Old:    - [ ] タスク名 (p1, due:2026-03-31, scheduled:2026-03-01, start:2026-02-01, repeat:monthly/1, done:2026-03-08, #label)
 * New:    - [ ] タスク名 #label ⏫ 🔁 every month on the 1st 📅 2026-03-31 ⏳ 2026-03-01 🛫 2026-02-01 ✅ 2026-03-08
 */
export function migrateLine(line: string): string {
  // Only process task lines
  const match = line.match(/^(\s*- \[[ x]\]\s+)(.+)$/);
  if (!match) return line;

  const prefix = match[1];
  const content = match[2];

  // Extract parenthesized metadata at the end
  const metaMatch = content.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!metaMatch) return line;

  const taskContent = metaMatch[1].trim();
  const metaStr = metaMatch[2];
  const metaParts = metaStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const emojiParts: string[] = [];
  const tags: string[] = [];

  for (const part of metaParts) {
    if (part === "p1") {
      emojiParts.push("⏫");
    } else if (part === "p2") {
      emojiParts.push("🔼");
    } else if (part === "p3") {
      emojiParts.push("🔽");
    } else if (part.startsWith("due:")) {
      const val = part.slice(4);
      emojiParts.push(`📅 ${formatDateTimeEmoji(val)}`);
    } else if (part.startsWith("scheduled:")) {
      const val = part.slice(10);
      emojiParts.push(`⏳ ${formatDateTimeEmoji(val)}`);
    } else if (part.startsWith("start:")) {
      const val = part.slice(6);
      emojiParts.push(`🛫 ${formatDateTimeEmoji(val)}`);
    } else if (part.startsWith("repeat:")) {
      const recur = convertCompactRecurrence(part.slice(7));
      emojiParts.push(`🔁 ${recur}`);
    } else if (part.startsWith("done:")) {
      emojiParts.push(`✅ ${part.slice(5)}`);
    } else if (part.startsWith("#")) {
      tags.push(part);
    }
    // loc: is dropped (not part of Obsidian Tasks format)
  }

  const allParts = [taskContent, ...tags, ...emojiParts].filter(Boolean);
  return `${prefix}${allParts.join(" ")}`;
}

function formatDateTimeEmoji(val: string): string {
  // "2026-03-31T12:00" → "2026-03-31T12:00", "2026-03-31" → "2026-03-31"
  return val;
}

function convertCompactRecurrence(compact: string): string {
  const parts = compact.split("/");
  const type = parts[0];

  const WEEKDAY_FULL: Record<string, string> = {
    sun: "Sunday",
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
  };

  switch (type) {
    case "daily":
      if (parts[1]) {
        const n = parseInt(parts[1], 10);
        if (!Number.isNaN(n) && n > 1) return `every ${n} days`;
      }
      return "every day";
    case "weekly": {
      let interval = 1;
      let dayName = "";
      if (parts[1]) {
        const n = parseInt(parts[1], 10);
        if (!Number.isNaN(n)) {
          interval = n;
          if (parts[2]) dayName = parts[2];
        } else {
          dayName = parts[1];
        }
      }
      let base = interval > 1 ? `every ${interval} weeks` : "every week";
      if (dayName) {
        const full = WEEKDAY_FULL[dayName.toLowerCase().slice(0, 3)];
        if (full) base += ` on ${full}`;
      }
      return base;
    }
    case "monthly": {
      const interval = 1;
      let day = "";
      if (parts[1]) {
        const n = parseInt(parts[1], 10);
        if (!Number.isNaN(n) && n <= 31) {
          day = parts[1];
        }
      }
      let base = interval > 1 ? `every ${interval} months` : "every month";
      if (day) {
        const d = parseInt(day, 10);
        const s = ["th", "st", "nd", "rd"];
        const v = d % 100;
        const ord = d + (s[(v - 20) % 10] || s[v] || s[0]);
        base += ` on the ${ord}`;
      }
      return base;
    }
    case "yearly":
      return "every year";
    default:
      return compact;
  }
}

/**
 * Migrate an entire file content from parenthesized to emoji format
 */
export function migrateFileContent(content: string): string {
  return content
    .split("\n")
    .map((line) => migrateLine(line))
    .join("\n");
}
