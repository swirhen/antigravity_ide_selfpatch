# 🚀 Antigravity IDE Enhanced Chat & Session Patch

Google DeepMind の次世代 AI エディタ **Antigravity IDE** のチャットパネル（Agent Side Panel）に、**「セッション一覧ドロワー」「セッション名の変更」「ピン留め」「Enter改行 / Ctrl+Enter送信」** を追加するセルフパッチツールです。

独立モジュール構成を採用しており、インストーラー（`apply_patch.py`）を実行するだけで安全かつ自動的に適用されます。`product.json` のチェックサム更新も自動で行われるため、**破損警告（Corrupted Installation WARNING）は発生しません**。(パッチ適用直後は警告が表示される可能性がありますが、その場合は再起動すれば出なくなるはずです)

---

## ✨ 主な機能

### 1. 📂 セッション一覧ドロワー (`F4` / `:resume`)

チャットペイン最上部に、折りたたみ式のセッション一覧ドロワーを常設します（バーには「セッションリストを開く」と表示されています）

- **現在セッション最上位ソート**: 現在開いているセッションが、更新時刻やピン留め状態にかかわらず**常にリストの一番上（最上位）に固定表示**されます。
- **視覚的インジケーター**: 現在開いているセッションの左端に**青いラジオアイコン**を表示。ピン留め状態は右側のピン留めボタン（金色ピンアイコン）で判別できます。
- **キーボード操作対応**: `↑` / `↓` で選択、`Enter` で即時切り替え、`Escape` で閉じます。
- **検索フィルター**: ドロワー上部の検索バーから、過去のセッションをインクリメンタル検索可能。
- **セッション削除**: ゴミ箱アイコンをクリックして不要なセッションを削除可能（現在セッション削除時は自動で新規会話を開始）。

### 2. ✏️ セッション名の変更（タイトルクリック / `F2` / `:rename`）

チャットペイン最上部の**セッションタイトルをクリック**するか、チャット欄で `F2` を押すか、`:rename <新しい名前>`（短縮 `:ren`）を入力して Enter を押すだけで、セッション名を変更できます。

- タイトルにマウスを乗せると下線が表示され、クリックで直感的に変更可能。
- 引数なしで実行した場合は、現在のタイトルがあらかじめ入力されたモーダルダイアログが出現。
- 決定・キャンセル後、自動的にチャット入力欄へキーボードフォーカスが復帰します。

### 3. 📌 セッションのピン留め (`F6` / `:pin`)

重要な会話セッションをワンクリックまたはキー操作でピン留めできます。

- ドロワーヘッダーのピンボタン、または各行のピンアイコンをクリック。
- ショートカットキー `F6`（ピン留め）/ `Ctrl + F6`（ピン解除）にも対応。
- ピン留めされたセッションは、ドロワー内で上位に固定表示されます。

### 4. ⌨️ チャット改行パッチ（Enter改行 / Ctrl+Enter送信）

日本語入力や長文プロンプトの作成を快適にするため、チャット入力欄のキー挙動を入れ替えます。

- **`Enter`**: 改行（Shift+Enter を押す必要がなくなります）
- **`Ctrl + Enter`** (Mac: `Cmd + Enter`): メッセージ送信
- **コロンコマンド即時実行**: `:` から始まるコマンド（`:res`, `:ren`, `:p` 等）は、Ctrl を押さずに通常の `Enter` 1回で即座に実行されます。
- ※この挙動は、後述の設定ダイアログからいつでも ON/OFF 切り替え可能です。

### 5. ⚙️ 設定ダイアログ（GUI 設定画面）

ドロワーバー右端の **歯車アイコン（チャットペインパッチ設定ボタン）** をクリックすると、設定ダイアログが開きます。

- **「チャットをEnterで送信しない」トグルスイッチ**:
  Enter改行 / Ctrl+Enter送信（ON）と、通常のチャット挙動（OFF: Enter送信 / Shift+Enter改行）を切り替え可能。
- **チャットコマンドのカスタマイズ**:
  各機能の通常コマンド名（例: `:resume`）および短縮コマンド名（例: `:res`）を自由に変更できます。
- **キーボードショートカット設定（keybindings.json を直接編集）**:
  ダイアログ内の「`keybindings.json を開く`」ボタンから直接設定ファイルを開けます。
  ダイアログ内にはパッチで追加されたコマンド（`antigravity.session.*`）と規定キー、機能内容が表示されているので、keybindings.json編集時に参考にしてください。（※現在、ショートカットキー設定(GUI)はフリーズが多発するため、keybindings.jsonを直接編集することを推奨します。）
