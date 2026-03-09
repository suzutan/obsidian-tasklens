import { Plugin } from "obsidian";
import { QuickAddModal } from "./commands/QuickAddCommand";
import { TimerGeneratorModal } from "./commands/TimerGeneratorCommand";
import { DEFAULT_SETTINGS, type TaskLensSettings, TaskLensSettingTab } from "./settings";
import { FileWatcher } from "./store/FileWatcher";
import { TaskStore } from "./store/TaskStore";
import { TaskLensView, VIEW_TYPE_TASKLENS } from "./views/TaskLensView";

export default class TaskLensPlugin extends Plugin {
  settings: TaskLensSettings = DEFAULT_SETTINGS;
  store: TaskStore = new TaskStore();
  fileWatcher!: FileWatcher;
  private lastSaveTime = 0;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Pass custom filters to store
    this.store.setCustomFilters(this.settings.filters);

    this.fileWatcher = new FileWatcher(
      this.app,
      this.store,
      this.settings.excludeFolders,
      this.settings.defaultTaskTarget,
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

    // Command: Timer Generator
    this.addCommand({
      id: "timer-generator",
      name: "Timer Generator (スタミナ/定期増加)",
      callback: () => {
        new TimerGeneratorModal(this.app).open();
      },
    });

    // Settings tab
    this.addSettingTab(new TaskLensSettingTab(this.app, this));

    // Initialize file watcher after layout is ready
    this.app.workspace.onLayoutReady(async () => {
      await this.fileWatcher.initialize();
    });

    // Watch for external data.json changes (e.g. LiveSync)
    this.watchDataJson();

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
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    this.lastSaveTime = Date.now();
    await this.saveData(this.settings);
    this.applySettings();
  }

  private watchDataJson(): void {
    const dataPath = `${this.manifest.dir}/data.json`;
    this.registerEvent(
      // @ts-expect-error "raw" event exists at runtime but is missing from obsidian.d.ts
      this.app.vault.on("raw", (path: string) => {
        if (path !== dataPath) return;
        if (Date.now() - this.lastSaveTime < 2000) return;
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => this.reloadExternalSettings(), 500);
      }),
    );
  }

  private async reloadExternalSettings(): Promise<void> {
    await this.loadSettings();
    this.applySettings();
  }

  private applySettings(): void {
    this.store.setCustomFilters(this.settings.filters);
    this.fileWatcher.updateConfig(this.settings.excludeFolders, this.settings.defaultTaskTarget);
  }
}
