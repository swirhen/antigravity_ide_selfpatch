## Antigravity IDE 自己修正パッチ v1.2.2

Antigravity IDE の Agent Side Panel に、セッション管理、入力補助、AI クォータ表示を追加する非公式パッチです。

このリリースでは、AI クォータ詳細ポップアップの表示改善および公式サービス稼働ステータス判定の強化を行っています。

---

## 主な変更点（v1.2.1 からの差分）

### AI クォータ詳細ポップアップのレイアウト改善

- 7日間枠の消費ペース判定バッジ（適正ペース / 安全ペース / ハイペース注意）の配置をパーセンテージの手前（内側）へ変更
- パーセンテージ表示を右端に配置し、5時間枠の残量表示と右寄せ位置を統一

### 公式サービス稼働ステータス判定の強化

- 公式稼働状況（Google Cloud / Anthropic）の判定を 正常 / 異常 の2段階から、ai-vitals に準拠した **「正常 / 軽微な障害 / 重大な障害」** の3段階表示へ拡張
- ステータス重大度に応じた文字色（正常: 緑 / 軽微な障害: 黄 / 重大な障害: 赤）で表示

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

1. 配布アセット `antigravity_ide_selfpatch_v1.2.2.zip` をダウンロードして解凍します。
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
