import { Plugin } from "obsidian";
import { TaskLensView, VIEW_TYPE_TASKLENS } from "./views/TaskLensView";
import { TaskStore } from "./store/TaskStore";
import { FileWatcher } from "./store/FileWatcher";
import { TaskLensSettings, DEFAULT_SETTINGS, TaskLensSettingTab } from "./settings";
import { QuickAddModal } from "./commands/QuickAddCommand";

export default class TaskLensPlugin extends Plugin {
  settings: TaskLensSettings = DEFAULT_SETTINGS;
  store: TaskStore = new TaskStore();
  fileWatcher!: FileWatcher;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Pass custom filters to store
    this.store.setCustomFilters(this.settings.filters);

    this.fileWatcher = new FileWatcher(
      this.app,
      this.store,
      this.settings.excludeFolders,
      this.settings.defaultTaskTarget
    );

    // Register the view
    this.registerView(VIEW_TYPE_TASKLENS, (leaf) => {
      return new TaskLensView(leaf, this.store, this.fileWatcher, async (filters) => {
        this.settings.filters = filters;
        await this.saveSettings();
      });
    });

    // Command: Open TaskLens
    this.addCommand({
      id: "open-tasklens",
      name: "Open TaskLens",
      callback: () => this.activateView(),
    });

    // Command: Quick Add (Ctrl+Shift+A)
    this.addCommand({
      id: "quick-add-task",
      name: "Quick Add Task",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "a" }],
      callback: () => {
        new QuickAddModal(this.app, this.store, this.fileWatcher).open();
      },
    });

    // Settings tab
    this.addSettingTab(new TaskLensSettingTab(this.app, this));

    // Initialize file watcher after layout is ready
    this.app.workspace.onLayoutReady(async () => {
      await this.fileWatcher.initialize();
    });

    // Add ribbon icon
    this.addRibbonIcon("check-circle", "TaskLens", () => {
      this.activateView();
    });
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_TASKLENS)[0];
    if (!leaf) {
      const newLeaf = workspace.getLeaf("tab");
      await newLeaf.setViewState({
        type: VIEW_TYPE_TASKLENS,
        active: true,
      });
      leaf = newLeaf;
    }
    workspace.revealLeaf(leaf);
  }

  onunload(): void {
    // Views are automatically cleaned up
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.store.setCustomFilters(this.settings.filters);
    this.fileWatcher.updateConfig(
      this.settings.excludeFolders,
      this.settings.defaultTaskTarget
    );
  }
}
