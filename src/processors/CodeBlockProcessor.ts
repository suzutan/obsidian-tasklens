import { MarkdownRenderChild, type Plugin } from "obsidian";
import { h, render } from "preact";
import { EmbedView } from "../components/embed/EmbedView";
import type { FileWatcher } from "../store/FileWatcher";
import type { TaskStore } from "../store/TaskStore";

export function registerCodeBlockProcessor(plugin: Plugin, store: TaskStore, fileWatcher: FileWatcher): void {
  plugin.registerMarkdownCodeBlockProcessor("tasklens", (source, el, _ctx) => {
    const container = el.createDiv({ cls: "tasklens-embed-container" });

    render(h(EmbedView, { store, fileWatcher, query: source }), container);

    const child = new MarkdownRenderChild(container);
    child.onunload = () => {
      render(null, container);
    };
    _ctx.addChild(child);
  });
}
