import { useCallback } from "preact/hooks";
import type { Task } from "../../models/Task";
import type { FileWatcher } from "../../store/FileWatcher";
import type { TaskStore } from "../../store/TaskStore";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  store: TaskStore;
  fileWatcher: FileWatcher;
  showProject?: boolean;
  showCompleted?: boolean;
  /** Project path for drop targets (required for D&D) */
  projectPath?: string;
  /** Section name for drop targets (required for D&D) */
  section?: string;
}

export function TaskList({
  tasks,
  store,
  fileWatcher,
  showProject,
  showCompleted,
  projectPath,
  section,
}: TaskListProps) {
  const activeTasks = showCompleted ? tasks : tasks.filter((t) => !t.completed);
  const completedTasks = showCompleted ? [] : tasks.filter((t) => t.completed);

  const handleDrop = useCallback(
    async (e: DragEvent, targetTask: Task) => {
      const draggedId = e.dataTransfer?.getData("text/plain");
      if (!draggedId || draggedId === targetTask.id) return;

      // Determine insert position: above or below the target
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertBefore = e.clientY < midY;

      const dropProjectPath = projectPath || targetTask.projectPath;
      const dropSection = section || targetTask.section;
      let targetIndex = targetTask.order;
      if (!insertBefore) targetIndex++;

      await fileWatcher.moveTask(draggedId, dropProjectPath, dropSection, targetIndex);
    },
    [fileWatcher, projectPath, section],
  );

  const handleEmptyDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      const draggedId = e.dataTransfer?.getData("text/plain");
      if (!draggedId || !projectPath || !section) return;
      // Drop at end of section
      await fileWatcher.moveTask(draggedId, projectPath, section, activeTasks.length);
    },
    [fileWatcher, projectPath, section, activeTasks.length],
  );

  return (
    <div
      class="tasklens-task-list"
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleEmptyDrop}
    >
      {activeTasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          store={store}
          fileWatcher={fileWatcher}
          showProject={showProject}
          onDrop={handleDrop}
        />
      ))}
      {completedTasks.length > 0 && (
        <details class="tasklens-completed-section">
          <summary class="tasklens-completed-header">完了済み ({completedTasks.length})</summary>
          {completedTasks.map((task) => (
            <TaskItem key={task.id} task={task} store={store} fileWatcher={fileWatcher} showProject={showProject} />
          ))}
        </details>
      )}
    </div>
  );
}
