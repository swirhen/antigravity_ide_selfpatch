#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
Antigravity IDE - セッション一覧ドロワー・名前変更・ピン留め・改行パッチ 自動適用スクリプト
================================================================================
このスクリプトは、Antigravity IDE に対して以下の機能をワンクリックで安全に適用します：
  1. 改行パッチ（Enter改行 / Ctrl+Enter送信、コロンコマンドはEnterで即時実行）
  2. セッション一覧ドロワー（F4 / :resume、現在セッション最上位ソート、青いラジオアイコン表示）
  3. セッション名変更（F2 / :rename、モーダルダイアログ入力）
  4. ピン留め切り替え（F6 / Ctrl+F6 / :pin / :unpin）
  5. 新規会話開始（Ctrl+F4 / :new）

ロジック本体は独立モジュール `antigravity-session-patch.js` で管理され、
本スクリプトが本体（workbench.desktop.main.js）へ安全にビルド時バンドル・フック適用します。
（Electron Sandbox や CSP の制約を完全に回避し、確実に動作します）
"""

import os
import sys
import json
import base64
import hashlib
import shutil
import subprocess

def find_paths():
    """OSごとの Antigravity IDE インストールパスを自動検出"""
    base_dir = None
    if sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        base_dir = os.path.join(local_app_data, r"Programs\Antigravity IDE\resources\app")
        keybindings_dir = os.path.join(os.environ.get("APPDATA", ""), "Antigravity IDE", "User")
    elif sys.platform == "darwin":
        base_dir = "/Applications/Antigravity IDE.app/Contents/Resources/app"
        keybindings_dir = os.path.expanduser("~/Library/Application Support/Antigravity IDE/User")
    else:
        # Linux
        for p in ["/opt/Antigravity IDE/resources/app", "/usr/share/antigravity-ide/resources/app"]:
            if os.path.exists(p):
                base_dir = p
                break
        keybindings_dir = os.path.expanduser("~/.config/Antigravity IDE/User")

    if not base_dir or not os.path.exists(base_dir):
        print(f"[ERROR] Antigravity IDE のインストール先が見つかりません: {base_dir}")
        sys.exit(1)

    js_path = os.path.join(base_dir, "out", "vs", "workbench", "workbench.desktop.main.js")
    prod_path = os.path.join(base_dir, "product.json")
    kb_path = os.path.join(keybindings_dir, "keybindings.json")

    return js_path, prod_path, kb_path

def main():
    print("================================================================================")
    print(" Antigravity IDE セッション管理・改行パッチ 自動インストーラー")
    print("================================================================================")

    js_path, prod_path, kb_path = find_paths()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    patch_src = os.path.join(script_dir, "antigravity-session-patch.js")

    if not os.path.exists(patch_src):
        print(f"[ERROR] 同一フォルダに 'antigravity-session-patch.js' が見つかりません。")
        sys.exit(1)

    if not os.path.exists(js_path):
        print(f"[ERROR] 対象の JS ファイルが見つかりません: {js_path}")
        sys.exit(1)

    # 1. 独立モジュール (antigravity-session-patch.js) の読み込み
    print(f"\n[1/5] 独立モジュール (antigravity-session-patch.js) を読み込み中...")
    with open(patch_src, "r", encoding="utf-8") as f:
        module_code = f.read().strip()
    print(f"  [OK] モジュール読み込み完了 ({len(module_code)} bytes)")

    # 2. 本体の初期バックアップ
    print(f"\n[2/5] 本体のバックアップ作成中...")
    bak_path = js_path + ".backup_before_patch"
    if not os.path.exists(bak_path):
        shutil.copy2(js_path, bak_path)
        print(f"  [OK] 初期バックアップを保存しました: {bak_path}")
    else:
        print(f"  [INFO] 既存の初期バックアップが存在するため保持します: {bak_path}")

    # 3. 本体のフック適用
    print(f"\n[3/5] workbench.desktop.main.js へのパッチ適用中...")
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 既存の先頭ローダーや古いパッチコードがあればクリーンアップ
    loader_prefix = "try{const _fs=require('fs')"
    if content.startswith(loader_prefix):
        end_idx = content.find("};/*!--------------------------------------------------------")
        if end_idx != -1:
            content = content[end_idx + 2:]
            print("  [OK] 旧方式の動的ローダーコードをクリーンアップしました")

    # 3-1. 独立モジュールを先頭に安全にバンドル注入
    bundle_marker = "/* --- ANTIGRAVITY SESSION PATCH MODULE START --- */"
    bundle_end_marker = "/* --- ANTIGRAVITY SESSION PATCH MODULE END --- */"
    if bundle_marker in content:
        # すでにバンドルされている場合は差し替え (re.sub のエスケープエラーを避けるためスライス置換)
        start_idx = content.find(bundle_marker)
        end_idx = content.find(bundle_end_marker)
        if start_idx != -1 and end_idx != -1:
            end_idx += len(bundle_end_marker)
            content = content[:start_idx] + f"{bundle_marker}\n{module_code}\n{bundle_end_marker}" + content[end_idx:]
            print("  [OK] 既存の組み込みモジュールを最新版に更新しました")
    else:
        # 先頭に安全に挿入
        content = f"{bundle_marker}\n{module_code}\n{bundle_end_marker};\n" + content
        print("  [OK] 独立モジュールを先頭にバンドル注入しました (Sandbox/CSP完全準拠)")

    # 3-2. ショートカットコマンド登録
    sn_clean = 'sn.registerCommand("noop",()=>{});["openDrawer","rename","pin","unpin","new"].forEach(c=>{sn.registerCommand("antigravity.session."+c,()=>window.dispatchEvent(new CustomEvent(c==="openDrawer"?"open-session-drawer-focus":"action-session-"+c)))});sn.registerCommand("antigravity.session.openKeybindings",(i,...n)=>{try{i.get(bi).executeCommand("workbench.action.openGlobalKeybindingsFile")}catch(_e){}});'
    sn_target = 'sn.registerCommand("noop",()=>{});'
    pat = r'sn\.registerCommand\("noop",\(\)=>{}\);(?:(?:\["openDrawer"[^;]+;|window\.addEventListener\("action-session-openKeybindings"[^;]+;|sn\.registerCommand\("antigravity\.session\.openKeybindings"[^;]+;)\s*)+'

    import re
    if re.search(pat, content):
        content = re.sub(pat, sn_clean, content, count=1)
        print("  [OK] [Commands] session.* コマンドディスパッチャーを最新版に更新しました")
    elif sn_target in content:
        content = content.replace(sn_target, sn_clean, 1)
        print("  [OK] [Commands] session.* コマンドディスパッチャーを登録しました")

    # 3-3. 改行＆送信判定（モジュール委譲版）
    nl_new = 'registerCommand(xSn,a=>{a.preventDefault();let _k="";try{_k=n.getEditorState().read(()=>f1().getTextContent()).trim()}catch(_e){}let _send=window.__AGY_SESSION_PATCH__?window.__AGY_SESSION_PATCH__.shouldSendMessage(a,_k):(a.ctrlKey||a.metaKey);return!_send?!1:(t(a,n),!0)},gD)'
    nl_orig = 'registerCommand(xSn,a=>{a.preventDefault();let l=a.ctrlKey||a.metaKey;return!l?!1:(t(a,n),!0)},gD)'
    nl_old_pattern = r'registerCommand\(xSn,a=>{a\.preventDefault\(\);let _k="".*?return!l\?!1:\(t\(a,n\),!0\)},gD\)'

    if nl_orig in content:
        content = content.replace(nl_orig, nl_new, 1)
        print("  [OK] [Newline] 改行・送信判定をモジュール委譲版に適用しました")
    elif 'shouldSendMessage(a,_k)' not in content:
        import re
        content = re.sub(nl_old_pattern, nl_new, content, count=1)
        print("  [OK] [Newline] 改行・送信判定を最新のモジュール委譲版に更新しました")
    else:
        print("  [INFO] [Newline] 改行・送信判定はすでに最新です")

    # 3-4. セッションフック＆リスナー (モジュール委譲版)
    hooks_target = '{deleteAgentMessage:pt}=Wa()'
    hooks_repl = '{deleteAgentMessage:pt,updateConversationAnnotations:__renameConv}=Wa(),__optSummary=Lmt(),__notify=Jv(),__rawTitle=bra(O,""),__curTitle=(__rawTitle==="Untitled Conversation"||__rawTitle==="Agent")?"":(__rawTitle||""),__getCurTitle=()=>{let t=__curTitle;if(!t||t==="Untitled Conversation"||t==="Agent"){try{let el=document.querySelector(".overflow-hidden.text-ellipsis.whitespace-nowrap");if(el&&el.textContent){let txt=el.textContent.trim();if(txt&&txt!=="Agent"){t=txt.includes(">")?txt.split(">").pop().trim():txt}}}catch(_e){}}return(t==="Untitled Conversation"||t==="Agent")?"":(t||"")},{startNewConversation:__startNewConv}=Cqo(),__dummyEvents=yt(()=>window.__AGY_SESSION_PATCH__?.initSessionHooks({O,renameConv:__renameConv,optSummary:__optSummary,notify:__notify,getCurTitle:__getCurTitle,startNewConv:__startNewConv,Ut,h4e}),[O,__renameConv,__optSummary,__notify,__curTitle,__startNewConv])'
    if hooks_target in content:
        content = content.replace(hooks_target, hooks_repl, 1)
        print("  [OK] [Hooks] セッション操作フックをモジュールへ委譲しました")

    # 3-5. コロンコマンド判定 (モジュール委譲版)
    pn_target = 'Pn=me((rf,zt)=>{let gi=rf.getEditorState(),Ci=pZe(gi),dn=Lt();t(Ci,dn,()=>{Z$(rf),Ot(),Dt([])},zt),J&&J.addEntry(JSON.stringify(gi.toJSON())),ti&&(rf.getRootElement()?.blur(),fV(!1))},[t,Lt,Ot,J,ti])'
    pn_repl = r'''Pn=me(async(rf,zt)=>{let gi=rf.getEditorState(),Ci=pZe(gi),dn=Lt(),__txt=bZe(Ci).trim();if(!__txt){try{__txt=rf.getEditorState().read(()=>f1().getTextContent()).trim()}catch(_e){}}let __handled=await window.__AGY_SESSION_PATCH__?.handleColonCommand(__txt,{rf,ti,Z$,Ot,Dt,fV,O,renameConv:__renameConv,optSummary:__optSummary,notify:__notify,getCurTitle:__getCurTitle,startNewConv:__startNewConv,Ut,h4e});if(__handled)return;t(Ci,dn,()=>{Z$(rf),Ot(),Dt([])},zt),J&&J.addEntry(JSON.stringify(gi.toJSON())),ti&&(rf.getRootElement()?.blur(),fV(!1))},[t,Lt,Ot,J,ti,O,__renameConv,__optSummary,__notify,__curTitle,__startNewConv])'''
    if pn_target in content:
        content = content.replace(pn_target, pn_repl, 1)
        print("  [OK] [ColonCommands] コロンコマンドハンドラをモジュールへ委譲しました")

    # 3-6. ドロワー定義＆マウント
    cju_target = 'CJu=({includeHeader:t})=>'
    drawer_repl = r'''__SessionDrawer=window.__AGY_SESSION_PATCH__?window.__AGY_SESSION_PATCH__.createSessionDrawer({We,yt,Re,mt,Of,nl,wC,bra,co,Cqo,HTn,Wa,Lmt,Ut,h4e,E,$e,yi}):(()=>null),'''
    if cju_target in content and '__SessionDrawer' not in content:
        content = content.replace(cju_target, drawer_repl + cju_target, 1)
        print("  [OK] [Drawer] __SessionDrawer 1行定義を注入しました")

    mount_target = 'children:[t&&E(hHu,{}),E(rHu,{})'
    mount_repl = 'children:[t&&E(hHu,{}),E(__SessionDrawer,{}),E(rHu,{})'
    if mount_target in content:
        content = content.replace(mount_target, mount_repl, 1)
        print("  [OK] [Mount] CJu コンポーネントへマウントしました")

    # 構文チェック
    temp_file = js_path + ".temp_check.js"
    with open(temp_file, "w", encoding="utf-8") as f:
        f.write(content)

    print("\n[4/5] node --check による構文検証中...")
    try:
        subprocess.run(["node", "--check", temp_file], check=True, capture_output=True, text=True)
        print("  [OK] 構文チェック PASSED!")
    except Exception as err:
        print(f"[ERROR] 構文チェックエラー: {err}")
        if os.path.exists(temp_file):
            os.remove(temp_file)
        sys.exit(1)

    os.replace(temp_file, js_path)

    # チェックサム更新
    if os.path.exists(prod_path):
        with open(js_path, "rb") as f:
            raw = f.read()
        new_hash = base64.b64encode(hashlib.sha256(raw).digest()).decode("latin1").rstrip("=")
        try:
            with open(prod_path, "r", encoding="utf-8") as f:
                prod = json.load(f)
            if "checksums" in prod and "vs/workbench/workbench.desktop.main.js" in prod["checksums"]:
                old_h = prod["checksums"]["vs/workbench/workbench.desktop.main.js"]
                prod["checksums"]["vs/workbench/workbench.desktop.main.js"] = new_hash
                with open(prod_path, "w", encoding="utf-8") as f:
                    json.dump(prod, f, indent=2)
                print(f"  [OK] product.json チェックサム更新完了 ({old_h[:8]}... -> {new_hash[:8]}...)")
        except Exception as e:
            print(f"  [WARN] product.json の更新をスキップしました: {e}")

    # 4. keybindings.json の登録
    print(f"\n[5/5] ショートカットキー (keybindings.json) の設定中...")
    try:
        os.makedirs(os.path.dirname(kb_path), exist_ok=True)
        kb_list = []
        if os.path.exists(kb_path):
            with open(kb_path, "r", encoding="utf-8") as f:
                raw_text = f.read().strip()
                if raw_text:
                    import re
                    clean_text = re.sub(r'//.*$', '', raw_text, flags=re.MULTILINE)
                    kb_list = json.loads(clean_text)

        kb_list = [b for b in kb_list if not b.get("command", "").startswith("antigravity.session.")]
        new_bindings = [
            {"key": "f4", "command": "antigravity.session.openDrawer", "when": "antigravity.agentSidePanel.isFocused"},
            {"key": "f2", "command": "antigravity.session.rename", "when": "antigravity.agentSidePanel.isFocused"},
            {"key": "f6", "command": "antigravity.session.pin", "when": "antigravity.agentSidePanel.isFocused"},
            {"key": "ctrl+f6", "command": "antigravity.session.unpin", "when": "antigravity.agentSidePanel.isFocused"},
            {"key": "ctrl+f4", "command": "antigravity.session.new", "when": "antigravity.agentSidePanel.isFocused"}
        ]
        kb_list.extend(new_bindings)
        with open(kb_path, "w", encoding="utf-8") as f:
            json.dump(kb_list, f, indent=4, ensure_ascii=False)
        print("  [OK] ショートカット登録完了 (F4:ドロワー, F2:名前変更, F6:ピン留め, Ctrl+F6:ピン解除, Ctrl+F4:新規)")
    except Exception as e:
        print(f"  [WARN] keybindings.json の更新に失敗しました: {e}")

    print("\n================================================================================")
    print(" [SUCCESS] 全てのパッチの適用が正常に完了しました！")
    print("================================================================================")
    print("反映するには、IDE で以下のいずれかを実行してください：")
    print("  1. Ctrl + Shift + P -> 'Developer: Reload Window' を実行")
    print("  2. または Antigravity IDE を再起動")
    print("================================================================================\n")

if __name__ == "__main__":
    main()
