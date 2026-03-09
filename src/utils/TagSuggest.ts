/**
 * Shared logic for #tag autocomplete suggestions.
 *
 * Detects a `#partial` token at or before the cursor position and returns
 * matching labels from the full label set.
 */

export interface TagSuggestState {
  /** The partial text after # that the user is typing */
  query: string;
  /** Character index in the input where the # starts */
  hashIndex: number;
  /** Matching labels (without #) */
  suggestions: string[];
}

/**
 * Detect whether the cursor is inside a #tag token and return suggestions.
 * Returns null if not currently typing a tag.
 */
export function getTagSuggestions(text: string, cursorPos: number, allLabels: string[]): TagSuggestState | null {
  // Walk backward from cursor to find the nearest #
  let hashIndex = -1;
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "#") {
      // Must be at start or preceded by whitespace
      if (i === 0 || /\s/.test(text[i - 1])) {
        hashIndex = i;
      }
      break;
    }
    if (/\s/.test(ch)) break; // hit whitespace before finding #
  }

  if (hashIndex === -1) return null;

  const query = text.slice(hashIndex + 1, cursorPos).toLowerCase();

  const suggestions = allLabels.filter((label) => label.toLowerCase().includes(query));

  if (suggestions.length === 0) return null;

  return { query, hashIndex, suggestions };
}

/**
 * Apply a tag suggestion: replace the #partial with #fullLabel in the text.
 */
export function applyTagSuggestion(
  text: string,
  cursorPos: number,
  state: TagSuggestState,
  label: string,
): { text: string; newCursorPos: number } {
  const before = text.slice(0, state.hashIndex);
  const after = text.slice(cursorPos);
  const newText = `${before}#${label} ${after}`;
  const newCursorPos = state.hashIndex + 1 + label.length + 1; // after "#label "
  return { text: newText, newCursorPos };
}
