import { useMemo } from "preact/hooks";
import { executeQuery, groupTasks } from "../../query/QueryEngine";
import { parseQuery } from "../../query/QueryParser";
import type { FileWatcher } from "../../store/FileWatcher";
import type { TaskStore } from "../../store/TaskStore";
import { TaskList } from "../task/TaskList";

interface EmbedViewProps {
  store: TaskStore;
  fileWatcher: FileWatcher;
  query: string;
}

export function EmbedView({ store, fileWatcher, query }: EmbedViewProps) {
  const allTasks = store.allTasksArray.value;

  const parsed = useMemo(() => parseQuery(query), [query]);

  const filteredTasks = useMemo(() => executeQuery(allTasks, parsed), [allTasks, parsed]);

  const groups = useMemo(() => groupTasks(filteredTasks, parsed.group), [filteredTasks, parsed.group]);

  return (
    <div class="tasklens-embed">
      {filteredTasks.length === 0 ? (
        <div class="tasklens-embed-empty">タスクはありません</div>
      ) : groups.length === 1 && !groups[0].key ? (
        <TaskList tasks={filteredTasks} store={store} fileWatcher={fileWatcher} showProject />
      ) : (
        groups.map((group) => (
          <div key={group.key} class="tasklens-section">
            <div class="tasklens-section-header">
              <span class="tasklens-section-title">{group.key}</span>
              <span class="tasklens-section-count">{group.tasks.length}</span>
            </div>
            <TaskList tasks={group.tasks} store={store} fileWatcher={fileWatcher} showProject />
          </div>
        ))
      )}
    </div>
  );
}
