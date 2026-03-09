# TaskLens - Obsidian Task Management Plugin

Obsidian用フルスクリーンタスク管理プラグイン。Obsidian Tasks互換フォーマットで動作する。

## 技術スタック

- **Preact + JSX**（Reactではない）— `jsxImportSource: "preact"`, esbuildで`react→preact/compat`エイリアス
- **@preact/signals** — リアクティブ状態管理
- **esbuild** — CJS形式でバンドル（Obsidian要件）
- **TypeScript** — `strictNullChecks`, `noImplicitAny` 有効

## ビルド

```bash
npm run build     # production build → main.js（sourcemapなし）
npm run dev       # watch mode（~/Documents/obsidian/main/.obsidian/plugins/tasklens/ へ自動コピー）
```

- **テスト**: `npm test`（vitest run）, `npm run test:watch`（vitest watch）
- **リント/フォーマット**:
  - `npm run format` — Biome フォーマッター実行（`src/` を自動修正）
  - `npm run format:check` — Biome チェック（format + lint、CI用）
  - `npm run lint` — Oxlint 実行（TypeScript固有lint）
  - Biome: formatter（indent 2 spaces, lineWidth 120）+ recommended linter ルール
  - Oxlint: `typescript/no-explicit-any: error`（`any` 型の使用を禁止）
- **プリコミットフック**: Lefthook（biome check, oxlint, tsc --noEmit, npm test を並列実行）
- 成果物: `main.js`（バンドル）, `styles.css`（手書き）, `manifest.json`
- `styles.css` はObsidian CSSカスタムプロパティ（`--text-normal`, `--background-primary`等）を使用
- esbuildの外部モジュール: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`

## ディレクトリ構成

```
src/
├── main.ts                  # プラグインエントリ
├── settings.ts              # 設定、ビルトインフィルター定義
├── models/                  # データモデル (Task, Project, RecurrenceRule)
├── parser/                  # パーサー群
│   ├── TaskParser.ts        # Obsidian Tasksフォーマット → Task
│   ├── TaskSerializer.ts    # Task → Markdown
│   ├── NaturalLanguageParser.ts  # 自然言語入力（日本語対応）
│   └── MigrationParser.ts   # 旧フォーマット移行
├── query/                   # Obsidian Tasks互換クエリエンジン
├── store/                   # 状態管理（signals）、ファイル監視、インデックス
├── commands/                # QuickAddCommand, MigrateCommand, TimerGeneratorCommand
├── components/              # Preact UIコンポーネント
│   ├── App.tsx              # ルート
│   ├── sidebar/             # サイドバー（フィルター、ラベル、ソース）
│   ├── content/             # メインコンテンツ（Inbox, Today, Filter, Project）
│   ├── task/                # タスク表示・編集・詳細パネル
│   └── common/              # DatePicker, TimerDisplay, EmojiPicker等
├── utils/                   # DateUtils, FileUtils, TagSuggest, TimerUtils
└── views/TaskLensView.ts    # Obsidian View
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

`NaturalLanguageParser.ts` のルール:

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

### リソースタイマー（独自拡張フォーマット）

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

## 開発原則

- **DRY, KISS, YAGNI** を守る
- フォールバックコードは書かない
- 将来の自分（claude code含む）や他の人が見たときにコンテキストを理解できるコードを書く

## 開発サイクル

1. 最新のmaster/mainを起点にブランチを作成
2. 区切りの良い作業単位でcommit,push
3. 1つ目のコミットを行った後は必ずPRを起票する
   - master/mainとブランチの差分を確認し、PR title, bodyを作成・または更新する。
   - PR Bodyは `.github/pull_request_template.md` をベースに書くこと。
   - PR jobが成功することを確認する
4. PR checkがpassしたらマージする

## コミット規約

- 機能ごとに分けてコミット
- コミットメッセージは英語、conventional commits風

## アーキテクチャ上の注意

- `QuickAddCommand.ts` はPreactではなくvanilla DOM（Obsidian Modalを直接操作）
- `TagSuggest.ts` はQuickAdd（DOM）とTaskInlineAdd（Preact）の両方で共用
- サイドバーセクション（フィルター、ラベル、ソース）は折りたたみ可能（localStorageで状態保持）
- ラベルビューは完了タスクも表示する（`not done`フィルターなし）
- `QueryParser.ts` はObsidian Tasks互換クエリ構文を実装（対応構文はコード参照）
