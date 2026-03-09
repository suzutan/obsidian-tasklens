import { type App, debounce, TFile } from "obsidian";
import { getNextDueDate } from "../models/RecurrenceRule";
import { createTaskId, type Priority, type Task } from "../models/Task";
import { type ParsedInput, parseNaturalLanguage } from "../parser/NaturalLanguageParser";
import { parseTaskFile } from "../parser/TaskParser";
import { serializeTask } from "../parser/TaskSerializer";
import { formatDateTimeForFrontmatter, today } from "../utils/DateUtils";
import { getAllMarkdownFiles, isExcluded } from "../utils/FileUtils";
import type { TaskStore } from "./TaskStore";

export class FileWatcher {
  private app: App;
  private store: TaskStore;
  private excludeFolders: string[];
  private defaultTarget: string;
  private debounceReload: () => void;
  private writing = false;

  constructor(app: App, store: TaskStore, excludeFolders: string[], defaultTarget: string) {
    this.app = app;
    this.store = store;
    this.excludeFolders = excludeFolders;
    this.defaultTarget = defaultTarget;
    this.debounceReload = debounce(() => this.fullReload(), 500, true);
  }

  updateConfig(excludeFolders: string[], defaultTarget: string): void {
    this.excludeFolders = excludeFolders;
    this.defaultTarget = defaultTarget;
  }

  async initialize(): Promise<void> {
    await this.fullReload();

    // Watch for file changes — all .md files in vault
    this.app.vault.on("modify", (file) => {
      if (this.writing) return;
      if (file instanceof TFile && file.extension === "md" && !isExcluded(file.path, this.excludeFolders)) {
        this.reloadFile(file);
      }
    });

    this.app.vault.on("create", (file) => {
      if (file instanceof TFile && file.extension === "md" && !isExcluded(file.path, this.excludeFolders)) {
        this.debounceReload();
      }
    });

    this.app.vault.on("delete", (file) => {
      if (file instanceof TFile && file.extension === "md") {
        this.store.removeFile(file.path);
      }
    });

    this.app.vault.on("rename", () => {
      this.debounceReload();
    });
  }

  async fullReload(): Promise<void> {
    const files = getAllMarkdownFiles(this.app, this.excludeFolders);
    const allTasks: Task[] = [];
    const fileSections = new Map<string, string[]>();

    for (const file of files) {
      const content = await this.app.vault.read(file);
      const parsed = parseTaskFile(content, file.path);

      // Only track files that have tasks
      let fileHasTasks = false;
      for (const [, tasks] of parsed.sections) {
        if (tasks.length > 0) {
          fileHasTasks = true;
          allTasks.push(...tasks);
        }
      }

      if (fileHasTasks) {
        fileSections.set(file.path, parsed.sectionOrder);
      }
    }

    this.store.setAll(allTasks, fileSections);
  }

  private async reloadFile(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    const parsed = parseTaskFile(content, file.path);

    const tasks: Task[] = [];
    let hasTasks = false;
    for (const [, sectionTasks] of parsed.sections) {
      if (sectionTasks.length > 0) hasTasks = true;
      tasks.push(...sectionTasks);
    }

    if (hasTasks) {
      this.store.updateFileTasks(file.path, tasks, parsed.sectionOrder);
    } else {
      // File no longer has tasks — remove from store
      this.store.removeFile(file.path);
    }
  }

