import { type App, Modal } from "obsidian";
import { parseNaturalLanguage } from "../parser/NaturalLanguageParser";
import type { FileWatcher } from "../store/FileWatcher";
import type { TaskStore } from "../store/TaskStore";
import { getDateLabel } from "../utils/DateUtils";
import { applyTagSuggestion, getTagSuggestions, type TagSuggestState } from "../utils/TagSuggest";

export class QuickAddModal extends Modal {
  private store: TaskStore;
  private fileWatcher: FileWatcher;
  private content = "";
  private targetFile: string;
  private section = "";
  private previewEl: HTMLElement | null = null;
  private noteSearchEl: HTMLInputElement | null = null;
  private noteDropdownEl: HTMLElement | null = null;
  private sectionSelectEl: HTMLSelectElement | null = null;
  private noteDisplayEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private tagDropdownEl: HTMLElement | null = null;
  private tagState: TagSuggestState | null = null;
  private tagSelectedIdx = 0;

  constructor(app: App, store: TaskStore, fileWatcher: FileWatcher) {
    super(app);
    this.store = store;
    this.fileWatcher = fileWatcher;
    this.targetFile = fileWatcher.getDefaultTarget();
    // Set initial section
    const sections = this.store.getSectionsForFile(this.targetFile);
    this.section = sections[0] || "inbox";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("tasklens-quick-add-modal");

    contentEl.createEl("h2", { text: "タスクを追加" });

    // Task content input with tag suggest wrapper
    const inputWrapper = contentEl.createDiv({ cls: "tasklens-tag-suggest-wrapper" });
    this.inputEl = inputWrapper.createEl("input", {
      type: "text",
      placeholder: "例: 買い物 #countdown {2026-03-12 19:00} p1",
      cls: "tasklens-input tasklens-quick-add-input",
    });
    this.inputEl.focus();
    this.inputEl.addEventListener("input", (e) => {
      this.content = (e.target as HTMLInputElement).value;
      this.updatePreview();
      this.updateTagSuggestions();
    });
    this.inputEl.addEventListener("click", () => this.updateTagSuggestions());
    this.inputEl.addEventListener("keydown", (e) => {
      // Tag suggestion navigation
      if (this.tagState && this.tagState.suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          this.tagSelectedIdx = Math.min(this.tagSelectedIdx + 1, this.tagState.suggestions.length - 1);
          this.renderTagDropdown();
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          this.tagSelectedIdx = Math.max(this.tagSelectedIdx - 1, 0);
          this.renderTagDropdown();
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          this.applyTag(this.tagState.suggestions[this.tagSelectedIdx]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          this.closeTagDropdown();
          return;
        }
      }
      if (e.key === "Enter") {
        this.submit();
      }
    });

    // Tag suggestion dropdown
    this.tagDropdownEl = inputWrapper.createDiv({ cls: "tasklens-tag-suggest-dropdown" });
    this.tagDropdownEl.style.display = "none";

    // NLP Preview
    this.previewEl = contentEl.createDiv({ cls: "tasklens-nlp-preview tasklens-nlp-preview--modal" });
    this.previewEl.style.display = "none";

    // --- Note picker ---
    const pickerRow = contentEl.createDiv({ cls: "tasklens-quickadd-picker" });

    // Note
    const noteField = pickerRow.createDiv({ cls: "tasklens-quickadd-field" });
    noteField.createSpan({ cls: "tasklens-quickadd-field-label", text: "追加先" });

    const notePickerWrapper = noteField.createDiv({ cls: "tasklens-quickadd-note-wrapper" });

    // Display current selection (click to search)
    this.noteDisplayEl = notePickerWrapper.createDiv({ cls: "tasklens-quickadd-note-display" });
    this.renderNoteDisplay();
    this.noteDisplayEl.addEventListener("click", () => this.openNoteSearch());

    // Search input (hidden by default)
    this.noteSearchEl = notePickerWrapper.createEl("input", {
      type: "text",
      placeholder: "ノート名を検索…",
      cls: "tasklens-input tasklens-quickadd-note-search",
    });
    this.noteSearchEl.style.display = "none";
    this.noteSearchEl.addEventListener("input", () => this.filterNotes());
    this.noteSearchEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeNoteSearch();
      }
      if (e.key === "Enter") {
        // Select first visible item
        const first = this.noteDropdownEl?.querySelector(".tasklens-quickadd-note-item") as HTMLElement | null;
        if (first) first.click();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const first = this.noteDropdownEl?.querySelector(".tasklens-quickadd-note-item") as HTMLElement | null;
        if (first) first.focus();
      }
    });
    this.noteSearchEl.addEventListener("blur", (_e) => {
      // Delay to allow click on dropdown item
      setTimeout(() => {
        if (!this.noteDropdownEl?.contains(document.activeElement)) {
          this.closeNoteSearch();
        }
      }, 150);
    });

    // Dropdown results
    this.noteDropdownEl = notePickerWrapper.createDiv({ cls: "tasklens-quickadd-note-dropdown" });
    this.noteDropdownEl.style.display = "none";

    // Section
    const sectionField = pickerRow.createDiv({ cls: "tasklens-quickadd-field" });
    sectionField.createSpan({ cls: "tasklens-quickadd-field-label", text: "セクション" });
    this.sectionSelectEl = sectionField.createEl("select", { cls: "tasklens-select tasklens-quickadd-section-select" });
    this.updateSectionOptions();
    this.sectionSelectEl.addEventListener("change", () => {
      this.section = this.sectionSelectEl?.value ?? "";
    });

    // Submit buttons
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

  private renderNoteDisplay(): void {
    if (!this.noteDisplayEl) return;
    this.noteDisplayEl.empty();
    const name = this.targetFile.replace(/\.md$/, "").split("/").pop() || this.targetFile;
    this.noteDisplayEl.createSpan({ text: "📄 " });
    this.noteDisplayEl.createSpan({ text: name, cls: "tasklens-quickadd-note-name" });
    this.noteDisplayEl.createSpan({ text: ` (${this.targetFile})`, cls: "tasklens-quickadd-note-path" });
  }

  private openNoteSearch(): void {
    if (!this.noteSearchEl || !this.noteDisplayEl || !this.noteDropdownEl) return;
    this.noteDisplayEl.style.display = "none";
    this.noteSearchEl.style.display = "block";
    this.noteSearchEl.value = "";
    this.noteSearchEl.focus();
    this.noteDropdownEl.style.display = "block";
    this.filterNotes();
  }

  private closeNoteSearch(): void {
    if (!this.noteSearchEl || !this.noteDisplayEl || !this.noteDropdownEl) return;
    this.noteSearchEl.style.display = "none";
    this.noteDisplayEl.style.display = "flex";
    this.noteDropdownEl.style.display = "none";
  }

  private filterNotes(): void {
    if (!this.noteDropdownEl || !this.noteSearchEl) return;
    this.noteDropdownEl.empty();

    const query = this.noteSearchEl.value.toLowerCase();
    const sourcePaths = this.store.allSourcePaths.value;

    // Filter and sort: exact matches first, then contains
    const filtered = sourcePaths.filter((p) => {
      const name = p.replace(/\.md$/, "").split("/").pop()?.toLowerCase() || "";
      const fullPath = p.toLowerCase();
      return name.includes(query) || fullPath.includes(query);
    });

    if (filtered.length === 0) {
      this.noteDropdownEl.createDiv({ cls: "tasklens-quickadd-note-empty", text: "一致するノートがありません" });
      return;
    }

    for (const path of filtered) {
      const name = path.replace(/\.md$/, "").split("/").pop() || path;
      const item = this.noteDropdownEl.createDiv({ cls: "tasklens-quickadd-note-item" });
      item.setAttribute("tabindex", "0");
      item.createSpan({ text: name, cls: "tasklens-quickadd-note-item-name" });
      if (path !== name) {
        item.createSpan({ text: ` ${path}`, cls: "tasklens-quickadd-note-item-path" });
      }
      if (path === this.targetFile) {
        item.addClass("tasklens-quickadd-note-item--active");
      }
      item.addEventListener("click", () => this.selectNote(path));
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.selectNote(path);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const next = item.nextElementSibling as HTMLElement | null;
          if (next) next.focus();
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const prev = item.previousElementSibling as HTMLElement | null;
          if (prev) prev.focus();
          else this.noteSearchEl?.focus();
        }
        if (e.key === "Escape") this.closeNoteSearch();
      });
    }
  }

  private selectNote(path: string): void {
    this.targetFile = path;
    const sections = this.store.getSectionsForFile(path);
    this.section = sections[0] || "inbox";
    this.renderNoteDisplay();
    this.updateSectionOptions();
    this.closeNoteSearch();
  }

  private updateSectionOptions(): void {
    if (!this.sectionSelectEl) return;
    this.sectionSelectEl.empty();

    const sections = this.store.getSectionsForFile(this.targetFile);
    if (sections.length === 0) {
      const _opt = this.sectionSelectEl.createEl("option", { value: "inbox", text: "inbox" });
      this.section = "inbox";
    } else {
      for (const sec of sections) {
        this.sectionSelectEl.createEl("option", { value: sec, text: sec });
      }
      this.sectionSelectEl.value = this.section;
    }
  }

  private updatePreview(): void {
    if (!this.previewEl) return;
    if (!this.content.trim()) {
      this.previewEl.style.display = "none";
      return;
    }

    const parsed = parseNaturalLanguage(this.content);
    const hasMetadata =
      parsed.dueDate || parsed.scheduledDate || parsed.startDate || parsed.priority !== 4 || parsed.labels.length > 0;

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
      const chip = this.previewEl.createSpan({
        cls: "tasklens-nlp-preview-chip",
        text: `📅 ${parsed.dueDate}${timeStr}`,
      });
      chip.style.color = dl.color;
    }

    if (parsed.scheduledDate) {
      const timeStr = parsed.scheduledTime ? ` ${parsed.scheduledTime}` : "";
      const chip = this.previewEl.createSpan({
        cls: "tasklens-nlp-preview-chip",
        text: `⏳ ${parsed.scheduledDate}${timeStr}`,
      });
      chip.style.color = "#4fc3f7";
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

  private updateTagSuggestions(): void {
    if (!this.inputEl) return;
    const cursor = this.inputEl.selectionStart ?? this.content.length;
    const allLabels = this.store.allLabels.value;
    this.tagState = getTagSuggestions(this.content, cursor, allLabels);
    this.tagSelectedIdx = 0;
    this.renderTagDropdown();
  }

  private renderTagDropdown(): void {
    if (!this.tagDropdownEl) return;
    if (!this.tagState || this.tagState.suggestions.length === 0) {
      this.tagDropdownEl.style.display = "none";
      return;
    }
    this.tagDropdownEl.style.display = "block";
    this.tagDropdownEl.empty();
    for (let i = 0; i < this.tagState.suggestions.length; i++) {
      const label = this.tagState.suggestions[i];
      const item = this.tagDropdownEl.createDiv({
        cls: `tasklens-tag-suggest-item ${i === this.tagSelectedIdx ? "tasklens-tag-suggest-item--active" : ""}`,
        text: `#${label}`,
      });
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.applyTag(label);
      });
      item.addEventListener("mouseenter", () => {
        this.tagSelectedIdx = i;
        this.renderTagDropdown();
      });
    }
  }

  private closeTagDropdown(): void {
    this.tagState = null;
    if (this.tagDropdownEl) this.tagDropdownEl.style.display = "none";
  }

  private applyTag(label: string): void {
    if (!this.tagState || !this.inputEl) return;
    const cursor = this.inputEl.selectionStart ?? this.content.length;
    const result = applyTagSuggestion(this.content, cursor, this.tagState, label);
    this.content = result.text;
    this.inputEl.value = result.text;
    this.closeTagDropdown();
    this.updatePreview();
    // Restore cursor
    requestAnimationFrame(() => {
      if (this.inputEl) {
        this.inputEl.focus();
        this.inputEl.setSelectionRange(result.newCursorPos, result.newCursorPos);
      }
    });
  }

  private async submit(): Promise<void> {
    if (!this.content.trim()) return;
    await this.fileWatcher.addTask(this.targetFile, this.section, this.content.trim());
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    this.previewEl = null;
    this.noteSearchEl = null;
    this.noteDropdownEl = null;
    this.sectionSelectEl = null;
    this.noteDisplayEl = null;
    this.inputEl = null;
    this.tagDropdownEl = null;
    this.tagState = null;
  }
}
