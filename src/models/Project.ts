export interface Project {
  /** File path relative to vault root, e.g. "tasks/inbox.md" */
  path: string;
  /** Display name from frontmatter title or filename */
  name: string;
  /** Sections (## headings) in order */
  sections: string[];
  /** Optional color from frontmatter */
  color?: string;
  /** Optional icon from frontmatter */
  icon?: string;
  /** Display order from frontmatter */
  order: number;
  /** Whether this is the inbox */
  isInbox: boolean;
  /** Parent folder path for tree grouping, e.g. "tasks/Game" */
  folder: string | null;
}
