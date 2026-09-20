#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
Antigravity IDE パッチ リリースZIP作成＆GitHub Release発行スクリプト
================================================================================
以下の3ファイルのみを同梱した軽量配布用 zip を作成し、GitHub Release に公開します：
  1. apply_patch.py
  2. antigravity-session-patch.js
  3. README.md
"""

import os
import sys
import zipfile
import subprocess
import argparse

RELEASE_FILES = [
    "apply_patch.py",
    "antigravity-session-patch.js",
    "README.md"
]

def make_zip(version, output_dir="dist"):
    """配布用ZIPアーカイブを作成"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(script_dir, output_dir), exist_ok=True)

    zip_name = f"antigravity_ide_selfpatch_{version}.zip"
    zip_path = os.path.join(script_dir, output_dir, zip_name)

    print(f"\n[1/3] 配布用ZIPを作成中: {zip_name}")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in RELEASE_FILES:
            fpath = os.path.join(script_dir, fname)
            if not os.path.exists(fpath):
                print(f"[ERROR] 必要なファイルが見つかりません: {fname}")
                sys.exit(1)
            zf.write(fpath, arcname=fname)
            print(f"  + 同梱: {fname}")

    print(f"  [OK] ZIP作成完了: {zip_path} ({os.path.getsize(zip_path)} bytes)")
    return zip_path

def publish_github_release(version, zip_path, notes=None):
    """GitHub CLI (gh) を使ってリリースページを作成しZIPを添付"""
    print(f"\n[2/3] GitHub Release ({version}) を作成・公開中...")

    if not notes:
        notes = (
            f"## Antigravity IDE Enhanced Chat & Session Patch {version}\n\n"
            "### 同梱内容\n"
            "- `apply_patch.py`: 自動インストーラー\n"
            "- `antigravity-session-patch.js`: 独立モジュール原本\n"
            "- `README.md`: 使い方・ショートカット一覧・ロールバック解説\n\n"
            "### インストール方法\n"
            "1. 添付の zip ファイルを解凍します。\n"
            "2. 解凍先フォルダで `python apply_patch.py` を実行します。\n"
            "3. Antigravity IDE で `Developer: Reload Window` を実行します。\n"
        )

    cmd = [
        "gh", "release", "create", version,
        zip_path,
        "--title", f"Antigravity IDE Enhanced Patch {version}",
        "--notes", notes
    ]

    try:
        res = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("  [OK] GitHub Release の作成とZIPのアップロードが完了しました！")
        print(f"  Release URL: {res.stdout.strip()}")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] gh release create に失敗しました: {e.stderr}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Antigravity IDE パッチのリリースZIP作成ツール")
    parser.add_argument("version", nargs="?", default="v1.0.0", help="リリースバージョン番号 (例: v1.0.0)")
    parser.add_argument("--no-publish", action="store_true", help="GitHubへの公開は行わず、ローカルZIP作成のみ行う")
    parser.add_argument("--notes", help="リリースの説明文 (Markdown)")

    args = parser.parse_args()
    version = args.version
    if not version.startswith("v"):
        version = "v" + version

    print("================================================================================")
    print(f" Antigravity IDE パッチ リリースビルダー ({version})")
    print("================================================================================")

    zip_path = make_zip(version)

    if not args.no_publish:
        publish_github_release(version, zip_path, args.notes)
    else:
        print(f"\n[INFO] --no-publish が指定されたため、GitHub Release の発行はスキップしました。")

    print("\n[SUCCESS] すべての処理が完了しました！")

if __name__ == "__main__":
    main()
