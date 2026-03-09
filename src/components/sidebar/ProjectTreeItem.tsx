import { h } from "preact";
import { useState } from "preact/hooks";
import { Menu } from "obsidian";
import { Project } from "../../models/Project";
import { TaskStore, ViewType } from "../../store/TaskStore";

const PROJECT_COLORS = [
  { name: "Berry Red", value: "#b8255f" },
  { name: "Red", value: "#db4035" },
  { name: "Orange", value: "#ff9933" },
  { name: "Yellow", value: "#fad000" },
  { name: "Olive Green", value: "#afb83b" },
  { name: "Lime Green", value: "#7ecc49" },
  { name: "Green", value: "#299438" },
  { name: "Mint Green", value: "#6accbc" },
  { name: "Teal", value: "#158fad" },
  { name: "Sky Blue", value: "#14aaf5" },
  { name: "Light Blue", value: "#96c3eb" },
  { name: "Blue", value: "#4073ff" },
  { name: "Grape", value: "#884dff" },
  { name: "Violet", value: "#af38eb" },
  { name: "Lavender", value: "#eb96eb" },
  { name: "Magenta", value: "#e05194" },
  { name: "Salmon", value: "#ff8d85" },
  { name: "Charcoal", value: "#808080" },
  { name: "Grey", value: "#b8b8b8" },
  { name: "Taupe", value: "#ccac93" },
];

interface ProjectItemProps {
  project: Project;
  active: boolean;
  onClick: () => void;
  onDrop?: (draggedId: string, targetId: string, insertBefore: boolean) => void;
  onDropToFolder?: (draggedId: string, folderPath: string) => void;
  onMoveUp?: (projectPath: string) => void;
  onMoveDown?: (projectPath: string) => void;
  onColorChange?: (projectPath: string, color: string | null) => void;
  onDelete?: (projectPath: string) => void;
  isFolder?: false;
  folderName?: undefined;
  folderPath?: undefined;
  subProjects?: undefined;
  store?: undefined;
  currentView?: undefined;
}

interface FolderItemProps {
  isFolder: true;
  folderName: string;
  folderPath: string;
  subProjects: Project[];
  store: TaskStore;
  currentView: ViewType;
  onDrop?: (draggedId: string, targetId: string, insertBefore: boolean) => void;
  onDropToFolder?: (draggedId: string, folderPath: string) => void;
  onMoveUp?: (projectPath: string) => void;
  onMoveDown?: (projectPath: string) => void;
  onColorChange?: (projectPath: string, color: string | null) => void;
  onDelete?: (projectPath: string) => void;
  project?: undefined;
  active?: undefined;
  onClick?: undefined;
}

type Props = ProjectItemProps | FolderItemProps;

const DRAG_MIME = "text/plain";

function showProjectContextMenu(
  e: MouseEvent,
  projectPath: string,
  currentColor: string | undefined,
  callbacks: {
    onMoveUp?: (path: string) => void;
    onMoveDown?: (path: string) => void;
    onColorChange?: (path: string, color: string | null) => void;
    onDelete?: (path: string) => void;
  }
) {
  e.preventDefault();
  e.stopPropagation();

  const menu = new Menu();

  menu.addItem((item) => {
    item.setTitle("上に移動");
    item.setIcon("arrow-up");
    item.onClick(() => callbacks.onMoveUp?.(projectPath));
  });

  menu.addItem((item) => {
    item.setTitle("下に移動");
    item.setIcon("arrow-down");
    item.onClick(() => callbacks.onMoveDown?.(projectPath));
  });

  menu.addSeparator();

  menu.addItem((item) => {
    item.setTitle("色を変更");
    item.setIcon("palette");
    item.onClick(() => {
      const colorMenu = new Menu();
      for (const c of PROJECT_COLORS) {
        colorMenu.addItem((ci) => {
          ci.setTitle(c.name);
          ci.setIcon(currentColor === c.value ? "check" : "circle");
          ci.onClick(() => callbacks.onColorChange?.(projectPath, c.value));
        });
      }
      if (currentColor) {
        colorMenu.addSeparator();
        colorMenu.addItem((ci) => {
          ci.setTitle("色をリセット");
          ci.setIcon("x");
          ci.onClick(() => callbacks.onColorChange?.(projectPath, null));
        });
      }
      colorMenu.showAtMouseEvent(e);
    });
  });

  menu.addSeparator();

  menu.addItem((item) => {
    item.setTitle("削除");
    item.setIcon("trash");
    item.onClick(() => callbacks.onDelete?.(projectPath));
  });

  menu.showAtMouseEvent(e);
}

