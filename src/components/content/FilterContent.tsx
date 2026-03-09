import { h } from "preact";
import { useMemo } from "preact/hooks";
import { TaskStore } from "../../store/TaskStore";
import { FileWatcher } from "../../store/FileWatcher";
import { TaskList } from "../task/TaskList";
import { parseQuery } from "../../query/QueryParser";
import { executeQuery, groupTasks } from "../../query/QueryEngine";
import { today } from "../../utils/DateUtils";

interface FilterContentProps {
  store: TaskStore;
  fileWatcher: FileWatcher;
  title: string;
  query: string;
}

const DAY_NAMES_JA = ["日", "月", "火", "水", "木", "金", "土"];

export function FilterContent({ store, fileWatcher, title, query }: FilterContentProps) {
  const allTasks = store.allTasksArray.value;

  const parsed = useMemo(() => parseQuery(query), [query]);

  const filteredTasks = useMemo(
    () => executeQuery(allTasks, parsed),
    [allTasks, parsed]
  );

  const groups = useMemo(
    () => groupTasks(filteredTasks, parsed.group),
    [filteredTasks, parsed.group]
  );

  const todayStr = today();
  const d = new Date(todayStr + "T00:00:00");
  const dateDisplay = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${DAY_NAMES_JA[d.getDay()]}曜日`;

  return (
    <div class="tasklens-content">
      <div class="tasklens-content-header">
        <h1>{title}</h1>
        <span class="tasklens-content-date">{dateDisplay}</span>
      </div>

      {filteredTasks.length === 0 && (
        <div class="tasklens-empty">
          <p>タスクはありません</p>
        </div>
      )}

      {groups.length === 1 && !groups[0].key ? (
        // No grouping — single list
        <TaskList
          tasks={filteredTasks}
          store={store}
          fileWatcher={fileWatcher}
          showProject
        />
      ) : (
        // Grouped display
        groups.map((group) => (
          <div key={group.key} class="tasklens-section">
            <div class="tasklens-section-header">
              <span class="tasklens-section-title">{group.key}</span>
              <span class="tasklens-section-count">{group.tasks.length}</span>
            </div>
            <TaskList
              tasks={group.tasks}
              store={store}
              fileWatcher={fileWatcher}
              showProject
            />
          </div>
        ))
      )}
    </div>
  );
}
