/**
 * Query parser for Obsidian Tasks-compatible filter expressions.
 *
 * Supported syntax:
 *   done / not done
 *   due today / due before today / due after today / due on YYYY-MM-DD
 *   due before 7 days ago / due after in 3 days / due before 2 weeks ago
 *   scheduled today / scheduled before today / ...
 *   starts today / starts before today / ...
 *   has due date / no due date / has scheduled date / no scheduled date / has start date / no start date
 *   priority is highest / priority is high / priority is medium / priority is low / priority is none
 *   priority above none / priority below highest
 *   path includes <text>
 *   description includes <text> / heading includes <text>
 *   tag includes <text> / tags include <text>
 *   is recurring / is not recurring
 *   sort by due date / sort by priority / sort by path / sort by done date
 *   group by filename / group by path / group by due date / group by priority / group by heading / group by tags
 *   limit <N>
 *   (expr) AND (expr) / (expr) OR (expr) / NOT (expr)
 */

export type FilterNode =
  | { type: "done" }
  | { type: "not_done" }
  | { type: "date_filter"; field: DateField; op: DateOp; value: string }
  | { type: "has_date"; field: DateField }
  | { type: "no_date"; field: DateField }
  | { type: "priority_is"; level: PriorityLevel }
  | { type: "priority_above"; level: PriorityLevel }
  | { type: "priority_below"; level: PriorityLevel }
  | { type: "path_includes"; text: string }
  | { type: "description_includes"; text: string }
  | { type: "heading_includes"; text: string }
  | { type: "tag_includes"; tag: string }
  | { type: "is_recurring" }
  | { type: "not_recurring" }
  | { type: "and"; left: FilterNode; right: FilterNode }
  | { type: "or"; left: FilterNode; right: FilterNode }
  | { type: "not"; child: FilterNode };

export type DateField = "due" | "scheduled" | "start" | "done";
export type DateOp = "on" | "before" | "after" | "today" | "before_today" | "after_today";
export type PriorityLevel = "highest" | "high" | "medium" | "low" | "none";

export type SortField = "due" | "priority" | "path" | "done" | "scheduled" | "start" | "description";
export type SortDirection = "asc" | "desc";
export interface SortRule {
  field: SortField;
  direction: SortDirection;
}

export type GroupField = "filename" | "path" | "due" | "priority" | "heading" | "tags" | "folder";

export interface ParsedQuery {
  filter: FilterNode | null;
  sort: SortRule[];
  group: GroupField[];
  limit: number | null;
}

/**
 * Parse a multi-line query string into a structured query.
 */
export function parseQuery(queryStr: string): ParsedQuery {
  const lines = queryStr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const filterLines: string[] = [];
  const sort: SortRule[] = [];
  const group: GroupField[] = [];
  let limit: number | null = null;

  for (const line of lines) {
    // sort by ...
    const sortMatch = line.match(/^sort\s+by\s+(.+?)(?:\s+(asc|desc|reverse))?$/i);
    if (sortMatch) {
      const field = normalizeSortField(sortMatch[1].trim());
      const dir = sortMatch[2]?.toLowerCase();
      if (field) {
        sort.push({ field, direction: dir === "desc" || dir === "reverse" ? "desc" : "asc" });
      }
      continue;
    }

    // group by ...
    const groupMatch = line.match(/^group\s+by\s+(.+)$/i);
    if (groupMatch) {
      const field = normalizeGroupField(groupMatch[1].trim());
      if (field) group.push(field);
      continue;
    }

    // limit N
    const limitMatch = line.match(/^limit\s+(\d+)$/i);
    if (limitMatch) {
      limit = parseInt(limitMatch[1], 10);
      continue;
    }

    // Everything else is a filter line
    filterLines.push(line);
  }

  let filter: FilterNode | null = null;
  if (filterLines.length > 0) {
    // Multiple filter lines are implicitly ANDed
    const nodes = filterLines.map((l) => parseFilterLine(l));
    filter = nodes.reduce((acc, node) => {
      if (!acc) return node;
      return { type: "and", left: acc, right: node };
    });
  }

  return { filter, sort, group, limit };
}

function normalizeSortField(text: string): SortField | null {
  const lower = text.toLowerCase();
  if (lower.includes("due")) return "due";
  if (lower.includes("scheduled")) return "scheduled";
  if (lower.includes("start")) return "start";
  if (lower.includes("done")) return "done";
  if (lower.includes("priorit")) return "priority";
  if (lower.includes("path")) return "path";
  if (lower.includes("description")) return "description";
  return null;
}

