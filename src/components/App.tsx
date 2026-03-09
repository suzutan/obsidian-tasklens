import { h } from "preact";
import { App as ObsidianApp } from "obsidian";
import { TaskStore } from "../store/TaskStore";
import { FileWatcher } from "../store/FileWatcher";
import { Sidebar } from "./sidebar/Sidebar";
import { FilterContent } from "./content/FilterContent";
import { TaskDetailPanel } from "./task/TaskDetailPanel";

interface AppProps {
  store: TaskStore;
  fileWatcher: FileWatcher;
  app: ObsidianApp;
  onSaveFilters?: (filters: import("../settings").FilterDefinition[]) => void;
}

export function App({ store, fileWatcher, app, onSaveFilters }: AppProps) {
  const currentView = store.currentView.value;
  const selectedTaskId = store.selectedTaskId.value;

  // Derive view title
  const getTitle = (): string => {
    switch (currentView.type) {
      case "filter": {
        const f = store.getFilter(currentView.filterId);
        return f?.name || "フィルター";
      }
      case "custom_query":
        return currentView.name || "カスタムクエリ";
      case "label":
        return `#${currentView.label}`;
      case "source":
        return currentView.path;
      default:
        return "タスク";
    }
  };

  // Derive query string
  const getQuery = (): string => {
    switch (currentView.type) {
      case "filter": {
        const f = store.getFilter(currentView.filterId);
        return f?.query || "not done";
      }
      case "custom_query":
        return currentView.query;
      case "label":
        return `tag includes #${currentView.label}\nnot done\nsort by priority\nsort by due date`;
      case "source":
        return `path includes ${currentView.path}\nnot done\nsort by priority`;
      default:
        return "not done";
    }
  };

  return (
    <div class="tasklens-app">
      <div class="tasklens-sidebar">
        <Sidebar store={store} fileWatcher={fileWatcher} app={app} onSaveFilters={onSaveFilters} />
      </div>
      <div class="tasklens-main">
        <FilterContent
          store={store}
          fileWatcher={fileWatcher}
          title={getTitle()}
          query={getQuery()}
        />
      </div>
      {selectedTaskId && (
        <div class="tasklens-detail-overlay" onClick={(e: MouseEvent) => {
          if (e.target === e.currentTarget) store.selectTask(null);
        }}>
          <div class="tasklens-detail-modal">
            <TaskDetailPanel
              store={store}
              fileWatcher={fileWatcher}
              taskId={selectedTaskId}
            />
          </div>
        </div>
      )}
    </div>
  );
}