export function ProjectTreeItem(props: Props) {
  const [expanded, setExpanded] = useState(true);
  const [folderDropHover, setFolderDropHover] = useState(false);

  const contextCallbacks = {
    onMoveUp: props.onMoveUp,
    onMoveDown: props.onMoveDown,
    onColorChange: props.onColorChange,
    onDelete: props.onDelete,
  };

  if (props.isFolder) {
    const { folderName, folderPath, subProjects, store, currentView, onDrop, onDropToFolder } = props;
    const folderId = `folder:${folderPath}`;

    return (
      <div class="tasklens-tree-folder">
        <div
          class={`tasklens-tree-folder-header ${folderDropHover ? "tasklens-tree-folder-header--drop" : ""}`}
          draggable
          onDragStart={(e: DragEvent) => {
            if (!e.dataTransfer) return;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData(DRAG_MIME, folderId);
            (e.currentTarget as HTMLElement).classList.add("tasklens-tree-item--dragging");
          }}
          onDragEnd={(e: DragEvent) => {
            (e.currentTarget as HTMLElement).classList.remove("tasklens-tree-item--dragging");
          }}
          onClick={() => setExpanded(!expanded)}
          onDragOver={(e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            const el = e.currentTarget as HTMLElement;
            el.classList.remove("tasklens-tree-item--drop-above", "tasklens-tree-item--drop-below");
            setFolderDropHover(true);
            const rect = el.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
              el.classList.add("tasklens-tree-item--drop-above");
            } else {
              el.classList.add("tasklens-tree-item--drop-below");
            }
          }}
          onDragLeave={(e: DragEvent) => {
            setFolderDropHover(false);
            const el = e.currentTarget as HTMLElement;
            el.classList.remove("tasklens-tree-item--drop-above", "tasklens-tree-item--drop-below");
          }}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setFolderDropHover(false);
            const el = e.currentTarget as HTMLElement;
            el.classList.remove("tasklens-tree-item--drop-above", "tasklens-tree-item--drop-below");
            const draggedId = e.dataTransfer?.getData(DRAG_MIME);
            if (!draggedId) return;
            const rect = el.getBoundingClientRect();
            const insertBefore = e.clientY < rect.top + rect.height / 2;
            if (!draggedId.startsWith("folder:") && draggedId.startsWith("tasks/")) {
              const draggedFolder = draggedId.substring(0, draggedId.lastIndexOf("/"));
              if (draggedFolder === folderPath) return;
              onDropToFolder?.(draggedId, folderPath);
            }
            if (draggedId.startsWith("folder:") && draggedId !== folderId) {
              onDrop?.(draggedId, folderId, insertBefore);
            }
          }}
        >
          <span class="tasklens-tree-arrow">{expanded ? "▾" : "▸"}</span>
          <span class="tasklens-tree-folder-name">{folderName}</span>
        </div>
        {expanded && (
          <div class="tasklens-tree-folder-children">
            {subProjects.map((project) => (
              <ProjectTreeItem
                key={project.path}
                project={project}
                active={
                  currentView.type === "project" &&
                  currentView.projectPath === project.path
                }
                onClick={() =>
                  store.selectView({
                    type: "project",
                    projectPath: project.path,
                  })
                }
                onDrop={onDrop}
                onMoveUp={props.onMoveUp}
                onMoveDown={props.onMoveDown}
                onColorChange={props.onColorChange}
                onDelete={props.onDelete}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const { project, active, onClick, onDrop } = props;
  return (
    <div
      class={`tasklens-tree-item ${active ? "tasklens-tree-item--active" : ""}`}
      onClick={onClick}
      onContextMenu={(e: MouseEvent) => {
        showProjectContextMenu(e, project.path, project.color, contextCallbacks);
      }}
      draggable
      onDragStart={(e: DragEvent) => {
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(DRAG_MIME, project.path);
        (e.currentTarget as HTMLElement).classList.add("tasklens-tree-item--dragging");
      }}
      onDragEnd={(e: DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove("tasklens-tree-item--dragging");
      }}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        const el = e.currentTarget as HTMLElement;
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        el.classList.remove("tasklens-tree-item--drop-above", "tasklens-tree-item--drop-below");
        if (e.clientY < midY) {
          el.classList.add("tasklens-tree-item--drop-above");
        } else {
          el.classList.add("tasklens-tree-item--drop-below");
        }
      }}
      onDragLeave={(e: DragEvent) => {
        const el = e.currentTarget as HTMLElement;
        el.classList.remove("tasklens-tree-item--drop-above", "tasklens-tree-item--drop-below");
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget as HTMLElement;
        el.classList.remove("tasklens-tree-item--drop-above", "tasklens-tree-item--drop-below");

        const draggedId = e.dataTransfer?.getData(DRAG_MIME);
        if (!draggedId || draggedId === project.path) return;

        if (!draggedId.startsWith("folder:") && draggedId.startsWith("tasks/")) {
          const draggedFolder = draggedId.substring(0, draggedId.lastIndexOf("/"));
          const targetFolder = project.path.substring(0, project.path.lastIndexOf("/"));
          if (draggedFolder !== targetFolder) {
            const rect2 = el.getBoundingClientRect();
            const insertBefore = e.clientY < rect2.top + rect2.height / 2;
            onDrop?.(draggedId, project.path, insertBefore);
            return;
          }
        }

        const rect2 = el.getBoundingClientRect();
        const insertBefore = e.clientY < rect2.top + rect2.height / 2;
        onDrop?.(draggedId, project.path, insertBefore);
      }}
    >
      <span
        class="tasklens-tree-dot"
        style={project.color ? { backgroundColor: project.color } : undefined}
      />
      <span class="tasklens-tree-name">{project.name}</span>
    </div>
  );
}
