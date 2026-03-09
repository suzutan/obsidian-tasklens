import { type App, TFile, TFolder } from "obsidian";

/**
 * Get all .md files in the vault, excluding specified folders.
 */
export function getAllMarkdownFiles(app: App, excludeFolders: string[]): TFile[] {
  const files: TFile[] = [];
  const root = app.vault.getRoot();
  collectFiles(root, files, excludeFolders);
  return files;
}

function collectFiles(folder: TFolder, result: TFile[], excludeFolders: string[]): void {
  for (const child of folder.children) {
    if (child instanceof TFolder) {
      // Check if this folder should be excluded
      if (excludeFolders.some((ex) => child.path === ex || child.path.startsWith(`${ex}/`))) {
        continue;
      }
      collectFiles(child, result, excludeFolders);
    } else if (child instanceof TFile && child.extension === "md") {
      result.push(child);
    }
  }
}

/**
 * Check if a file path is in an excluded folder.
 */
export function isExcluded(filePath: string, excludeFolders: string[]): boolean {
  return excludeFolders.some((ex) => filePath === ex || filePath.startsWith(`${ex}/`));
}

export function getFileName(file: TFile): string {
  return file.basename;
}
