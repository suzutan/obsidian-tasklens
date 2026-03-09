import { App, Modal, Setting } from "obsidian";
import { TaskStore } from "../store/TaskStore";
import { FileWatcher } from "../store/FileWatcher";
import { Priority } from "../models/Task";
import { parseNaturalLanguage } from "../parser/NaturalLanguageParser";
import { getDateLabel } from "../utils/DateUtils";

export class QuickAddModal extends Modal {
  private store: TaskStore;
  private fileWatcher: FileWatcher;
  private content = "";
  private targetFile: string;
  private section = "inbox";
  private previewEl: HTMLElement | null = null;

  constructor(app: App, store: TaskStore, fileWatcher: FileWatcher) {
    super(app);
    this.store = store;
    this.fileWatcher = fileWatcher;
    this.targetFile = fileWatcher.getDefaultTarget();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("tasklens-quick-add-modal");

    contentEl.createEl("h2", { text: "タスクを追加" });

    // Task content input
    const inputEl = contentEl.createEl("input", {
      type: "text",
      placeholder: "例: 3/10 に買い物、明日 レポート提出 p1",
      cls: "tasklens-input tasklens-quick-add-input",
    });
    inputEl.focus();
    inputEl.addEventListener("input", (e) => {
      this.content = (e.target as HTMLInputElement).value;
      this.updatePreview();
    });
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.submit();
      }
    });

    // NLP Preview
    this.previewEl = contentEl.createDiv({ cls: "tasklens-nlp-preview tasklens-nlp-preview--modal" });
    this.previewEl.style.display = "none";

    // Target file select
    const sourcePaths = this.store.allSourcePaths.value;
    if (sourcePaths.length > 0) {
      new Setting(contentEl).setName("追加先").addDropdown((dropdown) => {
        // Add default target first
        dropdown.addOption(this.targetFile, this.targetFile);
        for (const path of sourcePaths) {
          if (path !== this.targetFile) {
            dropdown.addOption(path, path);
          }
        }
        dropdown.setValue(this.targetFile);
        dropdown.onChange((value) => {
          this.targetFile = value;
          // Update section to first section of selected file
          const sections = this.store.getSectionsForFile(value);
          this.section = sections[0] || "inbox";
        });
      });
    }

    // Submit button
    const btnContainer = contentEl.createDiv({ cls: "tasklens-quick-add-buttons" });
    const submitBtn = btnContainer.createEl("button", {
      text: "追加",
      cls: "tasklens-btn tasklens-btn-primary",
    });
    submitBtn.addEventListener("click", () => this.submit());

    const cancelBtn = btnContainer.createEl("button", {
      text: "キャンセル",
      cls: "tasklens-btn",
    });
    cancelBtn.addEventListener("click", () => this.close());
  }

  private updatePreview(): void {
    if (!this.previewEl) return;
    if (!this.content.trim()) {
      this.previewEl.style.display = "none";
      return;
    }

    const parsed = parseNaturalLanguage(this.content);
    const hasMetadata = parsed.dueDate || parsed.scheduledDate || parsed.startDate || parsed.priority !== 4 || parsed.labels.length > 0;

    if (!hasMetadata) {
      this.previewEl.style.display = "none";
      return;
    }

    this.previewEl.style.display = "flex";
    this.previewEl.empty();

    this.previewEl.createSpan({ cls: "tasklens-nlp-preview-label", text: "解析:" });
    this.previewEl.createSpan({ cls: "tasklens-nlp-preview-content", text: parsed.content });

    if (parsed.dueDate) {
      const dl = getDateLabel(parsed.dueDate);
      const timeStr = parsed.dueTime ? ` ${parsed.dueTime}` : "";
      const chip = this.previewEl.createSpan({ cls: "tasklens-nlp-preview-chip", text: `📅 ${parsed.dueDate}${timeStr}` });
      chip.style.color = dl.color;
    }

    if (parsed.scheduledDate) {
      const timeStr = parsed.scheduledTime ? ` ${parsed.scheduledTime}` : "";
      const chip = this.previewEl.createSpan({ cls: "tasklens-nlp-preview-chip", text: `⏳ ${parsed.scheduledDate}${timeStr}` });
      chip.style.color = "#692fc2";
    }

    if (parsed.startDate) {
      const timeStr = parsed.startTime ? ` ${parsed.startTime}` : "";
      this.previewEl.createSpan({ cls: "tasklens-nlp-preview-chip", text: `🛫 ${parsed.startDate}${timeStr}` });
    }

    if (parsed.priority !== 4) {
      this.previewEl.createSpan({ cls: "tasklens-nlp-preview-chip", text: `P${parsed.priority}` });
    }

    for (const label of parsed.labels) {
      this.previewEl.createSpan({ cls: "tasklens-nlp-preview-chip", text: `#${label}` });
    }
  }

  private async submit(): Promise<void> {
    if (!this.content.trim()) return;

    const sections = this.store.getSectionsForFile(this.targetFile);
    const section = sections[0] || this.section;

    await this.fileWatcher.addTask(this.targetFile, section, this.content.trim());
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    this.previewEl = null;
  }
}