  /**
   * Write task changes back to the markdown file
   */
  async writeTask(task: Task): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.projectPath);
    if (!(file instanceof TFile)) return;

    this.writing = true;
    try {
      const content = await this.app.vault.read(file);
      const parsed = parseTaskFile(content, task.projectPath);

      // Find and replace the task in the section
      const sectionTasks = parsed.sections.get(task.section);
      if (sectionTasks) {
        const idx = sectionTasks.findIndex((t) => t.order === task.order);
        if (idx >= 0) {
          sectionTasks[idx] = task;
        }
      }

      // Rebuild the file content
      const lines = content.split("\n");
      const newLines: string[] = [];
      let currentSection = "";
      let inFrontmatter = false;
      let skipChildren = false;
      let taskOrderInSection = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (i === 0 && line.trim() === "---") {
          inFrontmatter = true;
          newLines.push(line);
          continue;
        }
        if (inFrontmatter) {
          newLines.push(line);
          if (line.trim() === "---") inFrontmatter = false;
          continue;
        }

        const sectionMatch = line.match(/^## (.+)$/);
        if (sectionMatch) {
          currentSection = sectionMatch[1].trim();
          taskOrderInSection = 0;
          newLines.push(line);
          skipChildren = false;
          continue;
        }

        const taskMatch = line.match(/^(\s*)- \[[ x]\]\s+/);
        if (taskMatch) {
          if (skipChildren) {
            skipChildren = false;
          }

          const taskId = createTaskId(task.projectPath, currentSection, taskOrderInSection);
          if (taskId === task.id) {
            // Replace with updated task
            newLines.push(serializeTask(task));
            skipChildren = true; // Skip old children, already included in serializeTask
          } else {
            newLines.push(line);
          }
          taskOrderInSection++;
          continue;
        }

        // Skip children of the task being replaced
        if (skipChildren && line.match(/^\s{2,}/) && !line.match(/^\s*- \[/)) {
          continue;
        }
        skipChildren = false;

        newLines.push(line);
      }

      // Update the updated timestamp in frontmatter (if present)
      let result = newLines.join("\n");
      if (/updated:\s*.+/.test(result)) {
        result = result.replace(/updated:\s*.+/, `updated: ${formatDateTimeForFrontmatter()}`);
      }

      await this.app.vault.modify(file, result);
      this.store.updateTask(task);
    } finally {
      this.writing = false;
    }
  }

  /**
   * Build the markdown line for a new task using Obsidian Tasks emoji format
   */
  private buildTaskLine(parsed: ParsedInput): string {
    const parts: string[] = [parsed.content];

    for (const label of parsed.labels) parts.push(`#${label}`);

    if (parsed.priority === 1) parts.push("⏫");
    else if (parsed.priority === 2) parts.push("🔼");
    else if (parsed.priority === 3) parts.push("🔽");

    if (parsed.dueDate) {
      const time = parsed.dueTime ? `T${parsed.dueTime}` : "";
      parts.push(`📅 ${parsed.dueDate}${time}`);
    }
    if (parsed.scheduledDate) {
      const time = parsed.scheduledTime ? `T${parsed.scheduledTime}` : "";
      parts.push(`⏳ ${parsed.scheduledDate}${time}`);
    }
    if (parsed.startDate) {
      const time = parsed.startTime ? `T${parsed.startTime}` : "";
      parts.push(`🛫 ${parsed.startDate}${time}`);
    }

    return `- [ ] ${parts.join(" ")}`;
  }

  /**
   * Add a new task to a file/section.
   * Raw input is parsed through NaturalLanguageParser for date/priority extraction.
   */
  async addTask(filePath: string, section: string, rawInput: string, priority: number = 4): Promise<void> {
    const targetPath = filePath || this.defaultTarget;
    let file = this.app.vault.getAbstractFileByPath(targetPath);

    // Create file if it doesn't exist
    if (!file) {
      const dir = targetPath.substring(0, targetPath.lastIndexOf("/"));
      if (dir) {
        const dirFile = this.app.vault.getAbstractFileByPath(dir);
        if (!dirFile) await this.app.vault.createFolder(dir);
      }
      const now = formatDateTimeForFrontmatter();
      const name = targetPath.replace(/\.md$/, "").split("/").pop() || "Inbox";
      const content = `---\ntitle: ${name}\ncreated: ${now}\nupdated: ${now}\n---\n\n# ${name}\n\n## ${section || "inbox"}\n\n`;
      await this.app.vault.create(targetPath, content);
      file = this.app.vault.getAbstractFileByPath(targetPath);
    }

    if (!(file instanceof TFile)) return;

    // Parse natural language
    const parsed = parseNaturalLanguage(rawInput);
    if (priority !== 4 && parsed.priority === 4) {
      parsed.priority = priority as Priority;
    }

    if (!parsed.content.trim()) return;

    this.writing = true;
    try {
      const fileContent = await this.app.vault.read(file);
      const lines = fileContent.split("\n");
      const newLines: string[] = [];
      let currentSection = "";
      let inserted = false;

      const taskLine = this.buildTaskLine(parsed);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const sectionMatch = line.match(/^## (.+)$/);
        if (sectionMatch) {
          // Before moving to next section, insert at end of target section
          if (currentSection === section && !inserted) {
            newLines.push(taskLine);
            inserted = true;
          }
          currentSection = sectionMatch[1].trim();
        }
        newLines.push(line);
      }

      // If the target section is the last one
      if (currentSection === section && !inserted) {
        newLines.push(taskLine);
        inserted = true;
      }

      if (!inserted) {
        // Section not found, append
        newLines.push("");
        newLines.push(`## ${section}`);
        newLines.push("");
        newLines.push(taskLine);
      }

      let result = newLines.join("\n");
      if (/updated:\s*.+/.test(result)) {
        result = result.replace(/updated:\s*.+/, `updated: ${formatDateTimeForFrontmatter()}`);
      }

      await this.app.vault.modify(file, result);
      await this.reloadFile(file);
    } finally {
      this.writing = false;
    }
  }

  /**
   * Move a task to a different position (for drag & drop reordering)
   */
  async moveTask(taskId: string, targetFilePath: string, targetSection: string, targetIndex: number): Promise<void> {
    const task = this.store.getTaskById(taskId);
    if (!task) return;

    const sameFile = task.projectPath === targetFilePath;
    const sameSection = sameFile && task.section === targetSection;

    if (sameSection) {
      await this.reorderInSection(task, targetIndex);
    } else {
      await this.removeTaskFromFile(task);
      const moved: Task = {
        ...task,
        projectPath: targetFilePath,
        section: targetSection,
        order: targetIndex,
      };
      await this.insertTaskInFile(moved, targetIndex);
    }

    await this.fullReload();
  }

  private async reorderInSection(task: Task, targetIndex: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.projectPath);
    if (!(file instanceof TFile)) return;

    this.writing = true;
    try {
      const content = await this.app.vault.read(file);
      const parsed = parseTaskFile(content, task.projectPath);
      const sectionTasks = parsed.sections.get(task.section);
      if (!sectionTasks) return;

      const fromIdx = sectionTasks.findIndex((t) => t.order === task.order);
      if (fromIdx < 0) return;
      const [moved] = sectionTasks.splice(fromIdx, 1);

      const insertAt = targetIndex > fromIdx ? targetIndex - 1 : targetIndex;
      sectionTasks.splice(Math.min(insertAt, sectionTasks.length), 0, moved);

      for (let i = 0; i < sectionTasks.length; i++) {
        sectionTasks[i].order = i;
      }

      await this.rebuildFile(file, parsed);
    } finally {
      this.writing = false;
    }
  }

  private async removeTaskFromFile(task: Task): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.projectPath);
    if (!(file instanceof TFile)) return;

    this.writing = true;
    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      const newLines: string[] = [];
      let currentSection = "";
      let inFrontmatter = false;
      let taskOrder = 0;
      let skipping = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (i === 0 && line.trim() === "---") {
          inFrontmatter = true;
          newLines.push(line);
          continue;
        }
        if (inFrontmatter) {
          newLines.push(line);
          if (line.trim() === "---") inFrontmatter = false;
          continue;
        }

        const secMatch = line.match(/^## (.+)$/);
        if (secMatch) {
          currentSection = secMatch[1].trim();
          taskOrder = 0;
          skipping = false;
          newLines.push(line);
          continue;
        }

        if (line.match(/^\s*- \[[ x]\]/)) {
          if (skipping) skipping = false;
          const id = createTaskId(task.projectPath, currentSection, taskOrder);
          taskOrder++;
          if (id === task.id) {
            skipping = true;
            continue;
          }
          newLines.push(line);
          continue;
        }

        if (skipping && line.match(/^\s{2,}/) && !line.match(/^\s*- \[/)) continue;
        skipping = false;
        newLines.push(line);
      }

      let result = newLines.join("\n");
      if (/updated:\s*.+/.test(result)) {
        result = result.replace(/updated:\s*.+/, `updated: ${formatDateTimeForFrontmatter()}`);
      }
      await this.app.vault.modify(file, result);
    } finally {
      this.writing = false;
    }
  }

  private async insertTaskInFile(task: Task, atIndex: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.projectPath);
    if (!(file instanceof TFile)) return;

    this.writing = true;
    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      const newLines: string[] = [];
      let currentSection = "";
      let inFrontmatter = false;
      let taskOrder = 0;
      let inserted = false;

      const taskLine = serializeTask(task);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (i === 0 && line.trim() === "---") {
          inFrontmatter = true;
          newLines.push(line);
          continue;
        }
        if (inFrontmatter) {
          newLines.push(line);
          if (line.trim() === "---") inFrontmatter = false;
          continue;
        }

        const secMatch = line.match(/^## (.+)$/);
        if (secMatch) {
          if (currentSection === task.section && !inserted) {
            newLines.push(taskLine);
            inserted = true;
          }
          currentSection = secMatch[1].trim();
          taskOrder = 0;
        }

        if (currentSection === task.section && line.match(/^\s*- \[[ x]\]/)) {
          if (taskOrder === atIndex && !inserted) {
            newLines.push(taskLine);
            inserted = true;
          }
          taskOrder++;
        }

        newLines.push(line);
      }

      if (currentSection === task.section && !inserted) {
        newLines.push(taskLine);
      }

      let result = newLines.join("\n");
      if (/updated:\s*.+/.test(result)) {
        result = result.replace(/updated:\s*.+/, `updated: ${formatDateTimeForFrontmatter()}`);
      }
      await this.app.vault.modify(file, result);
    } finally {
      this.writing = false;
    }
  }

  private async rebuildFile(file: TFile, parsed: ReturnType<typeof parseTaskFile>): Promise<void> {
    const lines: string[] = [];
    const content = await this.app.vault.read(file);
    const origLines = content.split("\n");
    let inFrontmatter = false;
    let sectionsDone = false;

    for (const line of origLines) {
      if (line.trim() === "---") {
        inFrontmatter = !inFrontmatter;
        lines.push(line);
        if (!inFrontmatter) continue;
        continue;
      }
      if (inFrontmatter) {
        lines.push(line);
        continue;
      }
      if (line.match(/^# /) && !sectionsDone) {
        lines.push(line);
        lines.push("");
        continue;
      }
      if (!sectionsDone && !line.match(/^##/) && line.trim()) {
        lines.push(line);
        continue;
      }
      if (line.match(/^##/)) sectionsDone = true;
      if (sectionsDone) break;
    }

    for (const sectionName of parsed.sectionOrder) {
      lines.push(`## ${sectionName}`);
      lines.push("");
      const tasks = parsed.sections.get(sectionName) || [];
      for (const task of tasks) {
        lines.push(serializeTask(task));
      }
      if (tasks.length > 0) lines.push("");
    }

    let result = lines.join("\n");
    if (/updated:\s*.+/.test(result)) {
      result = result.replace(/updated:\s*.+/, `updated: ${formatDateTimeForFrontmatter()}`);
    }
    await this.app.vault.modify(file, result);
  }

  /**
   * Complete a task (handle recurrence)
   */
  async completeTask(taskId: string): Promise<void> {
    const task = this.store.getTaskById(taskId);
    if (!task) return;

    const todayStr = today();

    if (task.recurrence && task.dueDate) {
      const updated: Task = {
        ...task,
        dueDate: getNextDueDate(task.dueDate, task.recurrence),
        startDate: task.startDate ? getNextDueDate(task.startDate, task.recurrence) : null,
      };
      await this.writeTask(updated);
    } else {
      const updated: Task = {
        ...task,
        completed: true,
        doneDate: todayStr,
      };
      await this.writeTask(updated);
    }
  }

  /**
   * Uncomplete a task
   */
  async uncompleteTask(taskId: string): Promise<void> {
    const task = this.store.getTaskById(taskId);
    if (!task) return;

    const updated: Task = {
      ...task,
      completed: false,
      doneDate: null,
    };
    await this.writeTask(updated);
  }

  /**
   * Add a new section to a file
   */
  async addSection(filePath: string, sectionName: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;

    this.writing = true;
    try {
      let content = await this.app.vault.read(file);
      content = `${content.trimEnd()}\n\n## ${sectionName}\n\n`;
      if (/updated:\s*.+/.test(content)) {
        content = content.replace(/updated:\s*.+/, `updated: ${formatDateTimeForFrontmatter()}`);
      }
      await this.app.vault.modify(file, content);
      await this.fullReload();
    } finally {
      this.writing = false;
    }
  }

  /**
   * Delete a task from a file
   */
  async deleteTask(taskId: string): Promise<void> {
    const task = this.store.getTaskById(taskId);
    if (!task) return;

    await this.removeTaskFromFile(task);
    await this.fullReload();
  }

  /** Get the default target file path */
  getDefaultTarget(): string {
    return this.defaultTarget;
  }
}
