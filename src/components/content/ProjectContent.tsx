import { h } from "preact";
import { TaskStore } from "../../store/TaskStore";
import { FileWatcher } from "../../store/FileWatcher";
import { TaskSection } from "../task/TaskSection";
import { AddSectionButton } from "../common/AddSectionButton";

interface ProjectContentProps {
  store: TaskStore;
  fileWatcher: FileWatcher;
  projectPath: string;
}

export function ProjectContent({ store, fileWatcher, projectPath }: ProjectContentProps) {
  const project = store.projects.value.get(projectPath);
  const tasks = store.getTasksForProject(projectPath);

  if (!project) {
    return (
      <div class="tasklens-content">
        <div class="tasklens-empty">プロジェクトが見つかりません</div>
      </div>
    );
  }

  return (
    <div class="tasklens-content">
      <div class="tasklens-content-header">
        <h1>{project.name}</h1>
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
            projectPath={projectPath}
          />
        );
      })}
      <AddSectionButton projectPath={projectPath} fileWatcher={fileWatcher} />
    </div>
  );
}
