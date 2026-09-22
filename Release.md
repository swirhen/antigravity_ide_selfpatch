## Antigravity IDE 自己修正パッチ v1.2.0

Antigravity IDE の Agent Side Panel に、セッション管理、入力補助、AI クォータ表示を追加する非公式パッチです。

このリリースでは、機能追加だけでなく、本体 JS を直接変更するパッチとしての前提条件と復元手順も明確にしています。

---

## 主な内容

### セッション管理

- `F4` または `:resume` / `:res` でセッション一覧ドロワーを開閉
- 現在セッション > ピン留め > 更新時刻の順で一覧を整理
- ドロワー内の検索、`↑` / `↓` / `Enter` / `Escape` による操作
- `F2`、タイトルクリック、`:rename <名前>` / `:ren` による名前変更
- `F6` / `Ctrl + F6`、`:pin` / `:p`、`:unpin` / `:up` によるピン操作
- `Ctrl + F4` または `:new` / `:n` による新規セッション開始

### チャット入力

- 既定の入力動作を Enter 改行 / Ctrl+Enter 送信に変更
- コロンコマンドは Enter 1 回で即時実行
- 設定画面から入力動作の ON / OFF を切り替え

### AI クォータ表示（Vitals）

- 入力欄周辺に AI クォータ残量とサービス状況を表示
- 5h / 7d の残量を表示
- 残量に応じて表示色を変更
- ホバー時に詳細情報を表示

---

## 同梱内容

- `apply_patch.py`: パッチ適用スクリプト
- `rollback.py`: パッチ復元スクリプト
- `antigravity-session-patch.js`: パッチ本体の原本
- `README.md`: 利用方法と実装上の前提
- `Antigravity IDE非公式パッチ開発おぼえがき.txt`: 開発・保守メモ

---

## 実装上の前提

本パッチは Antigravity IDE の内部 JavaScript と DOM 構造に依存します。

- `workbench.desktop.main.js` に対して直接差し込みを行う
- セッション一覧やタイトル更新は IDE 内部 state に依存する
- Vitals はローカルの API / 状態情報に依存する
- `product.json` と `keybindings.json` の整合性を保つ必要がある

IDE 本体のアップデートで内部構造が変わった場合、適用位置や処理の調整が必要になることがあります。

---

## インストールと再適用

1. 配布アセット `antigravity_ide_selfpatch_v1.2.0.zip` をダウンロードして解凍します。
2. 解凍したフォルダでターミナルを開き、次を実行します。

   ```powershell
   python apply_patch.py
   ```

3. Antigravity IDE で `Developer: Reload Window` を実行します。

IDE のアップデート後に本体 JS が置き換わった場合も、同じコマンドで再適用します。

---

## バックアップとロールバック

本体の JS を直接変更するため、適用前と開発の各ステップでバックアップを作成してください。

バックアップ対象:

- `workbench.desktop.main.js`
- `product.json`
- `keybindings.json`
- `antigravity-session-patch.js`

IDE が起動しない、画面が崩れる、再読み込み後に動作しない場合は、まずバックアップから復元します。
その後、必要に応じて次を実行します。

```powershell
python rollback.py
```

復元後は、Antigravity IDE を再読み込みまたは再起動してください。

---

## 注意事項

- このプロジェクトは非公式パッチです。
- パッチ適用前に、必ず復元可能なバックアップを残してください。
- IDE 本体のバージョンや環境によっては、追加調整が必要です。
- 本リリースの機能説明は、現在の実装に基づくものです。