function normalizeGroupField(text: string): GroupField | null {
  const lower = text.toLowerCase();
  if (lower.includes("filename")) return "filename";
  if (lower.includes("folder")) return "folder";
  if (lower.includes("path")) return "path";
  if (lower.includes("due")) return "due";
  if (lower.includes("priorit")) return "priority";
  if (lower.includes("heading")) return "heading";
  if (lower.includes("tag")) return "tags";
  return null;
}

/**
 * Parse a single filter line which may contain AND / OR / NOT and parentheses.
 */
function parseFilterLine(line: string): FilterNode {
  const tokens = tokenize(line);
  const result = parseOr(tokens, 0);
  return result.node;
}

interface ParseResult {
  node: FilterNode;
  pos: number;
}

function parseOr(tokens: string[], pos: number): ParseResult {
  let left = parseAnd(tokens, pos);
  while (left.pos < tokens.length && tokens[left.pos]?.toUpperCase() === "OR") {
    const right = parseAnd(tokens, left.pos + 1);
    left = { node: { type: "or", left: left.node, right: right.node }, pos: right.pos };
  }
  return left;
}

function parseAnd(tokens: string[], pos: number): ParseResult {
  let left = parseNot(tokens, pos);
  while (left.pos < tokens.length && tokens[left.pos]?.toUpperCase() === "AND") {
    const right = parseNot(tokens, left.pos + 1);
    left = { node: { type: "and", left: left.node, right: right.node }, pos: right.pos };
  }
  return left;
}

function parseNot(tokens: string[], pos: number): ParseResult {
  if (pos < tokens.length && tokens[pos]?.toUpperCase() === "NOT") {
    const child = parsePrimary(tokens, pos + 1);
    return { node: { type: "not", child: child.node }, pos: child.pos };
  }
  return parsePrimary(tokens, pos);
}

function parsePrimary(tokens: string[], pos: number): ParseResult {
  if (pos >= tokens.length) {
    // Fallback: treat as always-true (not done is a common default)
    return { node: { type: "not_done" }, pos };
  }

  // Parenthesized expression
  if (tokens[pos] === "(") {
    const inner = parseOr(tokens, pos + 1);
    // Skip closing paren
    const nextPos = inner.pos < tokens.length && tokens[inner.pos] === ")" ? inner.pos + 1 : inner.pos;
    return { node: inner.node, pos: nextPos };
  }

  // Consume tokens to form an atomic filter
  return parseAtom(tokens, pos);
}

