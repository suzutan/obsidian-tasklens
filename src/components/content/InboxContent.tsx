import { h } from "preact";
import { TaskStore } from "../../store/TaskStore";
import { FileWatcher } from "../../store/FileWatcher";
import { TaskSection } from "../task/TaskSection";
import { AddSectionButton } from "../common/AddSectionButton";

interface InboxContentProps {
  store: TaskStore;
  fileWatcher: FileWatcher;
}

export function InboxContent({ store, fileWatcher }: InboxContentProps) {
  const project = store.projects.value.get("tasks/inbox.md");
  const tasks = store.getTasksForProject("tasks/inbox.md");

  if (!project) {
    return (
      <div class="tasklens-content">
        <div class="tasklens-content-header">
          <h1>インボックス</h1>
        </div>
        <div class="tasklens-empty">インボックスが見つかりません</div>
      </div>
    );
  }

  return (
    <div class="tasklens-content">
      <div class="tasklens-content-header">
        <h1>📥 インボックス</h1>
      </div>
      {project.sections.map((section) => {
        const sectionTasks = tasks.filter((t) => t.section === section);
        return (
          <TaskSection
            key={section}
            title={section}
            tasks={sectionTasks}
            store={store}
            fileWatcher={fileWatcher}
            projectPath="tasks/inbox.md"
          />
        );
      })}
      <AddSectionButton projectPath="tasks/inbox.md" fileWatcher={fileWatcher} />
    </div>
  );
}
