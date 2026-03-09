import { type App, Notice, TFile, TFolder } from "obsidian";
import { migrateFileContent } from "../parser/MigrationParser";

export async function runMigration(app: App, taskFolder: string): Promise<void> {
  const folder = app.vault.getAbstractFileByPath(taskFolder);
  if (!folder || !(folder instanceof TFolder)) {
    new Notice(`フォルダ "${taskFolder}" が見つかりません`);
    return;
  }

  // Create backup
  const backupFolder = `_backup_tasks_migration`;
  const backupExists = app.vault.getAbstractFileByPath(backupFolder);
  if (!backupExists) {
    await app.vault.createFolder(backupFolder);
  }

  const files = collectMdFiles(folder);
  let migratedCount = 0;

  for (const file of files) {
    const content = await app.vault.read(file);

    // Check if file has emoji format
    if (!hasEmojiFormat(content)) continue;

    // Backup
    const backupPath = `${backupFolder}/${file.name}`;
    const existingBackup = app.vault.getAbstractFileByPath(backupPath);
    if (!existingBackup) {
      await app.vault.create(backupPath, content);
    }

    // Migrate
    const migrated = migrateFileContent(content);
    if (migrated !== content) {
      await app.vault.modify(file, migrated);
      migratedCount++;
    }
  }

  new Notice(`マイグレーション完了: ${migratedCount} ファイルを変換しました`);
}

function hasEmojiFormat(content: string): boolean {
  return /[⏫🔼🔽📅⏳🔁✅]/u.test(content);
}

function collectMdFiles(folder: TFolder): TFile[] {
  const result: TFile[] = [];
  for (const child of folder.children) {
    if (child instanceof TFile && child.extension === "md") {
      result.push(child);
    } else if (child instanceof TFolder) {
      result.push(...collectMdFiles(child));
    }
  }
  return result;
}
