# TaskLens - Obsidian Task Management Plugin

## プロジェクト概要

Obsidian用のフルスクリーンタスク管理プラグイン。Vault内のMarkdownタスクを一元管理し、Obsidian Tasks互換フォーマットで動作する。

- **GitHub**: `suzutan/obsidian-tasklens`
- **ライセンス**: MIT

## 技術スタック

| 技術            | 用途                              |
| --------------- | --------------------------------- |
| TypeScript      | メイン言語                        |
| Preact + JSX    | UIフレームワーク（Reactではない） |
| @preact/signals | リアクティブ状態管理              |
| esbuild         | バンドラー                        |
| Obsidian API    | プラグインAPI                     |

## ビルド & デプロイ

```bash
npm run build     # production build → main.js
npm run dev       # watch mode（自動でvaultにコピー）
```

- ビルド成果物: `main.js`, `styles.css`, `manifest.json`
- esbuild.config.mjsのcopyPluginがdev時にVaultのプラグインディレクトリへ自動コピーする
- production buildの場合はVaultのプラグインディレクトリへ手動コピーが必要

## ディレクトリ構成

```
src/
├── main.ts                  # プラグインエントリ
├── settings.ts              # 設定、ビルトインフィルター定義
├── models/                  # データモデル (Task, Project, RecurrenceRule)
├── parser/                  # パーサー群
│   ├── TaskParser.ts        # Obsidian Tasksフォーマット解析
│   ├── TaskSerializer.ts    # Task → Markdown変換
│   ├── NaturalLanguageParser.ts  # 自然言語入力（日本語対応）
│   └── MigrationParser.ts   # 旧フォーマット移行
├── query/                   # クエリエンジン
│   ├── QueryParser.ts       # Obsidian Tasks互換クエリ構文パーサー
│   └── QueryEngine.ts       # フィルタ/ソート/グループ実行
├── store/                   # 状態管理
│   ├── TaskStore.ts         # メインストア（signals）
│   ├── FileWatcher.ts       # ファイル変更監視
│   └── TaskIndex.ts         # タスクインデックス
├── commands/                # コマンド
│   ├── QuickAddCommand.ts   # Ctrl+Shift+A クイック追加モーダル
│   └── MigrateCommand.ts    # 移行コマンド
├── components/              # Preact UIコンポーネント
│   ├── App.tsx              # ルートコンポーネント
│   ├── sidebar/             # サイドバー（フィルター、ラベル、ソース）
│   ├── content/             # メインコンテンツエリア
│   ├── task/                # タスク表示・編集コンポーネント
│   └── common/              # 共通コンポーネント（DatePicker, Timer等）
├── utils/                   # ユーティリティ
│   ├── DateUtils.ts         # 日付ヘルパー
│   ├── FileUtils.ts         # ファイル操作
│   ├── TagSuggest.ts        # タグ補完ロジック（QuickAdd/InlineAdd共用）
│   └── TimerUtils.ts        # タイマー計算ロジック
├── views/
│   └── TaskLensView.ts      # Obsidian View
└── dnd/                     # ドラッグ&ドロップ
```

## Obsidian Tasks フォーマット（厳守）

```markdown
- [ ] タスク名 #label ⏫ 🔁 every week 📅 2026-03-31 ⏳ 2026-03-01 🛫 2026-02-01 ✅ 2026-03-08
```

| 絵文字 | フィールド    | 意味                 |
| ------ | ------------- | -------------------- |
| ⏫     | priority=1    | 最高                 |
| 🔼     | priority=2    | 高                   |
| 🔽     | priority=3    | 低                   |
| 📅     | dueDate       | 期限（締め切り）     |
| ⏳     | scheduledDate | 予定日（作業日）     |
| 🛫     | startDate     | 開始日（着手可能日） |
| 🔁     | recurrence    | 繰り返し             |
| ✅     | doneDate      | 完了日               |

**独自拡張は禁止。** Obsidian Tasksとの完全互換を維持すること。

## UI規約

- **言語**: UIテキストは日本語
- **ラベル表記**: `#label`（`@label`ではない）
- **日付フィールド順序**: 開始日 → 予定日 → 期限
- **色**: 予定日の色は `#4fc3f7`（紫 `#692fc2` は使わない）

## NLP入力規則

自然言語パーサー (`NaturalLanguageParser.ts`) のルール:

- **裸の日付**（`3/10`, `明日`, `来週月曜`）→ **予定日**（⏳ scheduledDate）
- **`{}`で囲んだ日付**（`{2026-03-15}`, `{3/20 18:00}`）→ **期限**（📅 dueDate）
- `#tag` → ラベル追加
- `p1`〜`p3` → 優先度設定

## タイマー機能

タスクのラベルで制御（Obsidian Tasks互換を維持）:

| ラベル               | 動作                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `#countdown`         | 期限までカウントダウン                                           |
| `#elapsed`           | 開始日からの経過時間                                             |
| `#countdown-elapsed` | 期限前はカウントダウン、期限後は経過時間                         |
| `#stamina`           | 一定間隔で+1回復するリソース管理（ゲームスタミナ等）             |
| `#periodic`          | 毎日決まった時刻に定量増加するリソース管理（デイリーボーナス等） |

### リソースタイマー（独自拡張）

スタミナ/定期増加はタスク行にインラインで絵文字フォーマットで記述:

```markdown
- [ ] ゲームスタミナ #stamina ⚡ 120/200 🔄 432s 📌 2026-03-10T06:00:00Z
- [ ] デイリーボーナス #periodic 📈 30/100 +10 🕐 06:00,12:00,18:00 📌 2026-03-09T18:00:00Z
```

| 絵文字 | 用途                                   |
| ------ | -------------------------------------- |
| ⚡     | スタミナ値 current/max                 |
| 🔄     | 回復間隔（秒）                         |
| 📈     | 定期増加値 current/max +increment      |
| 🕐     | スケジュール時刻（HH:MM,カンマ区切り） |
| 📌     | 最終更新タイムスタンプ（ISO 8601）     |

実装: `TimerUtils.ts`（計算）+ `TimerDisplay.tsx`（表示、1秒interval更新）
詳細パネルでは値の調整ボタン（-1, -10, +10, リセット, MAX）を表示。

## クエリパーサー

Obsidian Tasks互換のクエリ構文。対応済み:

- `done` / `not done`
- `due today` / `due before today` / `due on YYYY-MM-DD`
- `due before 7 days ago` / `due after in 3 days`（相対日付）
- `has due date` / `no scheduled date`
- `priority is highest` / `priority above low`
- `path includes` / `description includes` / `tag includes`
- `is recurring` / `is not recurring`
- `AND` / `OR` / `NOT` / 括弧
- `sort by` / `group by` / `limit`

## コミット規約

- 機能ごとに分けてコミット
- コミットメッセージは英語、conventional commits風

## 注意事項

- QuickAddCommand.tsはPreactではなくvanilla DOM（Obsidian Modalを直接操作）
- TagSuggest.tsはQuickAdd（DOM）とTaskInlineAdd（Preact）の両方で共用
- サイドバーセクション（フィルター、ラベル、ソース）は折りたたみ可能（localStorageで状態保持）
- ラベルビューは完了タスクも表示する（`not done`フィルターなし）
