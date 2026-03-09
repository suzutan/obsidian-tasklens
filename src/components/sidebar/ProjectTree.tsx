import { h } from "preact";
import { useCallback, useMemo } from "preact/hooks";
import { TaskStore } from "../../store/TaskStore";
import { FileWatcher } from "../../store/FileWatcher";
import { ProjectTreeItem } from "./ProjectTreeItem";
import { Project } from "../../models/Project";

interface ProjectTreeProps {
  store: TaskStore;
  fileWatcher: FileWatcher;
}

type DisplayEntry =
  | { kind: "project"; project: Project; order: number }
  | { kind: "folder"; folder: string; folderName: string; projects: Project[]; order: number };

export function ProjectTree({ store, fileWatcher }: ProjectTreeProps) {
  const projects = store.projectList.value;
  const currentView = store.currentView.value;

  // Build display entries: root projects + folder groups, sorted by order
  const entries = useMemo(() => {
    const rootProjects: Project[] = [];
    const folderGroups = new Map<string, Project[]>();

    for (const project of projects) {
      if (project.isInbox) continue;
      if (project.folder) {
        if (!folderGroups.has(project.folder)) {
          folderGroups.set(project.folder, []);
        }
        folderGroups.get(project.folder)!.push(project);
      } else {
        rootProjects.push(project);
      }
    }

    const result: DisplayEntry[] = [];

    for (const p of rootProjects) {
      result.push({ kind: "project", project: p, order: p.order });
    }

    for (const [folder, folderProjects] of folderGroups) {
      const folderName = folder.split("/").pop() || folder;
      const minOrder = Math.min(...folderProjects.map((p) => p.order));
      result.push({ kind: "folder", folder, folderName, projects: folderProjects, order: minOrder });
    }

    result.sort((a, b) => a.order - b.order);
    return result;
  }, [projects]);

  // Flat list of all project paths in display order (for reordering)
  const allPaths = useMemo(() => {
    const paths: string[] = [];
    for (const entry of entries) {
      if (entry.kind === "project") {
        paths.push(entry.project.path);
      } else {
        for (const p of entry.projects) {
          paths.push(p.path);
        }
      }
    }
    return paths;
  }, [entries]);

  const handleDrop = useCallback(
    async (draggedId: string, targetId: string, insertBefore: boolean) => {
      const isDraggedFolder = draggedId.startsWith("folder:");
      const isTargetFolder = targetId.startsWith("folder:");

      // ── Block-level reorder (at least one side is a folder) ──
      if (isDraggedFolder || isTargetFolder) {
        type Block = { kind: "project"; path: string } | { kind: "folder"; folder: string; paths: string[] };
        const blocks: Block[] = entries.map((e) =>
          e.kind === "project"
            ? { kind: "project", path: e.project.path }
            : { kind: "folder", folder: e.folder, paths: e.projects.map((p) => p.path) }
        );

        const draggedBlockIdx = isDraggedFolder
          ? blocks.findIndex((b) => b.kind === "folder" && `folder:${b.folder}` === draggedId)
          : blocks.findIndex((b) => b.kind === "project" && b.path === draggedId);

        let targetBlockIdx: number;
        if (isTargetFolder) {
          targetBlockIdx = blocks.findIndex((b) => b.kind === "folder" && `folder:${b.folder}` === targetId);
        } else {
          targetBlockIdx = blocks.findIndex((b) => b.kind === "project" && b.path === targetId);
        }

        if (draggedBlockIdx < 0 || targetBlockIdx < 0 || draggedBlockIdx === targetBlockIdx) return;

        const [draggedBlock] = blocks.splice(draggedBlockIdx, 1);
        // Recalculate target index after removal
        const newTargetIdx = isTargetFolder
          ? blocks.findIndex((b) => b.kind === "folder" && `folder:${b.folder}` === targetId)
          : blocks.findIndex((b) => b.kind === "project" && b.path === targetId);
        const insertIdx = insertBefore ? newTargetIdx : newTargetIdx + 1;
        blocks.splice(insertIdx, 0, draggedBlock);

        const newPaths: string[] = [];
        for (const block of blocks) {
          if (block.kind === "project") {
            newPaths.push(block.path);
          } else {
            newPaths.push(...block.paths);
          }
        }
        await fileWatcher.reorderProjects(newPaths);
        return;
      }

      // ── Project-level operations (both are project paths) ──
      const draggedFolder = draggedId.substring(0, draggedId.lastIndexOf("/"));
      const targetFolder = targetId.substring(0, targetId.lastIndexOf("/"));

      if (draggedFolder !== targetFolder) {
        // Cross-folder: move file, then reorder to correct position
        const fileName = draggedId.substring(draggedId.lastIndexOf("/") + 1);
        const newPath = `${targetFolder}/${fileName}`;
        await fileWatcher.moveProjectToFolder(draggedId, targetFolder);

        // Build new ordering with moved file at target position
        const paths = [...allPaths].filter((p) => p !== draggedId);
        let insertIdx = paths.indexOf(targetId);
        if (insertIdx < 0) {
          paths.push(newPath);
        } else {
          if (!insertBefore) insertIdx++;
          paths.splice(insertIdx, 0, newPath);
        }
        await fileWatcher.reorderProjects(paths);
        return;
      }

      // Same folder: reorder
      const paths = [...allPaths];
      const fromIdx = paths.indexOf(draggedId);
      const toIdx = paths.indexOf(targetId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

      paths.splice(fromIdx, 1);
      let insertIdx = paths.indexOf(targetId);
      if (!insertBefore) insertIdx++;
      paths.splice(insertIdx, 0, draggedId);

      await fileWatcher.reorderProjects(paths);
    },
    [entries, allPaths, fileWatcher]
  );

  const handleDropToFolder = useCallback(
    async (draggedPath: string, folderPath: string) => {
      await fileWatcher.moveProjectToFolder(draggedPath, folderPath);
    },
    [fileWatcher]
  );

  const handleDropToRoot = useCallback(
    async (draggedPath: string) => {
      await fileWatcher.moveProjectToFolder(draggedPath, "tasks");
    },
    [fileWatcher]
  );

  const handleMoveUp = useCallback(
    async (projectPath: string) => {
      const idx = allPaths.indexOf(projectPath);
      if (idx <= 0) return;
      const paths = [...allPaths];
      [paths[idx - 1], paths[idx]] = [paths[idx], paths[idx - 1]];
      await fileWatcher.reorderProjects(paths);
    },
    [allPaths, fileWatcher]
  );

  const handleMoveDown = useCallback(
    async (projectPath: string) => {
      const idx = allPaths.indexOf(projectPath);
      if (idx < 0 || idx >= allPaths.length - 1) return;
      const paths = [...allPaths];
      [paths[idx], paths[idx + 1]] = [paths[idx + 1], paths[idx]];
      await fileWatcher.reorderProjects(paths);
    },
    [allPaths, fileWatcher]
  );

  const handleColorChange = useCallback(
    async (projectPath: string, color: string | null) => {
      await fileWatcher.setProjectColor(projectPath, color);
    },
    [fileWatcher]
  );

  const handleDelete = useCallback(
    async (projectPath: string) => {
      await fileWatcher.deleteProject(projectPath);
    },
    [fileWatcher]
  );

  return (
    <div
      class="tasklens-project-tree"
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        const draggedPath = e.dataTransfer?.getData("text/plain");
        if (!draggedPath) return;
        if (draggedPath.startsWith("folder:")) return; // folders can't be moved to root
        if (!draggedPath.startsWith("tasks/")) return;
        handleDropToRoot(draggedPath);
      }}
    >
      {entries.map((entry) => {
        if (entry.kind === "project") {
          return (
            <ProjectTreeItem
              key={entry.project.path}
              project={entry.project}
              active={
                currentView.type === "project" &&
                currentView.projectPath === entry.project.path
              }
              onClick={() =>
                store.selectView({ type: "project", projectPath: entry.project.path })
              }
              onDrop={handleDrop}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onColorChange={handleColorChange}
              onDelete={handleDelete}
            />
          );
        } else {
          return (
            <ProjectTreeItem
              key={entry.folder}
              isFolder
              folderName={entry.folderName}
              folderPath={entry.folder}
              subProjects={entry.projects}
              store={store}
              currentView={currentView}
              onDrop={handleDrop}
              onDropToFolder={handleDropToFolder}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onColorChange={handleColorChange}
              onDelete={handleDelete}
            />
          );
        }
      })}
    </div>
  );
}
