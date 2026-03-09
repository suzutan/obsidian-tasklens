import { h } from "preact";
import { TaskStore } from "../../store/TaskStore";
import { FileWatcher } from "../../store/FileWatcher";
import { TaskList } from "../task/TaskList";
import { today } from "../../utils/DateUtils";

interface TodayContentProps {
  store: TaskStore;
  fileWatcher: FileWatcher;
}

const DAY_NAMES_JA = ["日", "月", "火", "水", "木", "金", "土"];

export function TodayContent({ store, fileWatcher }: TodayContentProps) {
  const todayStr = today();
  const d = new Date(todayStr + "T00:00:00");
  const dateDisplay = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${DAY_NAMES_JA[d.getDay()]}曜日`;

  const overdueTasks = store.overdueTasks.value;
  const todayTasks = store.todayTasks.value.filter((t) => t.dueDate === todayStr);

  return (
    <div class="tasklens-content">
      <div class="tasklens-content-header">
        <h1>今日</h1>
        <span class="tasklens-content-date">{dateDisplay}</span>
      </div>

      {overdueTasks.length > 0 && (
        <div class="tasklens-section">
          <div class="tasklens-section-header tasklens-section-header--overdue">
            <span class="tasklens-section-title">期限切れ</span>
            <span class="tasklens-section-count">{overdueTasks.length}</span>
          </div>
          <TaskList
            tasks={overdueTasks}
            store={store}
            fileWatcher={fileWatcher}
            showProject
          />
        </div>
      )}

      <div class="tasklens-section">
        <div class="tasklens-section-header">
          <span class="tasklens-section-title">
            {todayStr.replace(/(\d{4})-(\d{2})-(\d{2})/, "$2月$3日")}
          </span>
          <span class="tasklens-section-count">{todayTasks.length}</span>
        </div>
        <TaskList
          tasks={todayTasks}
          store={store}
          fileWatcher={fileWatcher}
          showProject
        />
      </div>
    </div>
  );
}
