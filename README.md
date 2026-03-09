<p align="center">
  <img src="https://img.shields.io/badge/Obsidian-%23483699?style=for-the-badge&logo=obsidian&logoColor=white" alt="Obsidian" />
  <img src="https://img.shields.io/badge/TypeScript-%23007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Preact-%23673AB8?style=for-the-badge&logo=preact&logoColor=white" alt="Preact" />
  <img src="https://img.shields.io/github/license/suzutan/obsidian-tasklens?style=for-the-badge" alt="License" />
</p>

# TaskLens

**Obsidian 用のフルスクリーンタスク管理プラグイン**

Vault 内の Markdown タスクを一元管理。Obsidian Tasks 互換のフォーマットで、自然言語入力・リアルタイムタイマー・柔軟なフィルタリングを提供します。

---

## Features

### Task Management

- **フルスクリーンビュー** — サイドバー + メインコンテンツ + 詳細パネルの3カラムレイアウト
- **ドラッグ & ドロップ** — タスクの並び替え、セクション間の移動
- **サブタスク** — インデントによる階層管理
- **繰り返し** — `every day`, `every week on Saturday`, `every month on the 15th` など
- **位置情報** — URL・住所・座標をタスクに紐付け、Google Maps 連携

### Natural Language Input

タスク入力欄で自然言語をリアルタイム解析します。

| 入力 | 解析結果 |
|------|---------|
| `明日 レポート提出` | 予定日 ⏳ = 明日 |
| `来週月曜 ミーティング` | 予定日 ⏳ = 来週月曜日 |
| `{2026-03-15 18:00}` | 期限 📅 = 2026-03-15 18:00 |
| `{3/20}` | 期限 📅 = 3月20日 |
| `p1` | 優先度 = 最高 |
| `#work #urgent` | ラベル追加 |

**ルール:**
- 自然言語の日付（`3/10`, `明日`, `来週`） → **予定日** ⏳
- `{}` で囲んだ日付 → **期限** 📅

### Timer Display

タスクにラベルを付けるだけで、リアルタイム更新されるタイマーとして動作します。

#### Countdown (`#countdown`)

期限までの残り時間をカウントダウン表示。進捗に応じて色が変化します。

```markdown
- [ ] プロジェクト納期 #countdown 📅 2026-06-30
```

#### Elapsed (`#elapsed`)

開始日からの経過時間を表示し続けます。記念日や継続日数の記録に。

```markdown
- [ ] 禁煙開始 #elapsed 🛫 2026-01-01
```

#### Countdown → Elapsed (`#countdown-elapsed`)

期限前はカウントダウン、期限後は自動的に経過時間表示に切り替わります。

```markdown
- [ ] 試験日 #countdown-elapsed 📅 2026-07-15T09:00
```

| 進捗 | 色 |
|------|----|
| 0-25% | 🟢 Green |
| 25-50% | 🔵 Blue |
| 50-75% | 🟠 Orange |
| 75-100% / 期限切れ | 🔴 Red |

### Smart Filtering

Obsidian Tasks 互換のクエリ構文で柔軟にフィルタリング。

```
not done
due before today
priority above low
sort by priority
sort by due date
group by filename
limit 20
```

**対応フィルタ:**

| カテゴリ | 例 |
|---------|-----|
| 完了状態 | `done`, `not done` |
| 期限 | `due today`, `due before today`, `due on 2026-03-15` |
| 予定日 | `scheduled today`, `scheduled after today` |
| 開始日 | `starts today`, `starts before today` |
| 優先度 | `priority is highest`, `priority above low` |
| テキスト検索 | `description includes レポート`, `path includes tasks/` |
| ラベル | `tag includes #work` |
| 繰り返し | `is recurring`, `is not recurring` |
| 日付有無 | `has due date`, `no scheduled date` |
| 論理演算 | `AND`, `OR`, `NOT`, 括弧 `()` |
| ソート | `sort by due date`, `sort by priority desc` |
| グループ | `group by filename`, `group by priority`, `group by tags` |

