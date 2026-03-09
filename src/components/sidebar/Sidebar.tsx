import { Menu, type App as ObsidianApp } from "obsidian";
import { useEffect, useRef, useState } from "preact/hooks";
import { BUILT_IN_FILTERS, type FilterDefinition } from "../../settings";
import type { FileWatcher } from "../../store/FileWatcher";
import type { TaskStore } from "../../store/TaskStore";
import { EmojiPicker } from "../common/EmojiPicker";
import { NavItem } from "./NavItem";

interface SidebarProps {
  store: TaskStore;
  fileWatcher: FileWatcher;
  app: ObsidianApp;
  onSaveFilters?: (filters: FilterDefinition[]) => void;
}

export function Sidebar({ store, fileWatcher: _fileWatcher, app: _app, onSaveFilters }: SidebarProps) {
  const currentView = store.currentView.value;
  const todayCount = store.todayCount.value;
  const overdueCount = store.overdueCount.value;
  const labels = store.allLabels.value;
  const customFilters = store.customFilters.value;
  const sourcePaths = store.allSourcePaths.value;

  // Collapsible section state (persisted in localStorage)
  const loadCollapsed = (): Record<string, boolean> => {
    try {
      const saved = localStorage.getItem("tasklens-collapsed-sections");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  const toggleSection = (key: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("tasklens-collapsed-sections", JSON.stringify(next));
      return next;
    });
  };

  // Add/Edit filter state
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null); // null = adding new
  const [showFilterForm, setShowFilterForm] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [filterIcon, setFilterIcon] = useState("🔍");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showFilterForm && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [showFilterForm]);

  // Group source paths by top-level folder
  const folders = new Map<string, string[]>();
  for (const p of sourcePaths) {
    const firstSlash = p.indexOf("/");
    const folder = firstSlash > 0 ? p.substring(0, firstSlash) : "(root)";
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder)?.push(p);
  }

  const getCount = (filterId: string): number | undefined => {
    if (filterId === "__today") return todayCount || undefined;
    if (filterId === "__overdue") return overdueCount || undefined;
    return undefined;
  };

  const openAddForm = () => {
    setEditingFilterId(null);
    setFilterName("");
    setFilterQuery("");
    setFilterIcon("🔍");
    setShowFilterForm(true);
  };

  const openEditForm = (filter: FilterDefinition) => {
    setEditingFilterId(filter.id);
    setFilterName(filter.name);
    setFilterQuery(filter.query);
    setFilterIcon(filter.icon || "🔍");
    setShowFilterForm(true);
  };

  const closeForm = () => {
    setShowFilterForm(false);
    setEditingFilterId(null);
    setFilterName("");
    setFilterQuery("");
    setFilterIcon("🔍");
  };

  const handleSaveFilter = () => {
    if (!filterName.trim() || !filterQuery.trim()) return;

    let updated: FilterDefinition[];

    if (editingFilterId) {
      // Edit existing
      updated = customFilters.map((f) =>
        f.id === editingFilterId
          ? { ...f, name: filterName.trim(), query: filterQuery.trim(), icon: filterIcon || "🔍" }
          : f,
      );
    } else {
      // Add new
      const newFilter: FilterDefinition = {
        id: `custom_${Date.now()}`,
        name: filterName.trim(),
        icon: filterIcon || "🔍",
        query: filterQuery.trim(),
      };
      updated = [...customFilters, newFilter];
      // Select the new filter
      store.selectView({ type: "filter", filterId: newFilter.id });
    }

    store.setCustomFilters(updated);
    onSaveFilters?.(updated);
    closeForm();
  };

  const handleDeleteFilter = (filterId: string) => {
    const updated = customFilters.filter((f) => f.id !== filterId);
    store.setCustomFilters(updated);
    onSaveFilters?.(updated);
    if (currentView.type === "filter" && currentView.filterId === filterId) {
      store.selectView({ type: "filter", filterId: "__today" });
    }
  };

  const handleFilterContextMenu = (e: MouseEvent, filter: FilterDefinition) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle("編集");
      item.setIcon("pencil");
      item.onClick(() => openEditForm(filter));
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle("削除");
      item.setIcon("trash");
      item.onClick(() => handleDeleteFilter(filter.id));
    });
    menu.showAtMouseEvent(e);
  };

  return (
    <div class="tasklens-sidebar-inner">
      {/* Built-in filters */}
      <nav class="tasklens-nav">
        {BUILT_IN_FILTERS.map((filter) => (
          <NavItem
            key={filter.id}
            icon={filter.icon}
            label={filter.name}
            count={getCount(filter.id)}
            active={currentView.type === "filter" && currentView.filterId === filter.id}
            onClick={() => store.selectView({ type: "filter", filterId: filter.id })}
          />
        ))}
      </nav>

      {/* Custom filters */}
      <div class="tasklens-sidebar-section">
        <div class="tasklens-sidebar-section-header" onClick={() => toggleSection("filters")}>
          <div class="tasklens-section-toggle">
            <span class={`tasklens-section-chevron ${collapsed.filters ? "is-collapsed" : ""}`}>›</span>
            <span>フィルター</span>
          </div>
          <button
            type="button"
            class="tasklens-btn-icon"
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              openAddForm();
            }}
            title="フィルターを追加"
          >
            +
          </button>
        </div>
        {!collapsed.filters && (
          <>
            {customFilters.map((filter) => (
              <div key={filter.id} onContextMenu={(e: MouseEvent) => handleFilterContextMenu(e, filter)}>
                <NavItem
                  icon={filter.icon || "🔍"}
                  label={filter.name}
                  active={currentView.type === "filter" && currentView.filterId === filter.id}
                  onClick={() => store.selectView({ type: "filter", filterId: filter.id })}
                />
              </div>
            ))}
            {showFilterForm && (
              <div class="tasklens-add-filter">
                <div class="tasklens-filter-name-row">
                  <EmojiPicker value={filterIcon} onChange={setFilterIcon} />
                  <input
                    ref={nameInputRef}
                    type="text"
                    class="tasklens-input tasklens-filter-name-input"
                    value={filterName}
                    placeholder="フィルター名"
                    onInput={(e) => setFilterName((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") closeForm();
                    }}
                  />
                </div>
                <textarea
                  class="tasklens-input tasklens-filter-query-input"
                  value={filterQuery}
                  placeholder={`not done\ndue today\nsort by priority`}
                  onInput={(e) => setFilterQuery((e.target as HTMLTextAreaElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") closeForm();
                  }}
                  rows={4}
                />
                <div class="tasklens-add-filter-actions">
                  <button
                    type="button"
                    class="tasklens-btn tasklens-btn-primary tasklens-btn--small"
                    onClick={handleSaveFilter}
                  >
                    {editingFilterId ? "保存" : "追加"}
                  </button>
                  <button type="button" class="tasklens-btn tasklens-btn--small" onClick={closeForm}>
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Labels */}
      <div class="tasklens-sidebar-section">
        <div class="tasklens-sidebar-section-header" onClick={() => toggleSection("labels")}>
          <div class="tasklens-section-toggle">
            <span class={`tasklens-section-chevron ${collapsed.labels ? "is-collapsed" : ""}`}>›</span>
            <span>ラベル</span>
          </div>
          {labels.length > 0 && <span class="tasklens-section-count">{labels.length}</span>}
        </div>
        {!collapsed.labels && (
          <>
            {labels.length === 0 && <div class="tasklens-sidebar-empty">ラベルなし</div>}
            {labels.map((label) => (
              <NavItem
                key={label}
                icon="🏷"
                label={`#${label}`}
                active={currentView.type === "label" && currentView.label === label}
                onClick={() => store.selectView({ type: "label", label })}
              />
            ))}
          </>
        )}
      </div>

      {/* Source files by folder */}
      <div class="tasklens-sidebar-section">
        <div class="tasklens-sidebar-section-header" onClick={() => toggleSection("sources")}>
          <div class="tasklens-section-toggle">
            <span class={`tasklens-section-chevron ${collapsed.sources ? "is-collapsed" : ""}`}>›</span>
            <span>ソース</span>
          </div>
          {folders.size > 0 && <span class="tasklens-section-count">{folders.size}</span>}
        </div>
        {!collapsed.sources && (
          <>
            {folders.size === 0 && <div class="tasklens-sidebar-empty">タスクが見つかりません</div>}
            {[...folders.entries()].map(([folder, paths]) => (
              <div key={folder} class="tasklens-sidebar-source-group">
                <NavItem
                  icon="📁"
                  label={`${folder} (${paths.length})`}
                  active={currentView.type === "source" && currentView.path === folder}
                  onClick={() => store.selectView({ type: "source", path: folder })}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
