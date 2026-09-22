#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
 Antigravity IDE - ワンクリック・ロールバックスクリプト
================================================================================
直近の安定バックアップ、または初期バックアップから安全に復元します。
"""

import os
import sys
import json
import base64
import hashlib
import shutil
import apply_patch

def main():
    print("================================================================================")
    print(" Antigravity IDE ロールバック実行")
    print("================================================================================")

    js_path, prod_path, _ = apply_patch.find_paths()

    # 復元候補の優先順位:
    # 1. stable_backup (安定稼働版)
    # 2. backup_before_patch (初期バックアップ)
    candidates = [
        js_path + ".stable_backup",
        js_path + ".backup_before_patch"
    ]

    target_backup = None
    for cand in candidates:
        if os.path.exists(cand):
            target_backup = cand
            break

    if not target_backup:
        print("[ERROR] 復元可能なバックアップファイルが見つかりません。")
        sys.exit(1)

    print(f"復元元バックアップ: {os.path.basename(target_backup)}")
    shutil.copy2(target_backup, js_path)
    print(f"  [OK] {os.path.basename(js_path)} をバックアップから復元しました。")

    # product.json のチェックサム更新
    if os.path.exists(prod_path):
        with open(js_path, "rb") as f:
            raw = f.read()
        new_hash = base64.b64encode(hashlib.sha256(raw).digest()).decode("latin1").rstrip("=")
        try:
            with open(prod_path, "r", encoding="utf-8") as f:
                prod = json.load(f)
            if "checksums" in prod and "vs/workbench/workbench.desktop.main.js" in prod["checksums"]:
                prod["checksums"]["vs/workbench/workbench.desktop.main.js"] = new_hash
                with open(prod_path, "w", encoding="utf-8") as f:
                    json.dump(prod, f, indent=2)
                print(f"  [OK] product.json チェックサム更新完了 ({new_hash[:8]}...)")
        except Exception as e:
            print(f"  [WARN] product.json の更新をスキップしました: {e}")

    print("\n================================================================================")
    print(" [SUCCESS] ロールバックが完了しました！")
    print(" IDE で 'Developer: Reload Window' を実行してください。")
    print("================================================================================\n")

if __name__ == "__main__":
    main()