function parseAtom(tokens: string[], pos: number): ParseResult {
  // Reconstruct remaining text from tokens to match patterns
  const remaining = tokens.slice(pos).join(" ");

  // done / not done
  if (remaining.match(/^not\s+done\b/i)) {
    return { node: { type: "not_done" }, pos: pos + 2 };
  }
  if (remaining.match(/^done\b/i)) {
    return { node: { type: "done" }, pos: pos + 1 };
  }

  // is recurring / is not recurring
  if (remaining.match(/^is\s+not\s+recurring\b/i)) {
    return { node: { type: "not_recurring" }, pos: pos + 3 };
  }
  if (remaining.match(/^is\s+recurring\b/i)) {
    return { node: { type: "is_recurring" }, pos: pos + 2 };
  }

  // has/no date fields
  const hasDateMatch = remaining.match(/^has\s+(due|scheduled|start|done)\s+date\b/i);
  if (hasDateMatch) {
    return { node: { type: "has_date", field: normalizeDateField(hasDateMatch[1]) }, pos: pos + 3 };
  }
  const noDateMatch = remaining.match(/^no\s+(due|scheduled|start|done)\s+date\b/i);
  if (noDateMatch) {
    return { node: { type: "no_date", field: normalizeDateField(noDateMatch[1]) }, pos: pos + 3 };
  }

  // Date filters: due/scheduled/starts/done + operator
  // Supports: today, before/after today, on/before/after YYYY-MM-DD,
  //   before/after N days/weeks/months ago, before/after in N days/weeks/months
  const dateMatch = remaining.match(
    /^(due|scheduled|starts?|done)\s+(today|before\s+today|after\s+today|on\s+\d{4}-\d{2}-\d{2}|before\s+\d{4}-\d{2}-\d{2}|after\s+\d{4}-\d{2}-\d{2}|(?:before|after)\s+\d+\s+(?:days?|weeks?|months?)\s+ago|(?:before|after)\s+in\s+\d+\s+(?:days?|weeks?|months?))\b/i,
  );
  if (dateMatch) {
    const field = normalizeDateField(dateMatch[1]);
    const opStr = dateMatch[2].toLowerCase();
    let op: DateOp;
    let value = "";
    const tokenCount = dateMatch[0].split(/\s+/).length;

    if (opStr === "today") {
      op = "today";
    } else if (opStr === "before today") {
      op = "before_today";
    } else if (opStr === "after today") {
      op = "after_today";
    } else if (opStr.startsWith("on ")) {
      op = "on";
      value = opStr.slice(3);
    } else {
      // Check for relative dates: "before/after N days/weeks/months ago" or "before/after in N days/weeks/months"
      const relMatch = opStr.match(
        /^(before|after)\s+(?:(\d+)\s+(days?|weeks?|months?)\s+ago|in\s+(\d+)\s+(days?|weeks?|months?))$/,
      );
      if (relMatch) {
        op = relMatch[1] === "before" ? "before" : "after";
        if (relMatch[2]) {
          // N units ago
          value = resolveRelativeDate(-parseInt(relMatch[2], 10), relMatch[3]);
        } else {
          // in N units
          value = resolveRelativeDate(parseInt(relMatch[4], 10), relMatch[5]);
        }
      } else if (opStr.startsWith("before ")) {
        op = "before";
        value = opStr.slice(7);
      } else if (opStr.startsWith("after ")) {
        op = "after";
        value = opStr.slice(6);
      } else {
        op = "today";
      }
    }

    return { node: { type: "date_filter", field, op, value }, pos: pos + tokenCount };
  }

  // Priority
  const prioIsMatch = remaining.match(/^priority\s+is\s+(highest|high|medium|low|none)\b/i);
  if (prioIsMatch) {
    return { node: { type: "priority_is", level: prioIsMatch[1].toLowerCase() as PriorityLevel }, pos: pos + 3 };
  }
  const prioAboveMatch = remaining.match(/^priority\s+above\s+(highest|high|medium|low|none)\b/i);
  if (prioAboveMatch) {
    return { node: { type: "priority_above", level: prioAboveMatch[1].toLowerCase() as PriorityLevel }, pos: pos + 3 };
  }
  const prioBelowMatch = remaining.match(/^priority\s+below\s+(highest|high|medium|low|none)\b/i);
  if (prioBelowMatch) {
    return { node: { type: "priority_below", level: prioBelowMatch[1].toLowerCase() as PriorityLevel }, pos: pos + 3 };
  }

  // path includes
  const pathMatch = remaining.match(/^path\s+includes\s+(.+?)(?:\s+(?:AND|OR|NOT|\))|$)/i);
  if (pathMatch) {
    const text = pathMatch[1].trim();
    const tokenCount = `path includes ${text}`.split(/\s+/).length;
    return { node: { type: "path_includes", text }, pos: pos + tokenCount };
  }

  // description includes
  const descMatch = remaining.match(/^description\s+includes\s+(.+?)(?:\s+(?:AND|OR|NOT|\))|$)/i);
  if (descMatch) {
    const text = descMatch[1].trim();
    const tokenCount = `description includes ${text}`.split(/\s+/).length;
    return { node: { type: "description_includes", text }, pos: pos + tokenCount };
  }

  // heading includes
  const headingMatch = remaining.match(/^heading\s+includes\s+(.+?)(?:\s+(?:AND|OR|NOT|\))|$)/i);
  if (headingMatch) {
    const text = headingMatch[1].trim();
    const tokenCount = `heading includes ${text}`.split(/\s+/).length;
    return { node: { type: "heading_includes", text }, pos: pos + tokenCount };
  }

  // tag/tags includes
  const tagMatch = remaining.match(/^tags?\s+includes?\s+(.+?)(?:\s+(?:AND|OR|NOT|\))|$)/i);
  if (tagMatch) {
    const tag = tagMatch[1].trim().replace(/^#/, "");
    const tokenCount = tagMatch[0].trim().split(/\s+/).length;
    return { node: { type: "tag_includes", tag }, pos: pos + tokenCount };
  }

  // Fallback: skip this token
  return { node: { type: "not_done" }, pos: pos + 1 };
}

/**
 * Resolve a relative date offset to a YYYY-MM-DD string.
 * @param offset - positive for future, negative for past
 * @param unit - "day(s)", "week(s)", "month(s)"
 */
function resolveRelativeDate(offset: number, unit: string): string {
  const d = new Date();
  const u = unit.toLowerCase().replace(/s$/, "");
  if (u === "day") {
    d.setDate(d.getDate() + offset);
  } else if (u === "week") {
    d.setDate(d.getDate() + offset * 7);
  } else if (u === "month") {
    d.setMonth(d.getMonth() + offset);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDateField(text: string): DateField {
  const lower = text.toLowerCase();
  if (lower === "due") return "due";
  if (lower === "scheduled") return "scheduled";
  if (lower.startsWith("start")) return "start";
  if (lower === "done") return "done";
  return "due";
}

/**
 * Tokenize a filter line into words, preserving parentheses as separate tokens.
 */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = "";

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "(" || ch === ")") {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(ch);
      current = "";
    } else if (/\s/.test(ch)) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());

  return tokens;
}
