import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h, render } from "preact";
import { App as PreactApp } from "../components/App";
import type { FilterDefinition } from "../settings";
import type { FileWatcher } from "../store/FileWatcher";
import type { TaskStore } from "../store/TaskStore";

export const VIEW_TYPE_TASKLENS = "tasklens-view";

export class TaskLensView extends ItemView {
  private store: TaskStore;
  private fileWatcher: FileWatcher;
  private onSaveFilters?: (filters: FilterDefinition[]) => void;

  constructor(
    leaf: WorkspaceLeaf,
    store: TaskStore,
    fileWatcher: FileWatcher,
    onSaveFilters?: (filters: FilterDefinition[]) => void,
  ) {
    super(leaf);
    this.store = store;
    this.fileWatcher = fileWatcher;
    this.onSaveFilters = onSaveFilters;
  }

  getViewType(): string {
    return VIEW_TYPE_TASKLENS;
  }

  getDisplayText(): string {
    return "TaskLens";
  }

  getIcon(): string {
    return "check-circle";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("tasklens-view-container");

    render(
      h(PreactApp, {
        store: this.store,
        fileWatcher: this.fileWatcher,
        app: this.app,
        onSaveFilters: this.onSaveFilters,
      }),
      container,
    );
  }

  async onClose(): Promise<void> {
    const container = this.containerEl.children[1];
    render(null, container);
  }
}