- **保存とリロード**:
  設定保存後に「保存してリロード」を押すだけで、ウィンドウの再読み込みまで自動で行われます。

---

## 📋 ショートカットキー & コマンド一覧

| 機能 | ショートカットキー | チャットコマンド (Enter即時実行) |
| :--- | :--- | :--- |
| **セッション一覧ドロワー開閉** | `F4` | `:resume` / `:res` |
| **セッション名変更** | `F2` | `:rename <名前>` / `:ren` |
| **現在のセッションをピン留め** | `F6` | `:pin` / `:p` |
| **現在のセッションのピン解除** | `Ctrl + F6` | `:unpin` / `:up` |
| **新規セッション開始** | `Ctrl + F4` | `:new` / `:n` |
| **メッセージ送信** | `Ctrl + Enter` (Mac: `Cmd + Enter`) | — |
| **改行** | `Enter` | — |

※ショートカットキーは IDE 内部コマンド（`antigravity.session.*`）として登録されるため、「キーボード ショートカット」設定から自由にお好みのキーへ変更できます。

---

## 🛠️ インストール方法

### 動作環境

- **OS**: Windows / macOS / Linux
- **前提**: Python 3.8 以上がインストールされていること

### 手順

#### 方法 A: 配布用 ZIP をダウンロード（推奨・Git不要）

1. [Releases ページ](https://github.com/swirhen/antigravity_ide_selfpatch/releases) から最新の `antigravity_ide_selfpatch_vX.X.X.zip` をダウンロードして解凍します。
2. 解凍したフォルダでターミナルを開き、以下を実行します：

   ```bash
   python apply_patch.py
   ```

3. IDE 上で `F1` または `Ctrl + Shift + P`（Mac: `Cmd + Shift + P`）を押し、**`Developer: Reload Window`**（開発者: ウィンドウの再読み込み）を実行します。

#### 方法 B: リポジトリをクローン

```bash
git clone https://github.com/swirhen/antigravity_ide_selfpatch.git
cd antigravity_ide_selfpatch
python apply_patch.py
```

実行後、同様に `Developer: Reload Window` を実行します。

これだけで、すべての拡張機能が即座に有効化されます！

---

## 🔄 IDE アップデート後の再適用

Antigravity IDE の本体アップデートが実施されると、本体 JS ファイルが公式の初期状態に上書きされます。
その場合は、再度ターミナルで本ツールのスクリプトを実行するだけで即座に復旧できます：

```bash
python apply_patch.py
```

---

## 🧩 アーキテクチャとカスタマイズ

本パッチはメンテナンス性と安全性を考慮した**モジュール分離アーキテクチャ**を採用しています：

```text
antigravity_ide_selfpatch/
├── antigravity-session-patch.js                  # 独立モジュール原本 (UI & 全ロジック)
├── apply_patch.py                                # ワンクリック自動インストーラー
└── README.md                                     # 本ドキュメント
```

- **機能追加・デザイン調整**:
  圧縮された本体 JS を手動で編集する必要はありません。手元の **`antigravity-session-patch.js`** だけを通常のエディタで自由に編集し、`python apply_patch.py` を実行すれば、本体へ安全に反映されます。

---

## 🔙 アンインストール（ロールバック）

パッチを完全に解除し、元の公式状態に戻したい場合は以下のコマンドを実行します：

### Windows (PowerShell)

```powershell
Copy-Item "$env:LOCALAPPDATA\Programs\Antigravity IDE\resources\app\out\vs\workbench\workbench.desktop.main.js.backup_before_patch" "$env:LOCALAPPDATA\Programs\Antigravity IDE\resources\app\out\vs\workbench\workbench.desktop.main.js" -Force
```

### macOS

```bash
cp "/Applications/Antigravity IDE.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js.backup_before_patch" "/Applications/Antigravity IDE.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js"
```

復元後、同様に `Developer: Reload Window` を実行してください。

---

## ⚠️ 免責事項

本ツールは Antigravity IDE のクライアント側ファイルを自己責任でパッチする非公式ツールです。パッチ適用前には自動的にバックアップが作成されますが、自己責任にてご使用ください。
