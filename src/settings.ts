import { App, PluginSettingTab, Setting } from "obsidian";
import type TaskLensPlugin from "./main";

export interface FilterDefinition {
  id: string;
  name: string;
  icon: string;
  query: string;
}

export interface TaskLensSettings {
  /** Folder paths to exclude from vault-wide scanning */
  excludeFolders: string[];
  /** Default file path for new tasks (e.g., "tasks/inbox.md" or "daily") */
  defaultTaskTarget: string;
  /** Custom filter definitions */
  filters: FilterDefinition[];
}

export const BUILT_IN_FILTERS: FilterDefinition[] = [
  {
    id: "__today",
    name: "今日",
    icon: "📅",
    query: `(due today) OR (due before today) OR (scheduled today) OR (scheduled before today)
not done
sort by priority`,
  },
  {
    id: "__upcoming",
    name: "近日中",
    icon: "📆",
    query: `has due date
not done
sort by due date
sort by priority`,
  },
  {
    id: "__overdue",
    name: "期限切れ",
    icon: "⚡",
    query: `due before today
not done
sort by due date
sort by priority`,
  },
  {
    id: "__all",
    name: "すべて",
    icon: "📋",
    query: `not done
sort by path
sort by priority`,
  },
  {
    id: "__unplanned",
    name: "予定なし",
    icon: "📭",
    query: `not done
no due date
no scheduled date
sort by path
sort by priority`,
  },
  {
    id: "__stale",
    name: "放置タスク",
    icon: "🕸",
    query: `not done
due before 7 days ago
sort by due date
sort by priority`,
  },
  {
    id: "__timers",
    name: "タイマー",
    icon: "⏱",
    query: `not done
(tag includes #countdown) OR (tag includes #elapsed) OR (tag includes #countdown-elapsed) OR (tag includes #stamina) OR (tag includes #periodic)
sort by due date`,
  },
];

export const DEFAULT_SETTINGS: TaskLensSettings = {
  excludeFolders: [".obsidian", ".trash", ".claude", ".github", "_Templates", "attachments", "_backup_tasks_migration", "_claude_docs"],
  defaultTaskTarget: "tasks/inbox.md",
  filters: [],
};

export class TaskLensSettingTab extends PluginSettingTab {
  plugin: TaskLensPlugin;

  constructor(app: App, plugin: TaskLensPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "TaskLens 設定" });

    new Setting(containerEl)
      .setName("除外フォルダ")
      .setDesc("タスクスキャンから除外するフォルダ（カンマ区切り）")
      .addText((text) =>
        text
          .setPlaceholder(".obsidian, _Templates")
          .setValue(this.plugin.settings.excludeFolders.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("デフォルトタスク追加先")
      .setDesc("新しいタスクを追加するファイルパス")
      .addText((text) =>
        text
          .setPlaceholder("tasks/inbox.md")
          .setValue(this.plugin.settings.defaultTaskTarget)
          .onChange(async (value) => {
            this.plugin.settings.defaultTaskTarget = value;
            await this.plugin.saveSettings();
          })
      );

    // Custom filters section
    containerEl.createEl("h3", { text: "カスタムフィルター" });

    for (let i = 0; i < this.plugin.settings.filters.length; i++) {
      const filter = this.plugin.settings.filters[i];
      const s = new Setting(containerEl)
        .setName(filter.name)
        .setDesc(filter.query.split("\n")[0] + "...")
        .addButton((btn) =>
          btn.setButtonText("削除").onClick(async () => {
            this.plugin.settings.filters.splice(i, 1);
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }
  }
}
