import type { App as ObsidianApp } from "obsidian";
import type { VNode } from "preact";
import { useMemo, useRef } from "preact/hooks";
import type { Task } from "../../models/Task";
import type { FileWatcher } from "../../store/FileWatcher";
import type { TaskStore } from "../../store/TaskStore";
import { DateChip } from "../common/DateChip";
import { LabelBadge } from "../common/LabelBadge";
import { PriorityFlag } from "../common/PriorityFlag";
import { TimerDisplay } from "../common/TimerDisplay";
import { TaskCheckbox } from "./TaskCheckbox";

interface TaskItemProps {
  task: Task;
  store: TaskStore;
  fileWatcher: FileWatcher;
  showProject?: boolean;
  onDragStart?: (e: DragEvent, task: Task) => void;
  onDragOver?: (e: DragEvent, task: Task) => void;
  onDrop?: (e: DragEvent, task: Task) => void;
}

export function TaskItem({ task, store, fileWatcher, showProject, onDragStart, onDragOver, onDrop }: TaskItemProps) {
  const isSelected = store.selectedTaskId.value === task.id;
  const itemRef = useRef<HTMLDivElement>(null);

  const handleToggle = async () => {
    if (task.noteMode) return;
    if (task.completed) {
      await fileWatcher.uncompleteTask(task.id);
    } else {
      await fileWatcher.completeTask(task.id);
    }
  };

  const handleClick = () => {
    store.selectTask(isSelected ? null : task.id);
  };

  const projectName = showProject ? task.projectPath.replace(/\.md$/, "").split("/").pop() : null;

  return (
    <div
      ref={itemRef}
      class={`tasklens-task-item ${isSelected ? "tasklens-task-item--selected" : ""} ${
        task.completed ? "tasklens-task-item--done" : ""
      } ${task.noteMode ? "tasklens-task-item--note" : ""}`}
      style={{ paddingLeft: `${task.indent * 28 + 4}px` }}
      onClick={handleClick}
      draggable
      onDragStart={(e: DragEvent) => {
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        // Use the whole row as drag image
        if (itemRef.current) {
          e.dataTransfer.setDragImage(itemRef.current, 20, 20);
        }
        (e.currentTarget as HTMLElement).classList.add("tasklens-task-item--dragging");
        onDragStart?.(e, task);
      }}
      onDragEnd={(e: DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove("tasklens-task-item--dragging");
      }}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        const el = e.currentTarget as HTMLElement;
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        el.classList.remove("tasklens-task-item--drop-above", "tasklens-task-item--drop-below");
        if (e.clientY < midY) {
          el.classList.add("tasklens-task-item--drop-above");
        } else {
          el.classList.add("tasklens-task-item--drop-below");
        }
        onDragOver?.(e, task);
      }}
      onDragLeave={(e: DragEvent) => {
        const el = e.currentTarget as HTMLElement;
        el.classList.remove("tasklens-task-item--drop-above", "tasklens-task-item--drop-below");
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget as HTMLElement;
        el.classList.remove("tasklens-task-item--drop-above", "tasklens-task-item--drop-below");
        onDrop?.(e, task);
      }}
    >
      <div class="tasklens-task-drag-handle">⠿</div>
      {task.noteMode ? (
        <span class="tasklens-note-bullet">•</span>
      ) : (
        <TaskCheckbox priority={task.priority} completed={task.completed} onChange={handleToggle} />
      )}
      <div class="tasklens-task-content">
        <span class={`tasklens-task-text ${task.completed ? "tasklens-task-text--done" : ""}`}>
          <RenderContent text={task.content} />
        </span>
        <div class="tasklens-task-meta">
          {task.dueDate && <DateChip dueDate={task.dueDate} dueTime={task.dueTime} recurrence={task.recurrence} />}
          {task.scheduledDate && (
            <span class="tasklens-date-chip" style={{ color: "#4fc3f7" }}>
              ⏳ {task.scheduledDate}
              {task.scheduledTime ? ` ${task.scheduledTime}` : ""}
            </span>
          )}
          {task.startDate && (
            <span class="tasklens-date-chip" style={{ color: "#808080" }}>
              🛫 {task.startDate}
              {task.startTime ? ` ${task.startTime}` : ""}
            </span>
          )}
          {task.location && (
            <span
              class={`tasklens-location-chip ${getLocationUrl(task.location) ? "tasklens-location-chip--link" : ""}`}
              onClick={(e: MouseEvent) => {
                if (!task.location) return;
                const url = getLocationUrl(task.location);
                if (url) {
                  e.stopPropagation();
                  window.open(url, "_blank");
                }
              }}
            >
              📍 {formatLocationShort(task.location)}
            </span>
          )}
          <TimerDisplay task={task} variant="chip" />
          {task.labels.map((label) => (
            <LabelBadge key={label} label={label} />
          ))}
          {showProject && projectName && <span class="tasklens-task-project">{projectName}</span>}
        </div>
      </div>
      <PriorityFlag priority={task.priority} />
    </div>
  );
}

/** Get a clickable URL from a location value, or null if not linkable */
function getLocationUrl(loc: string): string | null {
  if (/^https?:\/\//.test(loc)) return loc;
  if (/^geo:/.test(loc)) {
    return `https://www.google.com/maps/search/?api=1&query=${loc.replace("geo:", "")}`;
  }
  if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(loc)) {
    return `https://www.google.com/maps/search/?api=1&query=${loc}`;
  }
  return null;
}

/** Shorten a location value for chip display */
function formatLocationShort(loc: string): string {
  if (/^https?:\/\//.test(loc)) {
    try {
      return new URL(loc).hostname;
    } catch {
      return loc.slice(0, 20);
    }
  }
  if (loc.length > 20) return `${loc.slice(0, 20)}…`;
  return loc;
}

/**
 * Render task content with markdown links and Obsidian wiki-links as clickable elements.
 * Supports: [text](url), [[note]], [[note|alias]]
 */
export function RenderContent({ text }: { text: string }) {
  const parts = useMemo(() => {
    const result: (string | VNode)[] = [];
    // Match markdown links [text](url) and wiki-links [[target]] or [[target|alias]]
    const re = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = re.exec(text);

    while (match !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }

      if (match[1] !== undefined && match[2]) {
        // Markdown link: [text](url)
        const url = match[2];
        result.push(
          <a
            class="tasklens-task-link"
            href={url}
            onClick={(e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(url, "_blank");
            }}
          >
            {match[1] || url}
          </a>,
        );
      } else if (match[3]) {
        // Wiki-link: [[target]] or [[target|alias]]
        const target = match[3];
        const alias = match[4] || target;
        result.push(
          <span
            class="tasklens-task-wikilink"
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              // Open the note in Obsidian via the global app
              const app = (window as unknown as { app: ObsidianApp }).app;
              if (app) {
                const file = app.metadataCache.getFirstLinkpathDest(target, "");
                if (file) {
                  app.workspace.getLeaf(false).openFile(file);
                }
              }
            }}
          >
            {alias}
          </span>,
        );
      }

      lastIndex = match.index + match[0].length;
      match = re.exec(text);
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result;
  }, [text]);

  return <>{parts}</>;
}
