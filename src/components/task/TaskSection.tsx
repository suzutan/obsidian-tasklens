import { useState } from "preact/hooks";
import type { Task } from "../../models/Task";
import type { FileWatcher } from "../../store/FileWatcher";
import type { TaskStore } from "../../store/TaskStore";
import { TaskInlineAdd } from "./TaskInlineAdd";
import { TaskList } from "./TaskList";

interface TaskSectionProps {
  title: string;
  tasks: Task[];
  store: TaskStore;
  fileWatcher: FileWatcher;
  projectPath: string;
  collapsible?: boolean;
}

export function TaskSection({ title, tasks, store, fileWatcher, projectPath, collapsible = true }: TaskSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div class="tasklens-section">
      <div class="tasklens-section-header" onClick={() => collapsible && setCollapsed(!collapsed)}>
        {collapsible && <span class="tasklens-section-arrow">{collapsed ? "▸" : "▾"}</span>}
        <span class="tasklens-section-title">{title}</span>
        <span class="tasklens-section-count">{tasks.filter((t) => !t.completed).length}</span>
      </div>
      {!collapsed && (
        <>
          <TaskList tasks={tasks} store={store} fileWatcher={fileWatcher} projectPath={projectPath} section={title} />
          <TaskInlineAdd fileWatcher={fileWatcher} store={store} projectPath={projectPath} section={title} />
        </>
      )}
    </div>
  );
}