#### Built-in Filters

| 名前 | 内容 |
|------|------|
| 今日 | 期限・予定が今日以前の未完了タスク |
| 近日中 | 期限のある未完了タスク（期限順） |
| 期限切れ | 期限を過ぎた未完了タスク |
| すべて | 全未完了タスク |

カスタムフィルターも設定画面から自由に追加できます。

### Quick Add

**Ctrl+Shift+A** でどこからでもタスクを素早く追加。

- **リアルタイムプレビュー** — 入力と同時にメタデータ解析結果を表示
- **ノート検索** — タスク追加先のノートをインクリメンタルサーチで選択
- **セクション選択** — ノート内の `##` セクションを選んで追加先を指定
- **タグ補完** — `#` 入力で既存ラベルをサジェスト（矢印キー + Tab/Enter で確定）

### Obsidian Tasks Format

標準的な Obsidian Tasks の絵文字フォーマットと完全互換。

```markdown
- [ ] タスク名 #label ⏫ 🔁 every week 📅 2026-03-31 ⏳ 2026-03-01 🛫 2026-02-01 ✅ 2026-03-08
```

| 絵文字 | 意味 | フィールド |
|--------|------|-----------|
| ⏫ | 最高優先度 | priority = 1 |
| 🔼 | 高優先度 | priority = 2 |
| 🔽 | 低優先度 | priority = 3 |
| 📅 | 期限（締め切り） | dueDate |
| ⏳ | 予定日（作業日） | scheduledDate |
| 🛫 | 開始日（着手可能日） | startDate |
| 🔁 | 繰り返し | recurrence |
| ✅ | 完了日 | doneDate |

---

## Installation

### Manual Install

1. [Releases](https://github.com/suzutan/obsidian-tasklens/releases) から `main.js`, `manifest.json`, `styles.css` をダウンロード
2. Vault の `.obsidian/plugins/obsidian-tasklens/` にコピー
3. Obsidian の設定 → コミュニティプラグイン → TaskLens を有効化

### Build from Source

```bash
git clone https://github.com/suzutan/obsidian-tasklens.git
cd obsidian-tasklens
npm install
npm run build
```

`main.js`, `manifest.json`, `styles.css` を Vault のプラグインフォルダにコピーしてください。

---

## Usage

### Getting Started

1. プラグインを有効化すると、リボンに ✓ アイコンが追加されます
2. クリックして TaskLens ビューを開きます
3. タスクファイル（例: `tasks/inbox.md`）を用意します:

```markdown
---
title: Inbox
---

# Inbox

## タスク

- [ ] 牛乳を買う 📅 2026-03-15
- [ ] レポート提出 ⏫ 📅 2026-03-20
```

### Date Fields

| フィールド | 意味 | 使い方 |
|-----------|------|--------|
| **開始日** 🛫 | 着手可能日 | この日まではタスクが「まだ始められない」状態 |
| **予定日** ⏳ | 作業予定日 | 実際に取り組む日。「今日やること」フィルタに出る |
| **期限** 📅 | 締め切り | この日までに完了すべき。過ぎると「期限切れ」表示 |

### Keyboard Shortcuts

| ショートカット | アクション |
|---------------|-----------|
| `Ctrl+Shift+A` | クイック追加モーダルを開く |

---

## Tech Stack

| 技術 | 用途 |
|------|------|
| [TypeScript](https://www.typescriptlang.org/) | 型安全な開発 |
| [Preact](https://preactjs.com/) | 軽量UIフレームワーク |
| [@preact/signals](https://preactjs.com/guide/v10/signals/) | リアクティブ状態管理 |
| [esbuild](https://esbuild.github.io/) | 高速ビルド |
| [Obsidian API](https://docs.obsidian.md/) | プラグインインテグレーション |

---

## License

[MIT](LICENSE)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/suzutan">suzutan</a>
</p>
