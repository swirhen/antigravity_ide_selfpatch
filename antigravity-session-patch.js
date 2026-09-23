/*
 * Antigravity IDE - チャットペイン機能拡張パッチ 独立モジュール
 * File: antigravity-session-patch.js
 */
(function (global) {
    'use strict';

    const patch = {};

    // -------------------------------------------------------------------------
    // 0. 設定マネージャー (Config Manager: localStorage 連携)
    // -------------------------------------------------------------------------
    const CONFIG_KEY = 'antigravity.patch.config';

    const DEFAULT_CONFIG = {
        enterSendDisabled: true, // true: Enter改行/Ctrl+Enter送信, false: Enter送信/Shift+Enter改行
        commands: {
            resume: { primary: "resume", short: "res", label: "セッション一覧表示" },
            rename: { primary: "rename", short: "ren", label: "セッション名変更" },
            pin: { primary: "pin", short: "p", label: "セッションをピン留め" },
            unpin: { primary: "unpin", short: "up", label: "ピン留めを解除" },
            new: { primary: "new", short: "n", label: "新規セッション開始" },
            archive: { primary: "archive", short: "arc", label: "セッションをアーカイブ" },
            unarchive: { primary: "unarchive", short: "unarc", label: "アーカイブを解除" }
        }
    };

    const ARCHIVE_DRAWER_KEY = 'antigravity.patch.archiveDrawerOpen';

    function escapeRegExp(string) {
        return (string || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function cleanCmdName(val) {
        return (val || "").trim().replace(/^:+/, "");
    }

    patch.getConfig = function () {
        try {
            const raw = localStorage.getItem(CONFIG_KEY);
            if (!raw) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            const parsed = JSON.parse(raw);
            return {
                enterSendDisabled: parsed.enterSendDisabled !== undefined ? !!parsed.enterSendDisabled : DEFAULT_CONFIG.enterSendDisabled,
                commands: {
                    resume: {
                        primary: cleanCmdName(parsed.commands?.resume?.primary) || DEFAULT_CONFIG.commands.resume.primary,
                        short: cleanCmdName(parsed.commands?.resume?.short) || DEFAULT_CONFIG.commands.resume.short,
                        label: DEFAULT_CONFIG.commands.resume.label
                    },
                    rename: {
                        primary: cleanCmdName(parsed.commands?.rename?.primary) || DEFAULT_CONFIG.commands.rename.primary,
                        short: cleanCmdName(parsed.commands?.rename?.short) || DEFAULT_CONFIG.commands.rename.short,
                        label: DEFAULT_CONFIG.commands.rename.label
                    },
                    pin: {
                        primary: cleanCmdName(parsed.commands?.pin?.primary) || DEFAULT_CONFIG.commands.pin.primary,
                        short: cleanCmdName(parsed.commands?.pin?.short) || DEFAULT_CONFIG.commands.pin.short,
                        label: DEFAULT_CONFIG.commands.pin.label
                    },
                    unpin: {
                        primary: cleanCmdName(parsed.commands?.unpin?.primary) || DEFAULT_CONFIG.commands.unpin.primary,
                        short: cleanCmdName(parsed.commands?.unpin?.short) || DEFAULT_CONFIG.commands.unpin.short,
                        label: DEFAULT_CONFIG.commands.unpin.label
                    },
                    new: {
                        primary: cleanCmdName(parsed.commands?.new?.primary) || DEFAULT_CONFIG.commands.new.primary,
                        short: cleanCmdName(parsed.commands?.new?.short) || DEFAULT_CONFIG.commands.new.short,
                        label: DEFAULT_CONFIG.commands.new.label
                    },
                    archive: {
                        primary: cleanCmdName(parsed.commands?.archive?.primary) || DEFAULT_CONFIG.commands.archive.primary,
                        short: cleanCmdName(parsed.commands?.archive?.short) || DEFAULT_CONFIG.commands.archive.short,
                        label: DEFAULT_CONFIG.commands.archive.label
                    },
                    unarchive: {
                        primary: cleanCmdName(parsed.commands?.unarchive?.primary) || DEFAULT_CONFIG.commands.unarchive.primary,
                        short: cleanCmdName(parsed.commands?.unarchive?.short) || DEFAULT_CONFIG.commands.unarchive.short,
                        label: DEFAULT_CONFIG.commands.unarchive.label
                    }
                }
            };
        } catch (_e) {
            return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
    };

    patch.saveConfig = function (cfg) {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
            return true;
        } catch (e) {
            console.error("Failed to save patch config:", e);
            return false;
        }
    };

    patch.resetConfig = function () {
        try {
            localStorage.removeItem(CONFIG_KEY);
            return true;
        } catch (_e) {
            return false;
        }
    };

    // コロンコマンドかどうか判定
    patch.isColonCommand = function (rawText) {
        const txt = (rawText || "").trim();
        if (!txt.startsWith(":")) return false;
        const cfg = patch.getConfig();
        for (const key of Object.keys(cfg.commands)) {
            const cmd = cfg.commands[key];
            const parts = [cmd.primary, cmd.short].map(cleanCmdName).filter(Boolean).map(escapeRegExp);
            if (parts.length === 0) continue;
            const reg = new RegExp(`^:(${parts.join("|")})(\\s.*)?$`, "i");
            if (reg.test(txt)) return true;
        }
        return false;
    };

    // 改行・送信判定
    patch.shouldSendMessage = function (ev, text) {
        const isCmd = patch.isColonCommand(text);
        if (isCmd) return true; // コロンコマンドは常に Enter で即時実行

        const cfg = patch.getConfig();
        if (cfg.enterSendDisabled) {
            // Enter改行 / Ctrl+Enter(Cmd+Enter) 送信
            return !!(ev.ctrlKey || ev.metaKey);
        } else {
            // 通常チャット動作: Enter 送信 / Shift+Enter 改行
            return !ev.shiftKey && !ev.ctrlKey && !ev.metaKey;
        }
    };

    // サービス参照保持
    patch._commandService = null;

    patch.openKeybindings = function () {
        try {
            if (patch._commandService && typeof patch._commandService.executeCommand === "function") {
                patch._commandService.executeCommand("workbench.action.openGlobalKeybindingsFile");
            } else {
                window.dispatchEvent(new CustomEvent("action-session-openKeybindings"));
            }
        } catch (err) {
            console.error("Failed to open keybindings file:", err);
        }
    };

    patch.reloadWindow = function () {
        if (patch._commandService && typeof patch._commandService.executeCommand === "function") {
            patch._commandService.executeCommand("workbench.action.reloadWindow");
        } else {
            window.location.reload();
        }
    };

    // -------------------------------------------------------------------------
    // 1. ユーティリティ: チャット入力欄への安全なフォーカス復帰
    // -------------------------------------------------------------------------
    function focusChatInput() {
        let retryCount = 0;
        const tryFocus = () => {
            const inp = document.querySelector('div[aria-label="Message input"]') ||
                document.querySelector('[contenteditable="true"]');
            if (inp) {
                inp.focus();
                try {
                    const sel = window.getSelection();
                    const rng = document.createRange();
                    rng.selectNodeContents(inp);
                    rng.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(rng);
                } catch (_e) { }
            } else if (retryCount < 8) {
                retryCount++;
                setTimeout(tryFocus, 50);
            }
        };
        setTimeout(tryFocus, 60);
    }
    patch.focusChatInput = focusChatInput;

    // -------------------------------------------------------------------------
    // 2. ユーティリティ: セッション名入力ダイアログ
    // -------------------------------------------------------------------------
    function showPromptDialog(msg, defaultValue = "") {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;";

            const box = document.createElement("div");
            box.style.cssText = "background:var(--vscode-sideBar-background,#252526);color:var(--vscode-foreground,#ccc);padding:16px;border-radius:6px;border:1px solid var(--vscode-widget-border,#454545);box-shadow:0 8px 24px rgba(0,0,0,0.4);width:320px;display:flex;flex-direction:column;gap:12px;";

            const title = document.createElement("div");
            title.textContent = msg;
            title.style.cssText = "font-size:12px;font-weight:600;color:var(--vscode-foreground,#eee);";

            const input = document.createElement("input");
            input.type = "text";
            input.value = defaultValue;
            input.style.cssText = "width:100%;box-sizing:border-box;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#fff);border:1px solid var(--vscode-input-border,#555);border-radius:3px;padding:6px 8px;font-size:12px;outline:none;";

            const btnRow = document.createElement("div");
            btnRow.style.cssText = "display:flex;justify-content:flex-end;gap:8px;";

            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "キャンセル";
            cancelBtn.style.cssText = "padding:4px 10px;font-size:11px;border-radius:3px;background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-widget-border,#555);cursor:pointer;";

            const okBtn = document.createElement("button");
            okBtn.textContent = "変更";
            okBtn.style.cssText = "padding:4px 12px;font-size:11px;border-radius:3px;background:var(--vscode-button-background,#0e639c);color:#fff;border:none;cursor:pointer;";

            const cleanup = () => {
                overlay.remove();
                focusChatInput();
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve(null);
            };

            okBtn.onclick = () => {
                cleanup();
                resolve(input.value.trim());
            };

            input.onkeydown = (e) => {
                if (e.key === "Enter") {
                    okBtn.click();
                } else if (e.key === "Escape") {
                    cancelBtn.click();
                }
            };

            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(okBtn);
            box.appendChild(title);
            box.appendChild(input);
            box.appendChild(btnRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            setTimeout(() => {
                input.focus();
                input.select();
            }, 20);
        });
    }
    patch.showPromptDialog = showPromptDialog;

    // -------------------------------------------------------------------------
    // 2.1 独自設定ダイアログ (Settings Dialog: TrustedHTML & CSP 完全準拠)
    // -------------------------------------------------------------------------
    function showSettingsDialog() {
        try {
            // すでにダイアログが開いていれば二重起動を防止
            if (document.getElementById("agy-patch-settings-overlay")) {
                return;
            }

            const config = patch.getConfig();

            const overlay = document.createElement("div");
            overlay.id = "agy-patch-settings-overlay";
            overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(3px);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:var(--vscode-font-family,-apple-system,BlinkMacSystemFont,sans-serif);opacity:1;";

            const modal = document.createElement("div");
            modal.style.cssText = "background:var(--vscode-editor-background,#1e1e1e);color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-widget-border,#454545);border-radius:8px;box-shadow:0 16px 36px rgba(0,0,0,0.6);width:540px;max-width:92vw;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;";

            // ヘッダー
            const header = document.createElement("div");
            header.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--vscode-widget-border,#333);background:var(--vscode-sideBar-background,#252526);";

            const titleBox = document.createElement("div");
            titleBox.style.cssText = "display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;color:var(--vscode-foreground,#fff);";

            const gearIcon = document.createElement("span");
            gearIcon.textContent = "\u2699"; // ⚙
            gearIcon.style.cssText = "font-size:15px;line-height:1;";

            const titleText = document.createElement("span");
            titleText.textContent = "Antigravity チャットペインパッチ設定";

            titleBox.appendChild(gearIcon);
            titleBox.appendChild(titleText);

            const closeBtn = document.createElement("button");
            closeBtn.textContent = "\u00D7"; // ×
            closeBtn.style.cssText = "background:transparent;border:none;color:var(--vscode-foreground,#aaa);font-size:18px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:4px;";
            closeBtn.onmouseenter = () => closeBtn.style.color = "var(--vscode-foreground,#fff)";
            closeBtn.onmouseleave = () => closeBtn.style.color = "var(--vscode-foreground,#aaa)";

            header.appendChild(titleBox);
            header.appendChild(closeBtn);

            // コンテンツ領域
            const body = document.createElement("div");
            body.style.cssText = "padding:16px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:18px;font-size:12px;line-height:1.5;";

            // 1. チャット送信トグルセクション
            const sectionSend = document.createElement("div");
            sectionSend.style.cssText = "display:flex;flex-direction:column;gap:6px;";

            const sendTitle = document.createElement("div");
            sendTitle.textContent = "チャット送信ショートカット";
            sendTitle.style.cssText = "font-weight:600;font-size:12px;color:var(--vscode-foreground,#eee);border-bottom:1px solid var(--vscode-widget-border,#333);padding-bottom:4px;";

            // トグルスイッチの状態
            let isEnterSendDisabled = config.enterSendDisabled;

            const sendRow = document.createElement("div");
            sendRow.style.cssText = "display:flex;align-items:flex-start;gap:12px;cursor:pointer;margin-top:4px;user-select:none;";

            // スイッチトラック (外枠カプセル)
            const switchTrack = document.createElement("div");
            switchTrack.style.cssText = "position:relative;width:38px;height:20px;border-radius:10px;cursor:pointer;flex-shrink:0;margin-top:2px;transition:background-color 0.2s ease, border-color 0.2s ease;box-sizing:border-box;border:1px solid rgba(255,255,255,0.2);";

            // スイッチつまみ (内部の白い丸)
            const switchThumb = document.createElement("div");
            switchThumb.style.cssText = "position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.4);transition:transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);";
            switchTrack.appendChild(switchThumb);

            const updateToggleUI = () => {
                if (isEnterSendDisabled) {
                    switchTrack.style.background = "var(--vscode-button-background,#0e639c)";
                    switchTrack.style.borderColor = "var(--vscode-button-background,#0e639c)";
                    switchThumb.style.transform = "translateX(18px)";
                } else {
                    switchTrack.style.background = "var(--vscode-input-background,#3c3c3c)";
                    switchTrack.style.borderColor = "var(--vscode-input-border,#555)";
                    switchThumb.style.transform = "translateX(0px)";
                }
            };
            updateToggleUI();

            sendRow.onclick = (e) => {
                e.preventDefault();
                isEnterSendDisabled = !isEnterSendDisabled;
                updateToggleUI();
            };

            const sendLabelContainer = document.createElement("div");
            sendLabelContainer.style.cssText = "display:flex;flex-direction:column;gap:2px;flex:1;";

            const sendLabelText = document.createElement("span");
            sendLabelText.textContent = "チャットを Enter で送信しない (Ctrl+Enter で送信)";
            sendLabelText.style.cssText = "font-weight:500;color:var(--vscode-foreground,#fff);";

            const sendDesc = document.createElement("span");
            sendDesc.textContent = "ON の場合は Enter で改行し、Ctrl+Enter (Cmd+Enter) でメッセージを送信します。OFF の場合は通常のチャット動作（Enter で送信、Shift+Enter で改行）になります。※コロンコマンドはいずれの場合も Enter で即時実行されます。";
            sendDesc.style.cssText = "font-size:11px;color:var(--vscode-descriptionForeground,#888);";

            sendLabelContainer.appendChild(sendLabelText);
            sendLabelContainer.appendChild(sendDesc);
            sendRow.appendChild(switchTrack);
            sendRow.appendChild(sendLabelContainer);

            sectionSend.appendChild(sendTitle);
            sectionSend.appendChild(sendRow);

            // 2. コロンコマンドカスタマイズセクション
            const sectionCmds = document.createElement("div");
            sectionCmds.style.cssText = "display:flex;flex-direction:column;gap:8px;";

            const cmdsTitle = document.createElement("div");
            cmdsTitle.textContent = "チャットコマンド設定";
            cmdsTitle.style.cssText = "font-weight:600;font-size:12px;color:var(--vscode-foreground,#eee);border-bottom:1px solid var(--vscode-widget-border,#333);padding-bottom:4px;";

            const cmdsDesc = document.createElement("div");
            cmdsDesc.textContent = "チャット入力欄に「:コマンド名」を入力して Enter を押すと実行される機能です。コマンド名を自由に変更できます（先頭の「:」は自動補完）。";
            cmdsDesc.style.cssText = "font-size:11px;color:var(--vscode-descriptionForeground,#888);";

            const cmdTable = document.createElement("div");
            cmdTable.style.cssText = "display:grid;grid-template-columns:140px 1fr 1fr;gap:8px;align-items:center;background:var(--vscode-sideBar-background,#252526);padding:10px 12px;border-radius:6px;border:1px solid var(--vscode-widget-border,#333);";

            // テーブルヘッダー（DOM API で安全に構築）
            const th1 = document.createElement("div");
            th1.textContent = "機能";
            th1.style.cssText = "font-weight:600;font-size:11px;color:var(--vscode-descriptionForeground,#aaa);";
            const th2 = document.createElement("div");
            th2.textContent = "通常コマンド";
            th2.style.cssText = "font-weight:600;font-size:11px;color:var(--vscode-descriptionForeground,#aaa);";
            const th3 = document.createElement("div");
            th3.textContent = "短縮コマンド";
            th3.style.cssText = "font-weight:600;font-size:11px;color:var(--vscode-descriptionForeground,#aaa);";
            cmdTable.appendChild(th1);
            cmdTable.appendChild(th2);
            cmdTable.appendChild(th3);

            const cmdInputs = {};
            const cmdList = [
                { id: "resume", label: "セッション一覧" },
                { id: "rename", label: "セッション名変更" },
                { id: "pin", label: "ピン留め" },
                { id: "unpin", label: "ピン留め解除" },
                { id: "new", label: "新規会話" },
                { id: "archive", label: "アーカイブ" },
                { id: "unarchive", label: "アーカイブ解除" }
            ];

            cmdList.forEach(item => {
                const curCmd = config.commands[item.id] || DEFAULT_CONFIG.commands[item.id];

                const labelEl = document.createElement("div");
                labelEl.textContent = item.label;
                labelEl.style.cssText = "font-size:11px;color:var(--vscode-foreground,#eee);";

                const primInput = document.createElement("input");
                primInput.type = "text";
                primInput.value = ":" + cleanCmdName(curCmd.primary);
                primInput.style.cssText = "width:100%;box-sizing:border-box;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#fff);border:1px solid var(--vscode-input-border,#555);border-radius:3px;padding:4px 6px;font-size:11px;outline:none;";

                const shortInput = document.createElement("input");
                shortInput.type = "text";
                shortInput.value = ":" + cleanCmdName(curCmd.short);
                shortInput.style.cssText = "width:100%;box-sizing:border-box;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#fff);border:1px solid var(--vscode-input-border,#555);border-radius:3px;padding:4px 6px;font-size:11px;outline:none;";

                cmdInputs[item.id] = { primary: primInput, short: shortInput };

                cmdTable.appendChild(labelEl);
                cmdTable.appendChild(primInput);
                cmdTable.appendChild(shortInput);
            });

            sectionCmds.appendChild(cmdsTitle);
            sectionCmds.appendChild(cmdsDesc);
            sectionCmds.appendChild(cmdTable);

            // 3. キーボードショートカット設定セクション
            const sectionKb = document.createElement("div");
            sectionKb.style.cssText = "display:flex;flex-direction:column;gap:6px;";

            const kbTitle = document.createElement("div");
            kbTitle.textContent = "キーボードショートカット設定";
            kbTitle.style.cssText = "font-weight:600;font-size:12px;color:var(--vscode-foreground,#eee);border-bottom:1px solid var(--vscode-widget-border,#333);padding-bottom:4px;";

            const kbCard = document.createElement("div");
            kbCard.style.cssText = "display:flex;flex-direction:column;gap:10px;background:var(--vscode-sideBar-background,#252526);padding:10px 12px;border-radius:6px;border:1px solid var(--vscode-widget-border,#333);";

            const kbHeaderRow = document.createElement("div");
            kbHeaderRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;";

            const kbDesc = document.createElement("div");
            kbDesc.style.cssText = "font-size:11px;color:var(--vscode-descriptionForeground,#aaa);line-height:1.4;";
            const kbDescStrong = document.createElement("strong");
            kbDescStrong.textContent = "keybindings.json";
            kbDesc.appendChild(document.createTextNode("キーボードショートカットを変更する場合は、"));
            kbDesc.appendChild(kbDescStrong);
            kbDesc.appendChild(document.createTextNode(" で該当箇所を修正して下さい。"));

            // 「keybindings.json を開く」ボタン
            const kbBtn = document.createElement("button");
            kbBtn.type = "button";
            kbBtn.textContent = "keybindings.json を開く";
            kbBtn.style.cssText = "padding:5px 12px;font-size:11px;border-radius:3px;background:var(--vscode-button-secondaryBackground,#3a3d41);color:var(--vscode-button-secondaryForeground,#fff);border:1px solid var(--vscode-widget-border,#555);cursor:pointer;white-space:nowrap;transition:background 0.1s;";
            kbBtn.onmouseenter = () => kbBtn.style.background = "var(--vscode-button-secondaryHoverBackground,#45494e)";
            kbBtn.onmouseleave = () => kbBtn.style.background = "var(--vscode-button-secondaryBackground,#3a3d41)";
            kbBtn.onclick = (ev) => {
                ev?.stopPropagation();
                overlay.remove();
                setTimeout(() => {
                    patch.openKeybindings();
                }, 80);
            };

            kbHeaderRow.appendChild(kbDesc);
            kbHeaderRow.appendChild(kbBtn);

            // 設定項目一覧テーブル
            const kbItemsTable = document.createElement("table");
            kbItemsTable.style.cssText = "width:100%;border-collapse:collapse;font-size:11px;margin-top:2px;";

            const thead = document.createElement("thead");
            const theadTr = document.createElement("tr");
            theadTr.style.cssText = "color:var(--vscode-descriptionForeground,#888);border-bottom:1px solid var(--vscode-widget-border,#3a3d41);text-align:left;";

            const thCmd = document.createElement("th");
            thCmd.textContent = "コマンド (command)";
            thCmd.style.padding = "3px 6px";

            const thKey = document.createElement("th");
            thKey.textContent = "規定キー (key)";
            thKey.style.padding = "3px 6px";

            const thFunc = document.createElement("th");
            thFunc.textContent = "機能内容";
            thFunc.style.padding = "3px 6px";

            theadTr.appendChild(thCmd);
            theadTr.appendChild(thKey);
            theadTr.appendChild(thFunc);
            thead.appendChild(theadTr);
            kbItemsTable.appendChild(thead);

            const kbItems = [
                { cmd: "antigravity.session.openDrawer", key: "F4", desc: "セッション一覧ドロワー開閉" },
                { cmd: "antigravity.session.rename", key: "F2", desc: "セッション名変更" },
                { cmd: "antigravity.session.pin", key: "F6", desc: "セッションをピン留め" },
                { cmd: "antigravity.session.unpin", key: "Ctrl + F6", desc: "ピン留めを解除" },
                { cmd: "antigravity.session.new", key: "Ctrl + F4", desc: "新しいセッション開始" }
            ];

            const tbody = document.createElement("tbody");
            kbItems.forEach(item => {
                const tr = document.createElement("tr");
                tr.style.cssText = "border-bottom:1px solid rgba(255,255,255,0.05);";

                const tdCmd = document.createElement("td");
                tdCmd.style.cssText = "padding:4px 6px;font-family:var(--vscode-editor-font-family,monospace);color:var(--vscode-textLink-foreground,#4fc1ff);user-select:all;";
                tdCmd.textContent = item.cmd;

                const tdKey = document.createElement("td");
                tdKey.style.cssText = "padding:4px 6px;white-space:nowrap;";
                const kbd = document.createElement("kbd");
                kbd.textContent = item.key;
                kbd.style.cssText = "padding:1px 5px;background:var(--vscode-keybindingLabel-background,rgba(128,128,128,0.17));border:1px solid var(--vscode-keybindingLabel-border,rgba(51,51,51,0.4));border-radius:3px;font-size:10px;font-family:inherit;color:var(--vscode-keybindingLabel-foreground,#ccc);";
                tdKey.appendChild(kbd);

                const tdFunc = document.createElement("td");
                tdFunc.style.cssText = "padding:4px 6px;color:var(--vscode-foreground,#ccc);";
                tdFunc.textContent = item.desc;

                tr.appendChild(tdCmd);
                tr.appendChild(tdKey);
                tr.appendChild(tdFunc);
                tbody.appendChild(tr);
            });
            kbItemsTable.appendChild(tbody);

            kbCard.appendChild(kbHeaderRow);
            kbCard.appendChild(kbItemsTable);
            sectionKb.appendChild(kbTitle);
            sectionKb.appendChild(kbCard);

            // 4. 注意書きアラート（DOM API で安全に構築）
            const alertBox = document.createElement("div");
            alertBox.style.cssText = "display:flex;align-items:flex-start;gap:8px;padding:8px 12px;border-radius:4px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);color:var(--vscode-foreground,#ddd);font-size:11px;";

            const alertIcon = document.createElement("span");
            alertIcon.textContent = "\u26A0"; // ⚠️
            alertIcon.style.cssText = "color:#eab308;font-size:13px;line-height:1;margin-top:1px;";

            const alertText = document.createElement("div");
            const alertBold = document.createElement("strong");
            alertBold.textContent = "注意: ";
            const alertMsg = document.createTextNode("設定の変更を完全に反映するには、ウィンドウのリロード（Reload Window）が必要です。");
            alertText.appendChild(alertBold);
            alertText.appendChild(alertMsg);

            alertBox.appendChild(alertIcon);
            alertBox.appendChild(alertText);

            body.appendChild(sectionSend);
            body.appendChild(sectionCmds);
            body.appendChild(sectionKb);
            body.appendChild(alertBox);

            // フッター
            const footer = document.createElement("div");
            footer.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-top:1px solid var(--vscode-widget-border,#333);background:var(--vscode-sideBar-background,#252526);";

            const resetBtn = document.createElement("button");
            resetBtn.type = "button";
            resetBtn.textContent = "初期設定に戻す";
            resetBtn.style.cssText = "background:transparent;border:none;color:var(--vscode-descriptionForeground,#888);font-size:11px;cursor:pointer;text-decoration:underline;padding:4px 0;";
            resetBtn.onmouseenter = () => resetBtn.style.color = "var(--vscode-foreground,#eee)";
            resetBtn.onmouseleave = () => resetBtn.style.color = "var(--vscode-descriptionForeground,#888)";

            const rightBtns = document.createElement("div");
            rightBtns.style.cssText = "display:flex;align-items:center;gap:8px;";

            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.textContent = "キャンセル";
            cancelBtn.style.cssText = "padding:5px 12px;font-size:11px;border-radius:3px;background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-widget-border,#555);cursor:pointer;";

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.textContent = "保存";
            saveBtn.style.cssText = "padding:5px 14px;font-size:11px;border-radius:3px;background:var(--vscode-button-secondaryBackground,#3a3d41);color:#fff;border:1px solid var(--vscode-widget-border,#555);cursor:pointer;";

            const saveReloadBtn = document.createElement("button");
            saveReloadBtn.type = "button";
            saveReloadBtn.textContent = "保存してリロード";
            saveReloadBtn.style.cssText = "padding:5px 14px;font-size:11px;border-radius:3px;background:var(--vscode-button-background,#0e639c);color:#fff;border:none;cursor:pointer;font-weight:500;";

            rightBtns.appendChild(cancelBtn);
            rightBtns.appendChild(saveBtn);
            rightBtns.appendChild(saveReloadBtn);
            footer.appendChild(resetBtn);
            footer.appendChild(rightBtns);

            modal.appendChild(header);
            modal.appendChild(body);
            modal.appendChild(footer);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const cleanup = () => {
                overlay.remove();
                focusChatInput();
            };

            const collectConfig = () => {
                const nextCfg = {
                    enterSendDisabled: isEnterSendDisabled,
                    commands: {}
                };
                cmdList.forEach(item => {
                    const inputs = cmdInputs[item.id];
                    nextCfg.commands[item.id] = {
                        primary: cleanCmdName(inputs.primary.value) || DEFAULT_CONFIG.commands[item.id].primary,
                        short: cleanCmdName(inputs.short.value) || DEFAULT_CONFIG.commands[item.id].short,
                        label: DEFAULT_CONFIG.commands[item.id].label
                    };
                });
                return nextCfg;
            };

            closeBtn.onclick = cleanup;
            cancelBtn.onclick = cleanup;

            resetBtn.onclick = () => {
                isEnterSendDisabled = DEFAULT_CONFIG.enterSendDisabled;
                updateToggleUI();
                cmdList.forEach(item => {
                    cmdInputs[item.id].primary.value = ":" + DEFAULT_CONFIG.commands[item.id].primary;
                    cmdInputs[item.id].short.value = ":" + DEFAULT_CONFIG.commands[item.id].short;
                });
            };

            saveBtn.onclick = () => {
                const newCfg = collectConfig();
                patch.saveConfig(newCfg);
                cleanup();
            };

            saveReloadBtn.onclick = () => {
                const newCfg = collectConfig();
                patch.saveConfig(newCfg);
                cleanup();
                patch.reloadWindow();
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) cleanup();
            };

            window.addEventListener("keydown", function escHandler(e) {
                if (e.key === "Escape" && document.getElementById("agy-patch-settings-overlay")) {
                    cleanup();
                    window.removeEventListener("keydown", escHandler);
                }
            });
        } catch (err) {
            console.error("showSettingsDialog error:", err);
            try {
                alert("設定ダイアログの表示エラー:\n" + String(err));
            } catch (_e) { }
        }
    }
    patch.showSettingsDialog = showSettingsDialog;


    // -------------------------------------------------------------------------
    // 3. セッション操作ショートカットイベントリスナーの登録
    // -------------------------------------------------------------------------
    patch.initSessionHooks = function (deps) {
        const { O, renameConv, optSummary, notify, getCurTitle, startNewConv, Ut, h4e } = deps;

        const onRename = async () => {
            if (!O) {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
                focusChatInput();
                return;
            }
            const curTitle = getCurTitle();
            const nextTitle = await showPromptDialog("新しいセッション名を入力してください:", curTitle);
            if (nextTitle && nextTitle !== curTitle) {
                try {
                    optSummary({ type: "updateOptimisticSummary", cascadeId: O, optimisticSummaryText: nextTitle });
                    await renameConv(O, Ut(h4e, { title: nextTitle }), true);
                    notify({ title: "セッション名を変更しました", message: `新しいタイトル: ${nextTitle}`, autoDismissMs: 3e3 });
                } catch (err) {
                    notify({ title: "セッション名の変更に失敗しました", message: String(err), autoDismissMs: 5e3 });
                }
            }
            focusChatInput();
        };

        const onPin = async () => {
            if (!O) {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
                focusChatInput();
                return;
            }
            try {
                optSummary({ type: "updateAnnotations", cascadeId: O, annotations: { pinned: true } });
                await renameConv(O, Ut(h4e, { pinned: true }), true);
                notify({ title: "セッションをピン留めしました", autoDismissMs: 3e3 });
            } catch (err) {
                notify({ title: "ピン留めの変更に失敗しました", message: String(err), autoDismissMs: 5e3 });
            }
            focusChatInput();
        };

        const onUnpin = async () => {
            if (!O) {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
                focusChatInput();
                return;
            }
            try {
                optSummary({ type: "updateAnnotations", cascadeId: O, annotations: { pinned: false } });
                await renameConv(O, Ut(h4e, { pinned: false }), true);
                notify({ title: "ピン留めを解除しました", autoDismissMs: 3e3 });
            } catch (err) {
                notify({ title: "ピン留めの変更に失敗しました", message: String(err), autoDismissMs: 5e3 });
            }
            focusChatInput();
        };

        const onNew = () => {
            startNewConv();
            focusChatInput();
        };

        // ヘッダータイトルのホバースタイル注入
        try {
            if (!document.getElementById("agy-header-title-style")) {
                const style = document.createElement("style");
                style.id = "agy-header-title-style";
                style.textContent = `
                    .flex.items-center.justify-between:has([data-tooltip-id="new-conversation-tooltip"]) .overflow-hidden.text-ellipsis.whitespace-nowrap {
                        cursor: pointer !important;
                        border-radius: 4px;
                        padding: 1px 4px;
                        margin: -1px -4px;
                        transition: background-color 0.15s, opacity 0.15s;
                    }
                    .flex.items-center.justify-between:has([data-tooltip-id="new-conversation-tooltip"]) .overflow-hidden.text-ellipsis.whitespace-nowrap:hover {
                        text-decoration: underline !important;
                        background-color: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.2)) !important;
                        opacity: 0.9 !important;
                    }
                `;
                document.head.appendChild(style);
            }
        } catch (_e) { }

        // ヘッダーセッションタイトルのクリックイベント (クリックで名前変更)
        const onHeaderTitleClick = (e) => {
            const target = e.target;
            if (!target) return;
            const titleEl = target.closest(".overflow-hidden.text-ellipsis.whitespace-nowrap");
            if (titleEl && !titleEl.closest("#session-drawer-container") && !titleEl.closest("#agy-patch-settings-overlay")) {
                const headerEl = titleEl.closest(".flex.items-center.justify-between");
                if (headerEl && headerEl.querySelector('[data-tooltip-id="new-conversation-tooltip"]')) {
                    e.preventDefault();
                    e.stopPropagation();
                    onRename();
                }
            }
        };

        const onArchive = async () => {
            if (!O) {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
                focusChatInput();
                return;
            }
            try {
                optSummary({ type: "updateAnnotations", cascadeId: O, annotations: { archived: true } });
                await renameConv(O, Ut(h4e, { archived: true }), true);
                notify({ title: "セッションをアーカイブしました", autoDismissMs: 3e3 });
            } catch (err) {
                notify({ title: "アーカイブに失敗しました", message: String(err), autoDismissMs: 5e3 });
            }
            focusChatInput();
        };

        const onUnarchive = async () => {
            if (!O) {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
                focusChatInput();
                return;
            }
            try {
                optSummary({ type: "updateAnnotations", cascadeId: O, annotations: { archived: false } });
                await renameConv(O, Ut(h4e, { archived: false }), true);
                notify({ title: "アーカイブを解除しました", autoDismissMs: 3e3 });
            } catch (err) {
                notify({ title: "アーカイブ解除に失敗しました", message: String(err), autoDismissMs: 5e3 });
            }
            focusChatInput();
        };

        window.addEventListener("action-session-rename", onRename);
        window.addEventListener("action-session-pin", onPin);
        window.addEventListener("action-session-unpin", onUnpin);
        window.addEventListener("action-session-new", onNew);
        window.addEventListener("action-session-archive", onArchive);
        window.addEventListener("action-session-unarchive", onUnarchive);
        document.addEventListener("click", onHeaderTitleClick, true);

        return () => {
            window.removeEventListener("action-session-rename", onRename);
            window.removeEventListener("action-session-pin", onPin);
            window.removeEventListener("action-session-unpin", onUnpin);
            window.removeEventListener("action-session-new", onNew);
            window.removeEventListener("action-session-archive", onArchive);
            window.removeEventListener("action-session-unarchive", onUnarchive);
            document.removeEventListener("click", onHeaderTitleClick, true);
        };
    };

    // -------------------------------------------------------------------------
    // 4. チャット送信時のコロンコマンド判定と実行
    // -------------------------------------------------------------------------
    patch.handleColonCommand = async function (rawText, ctx) {
        const txt = (rawText || "").trim();
        if (!txt.startsWith(":")) return false;

        const { rf, ti, Z$, Ot, Dt, fV, O, renameConv, optSummary, notify, getCurTitle, startNewConv, Ut, h4e } = ctx;
        const cfg = patch.getConfig();

        const matchCmd = (cmdKey, allowArgs = false) => {
            const cmd = cfg.commands[cmdKey];
            if (!cmd) return false;
            const parts = [cmd.primary, cmd.short].map(cleanCmdName).filter(Boolean).map(escapeRegExp);
            if (parts.length === 0) return false;
            const reg = new RegExp(`^:(${parts.join("|")})${allowArgs ? "(\\s.*)?" : "$"}`, "i");
            return reg.test(txt);
        };

        // resume
        if (matchCmd("resume", false)) {
            Z$(rf); Ot(); Dt([]);
            if (ti) { rf.getRootElement()?.blur(); fV(false); }
            window.dispatchEvent(new CustomEvent("open-session-drawer-focus"));
            return true;
        }

        // new
        if (matchCmd("new", false)) {
            Z$(rf); Ot(); Dt([]);
            if (ti) { rf.getRootElement()?.blur(); fV(false); }
            startNewConv();
            focusChatInput();
            return true;
        }

        // pin
        if (matchCmd("pin", false)) {
            Z$(rf); Ot(); Dt([]);
            if (ti) { rf.getRootElement()?.blur(); fV(false); }
            if (O) {
                try {
                    optSummary({ type: "updateAnnotations", cascadeId: O, annotations: { pinned: true } });
                    await renameConv(O, Ut(h4e, { pinned: true }), true);
                    notify({ title: "セッションをピン留めしました", autoDismissMs: 3e3 });
                } catch (err) {
                    notify({ title: "ピン留めの変更に失敗しました", message: String(err), autoDismissMs: 5e3 });
                }
            } else {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
            }
            focusChatInput();
            return true;
        }

        // unpin
        if (matchCmd("unpin", false)) {
            Z$(rf); Ot(); Dt([]);
            if (ti) { rf.getRootElement()?.blur(); fV(false); }
            if (O) {
                try {
                    optSummary({ type: "updateAnnotations", cascadeId: O, annotations: { pinned: false } });
                    await renameConv(O, Ut(h4e, { pinned: false }), true);
                    notify({ title: "ピン留めを解除しました", autoDismissMs: 3e3 });
                } catch (err) {
                    notify({ title: "ピン留めの変更に失敗しました", message: String(err), autoDismissMs: 5e3 });
                }
            } else {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
            }
            focusChatInput();
            return true;
        }

        // rename
        if (matchCmd("rename", true)) {
            const cmd = cfg.commands.rename;
            const parts = [cmd.primary, cmd.short].map(cleanCmdName).filter(Boolean).map(escapeRegExp);
            const stripReg = new RegExp(`^:(${parts.join("|")})\\s*`, "i");
            let nextTitle = txt.replace(stripReg, "").trim();
            if (!nextTitle) {
                try {
                    nextTitle = await showPromptDialog("新しいセッション名を入力してください:", getCurTitle());
                } catch (_e) { }
            }
            Z$(rf); Ot(); Dt([]);
            if (ti) { rf.getRootElement()?.blur(); fV(false); }

            if (!nextTitle) {
                focusChatInput();
                return true;
            }

            if (O) {
                try {
                    optSummary({ type: "updateOptimisticSummary", cascadeId: O, optimisticSummaryText: nextTitle });
                    await renameConv(O, Ut(h4e, { title: nextTitle }), true);
                    notify({ title: "セッション名を変更しました", message: `新しいタイトル: ${nextTitle}`, autoDismissMs: 3e3 });
                } catch (err) {
                    console.error("Rename failed:", err);
                    notify({ title: "セッション名の変更に失敗しました", message: String(err), autoDismissMs: 5e3 });
                }
            } else {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
            }
            focusChatInput();
            return true;
        }

        // archive
        if (matchCmd("archive", false)) {
            Z$(rf); Ot(); Dt([]);
            if (ti) { rf.getRootElement()?.blur(); fV(false); }
            if (O) {
                try {
                    optSummary({ type: "updateAnnotations", cascadeId: O, annotations: { archived: true } });
                    await renameConv(O, Ut(h4e, { archived: true }), true);
                    notify({ title: "セッションをアーカイブしました", autoDismissMs: 3e3 });
                } catch (err) {
                    notify({ title: "アーカイブに失敗しました", message: String(err), autoDismissMs: 5e3 });
                }
            } else {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
            }
            focusChatInput();
            return true;
        }

        // unarchive
        if (matchCmd("unarchive", false)) {
            Z$(rf); Ot(); Dt([]);
            if (ti) { rf.getRootElement()?.blur(); fV(false); }
            if (O) {
                try {
                    optSummary({ type: "updateAnnotations", cascadeId: O, annotations: { archived: false } });
                    await renameConv(O, Ut(h4e, { archived: false }), true);
                    notify({ title: "アーカイブを解除しました", autoDismissMs: 3e3 });
                } catch (err) {
                    notify({ title: "アーカイブ解除に失敗しました", message: String(err), autoDismissMs: 5e3 });
                }
            } else {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
            }
            focusChatInput();
            return true;
        }

        return false;
    };

    // -------------------------------------------------------------------------
    // 5. セッション一覧ドロワー コンポーネント生成ファクトリー
    // -------------------------------------------------------------------------
    patch.createSessionDrawer = function (deps) {
        const { We, yt, Re, mt, Of, nl, wC, bra, co, Cqo, HTn, Wa, Lmt, Ut, h4e, E, $e, yi } = deps;

        return function __SessionDrawer() {
            try {
                const wb = Of();
                if (wb && wb._commandService) {
                    patch._commandService = wb._commandService;
                }
            } catch (_e) { }

            const [isOpen, setIsOpen] = We(false);
            const [filterText, setFilterText] = We("");
            const [curIdx, setCurIdx] = We(0);
            const lastMousePos = mt({ x: -1, y: -1 });

            // アーカイブ済みトグルの開閉状態（localStorage で永続化）
            const [archiveOpen, setArchiveOpen] = We(() => {
                try {
                    return localStorage.getItem(ARCHIVE_DRAWER_KEY) === 'true';
                } catch (_e) { return false; }
            });
            const toggleArchiveSection = () => {
                setArchiveOpen((prev) => {
                    const next = !prev;
                    try { localStorage.setItem(ARCHIVE_DRAWER_KEY, String(next)); } catch (_e) { }
                    return next;
                });
            };

            const { trajectorySummariesProvider: tP } = Of();
            const summariesState = nl(tP);
            const summariesMap = summariesState?.summaries || tP?.getState()?.summaries || {};
            const sessionEntries = Object.entries(summariesMap).map(([k, V]) => ({ cascadeId: k, summary: V }));

            const activeCascadeId = wC();
            const rawCurTitle = bra(activeCascadeId, "");
            const { cascadeContext: { events: { setCascadeId } } } = co();
            const { startNewConversation } = Cqo();
            const { showPastConversationsPicker } = HTn();
            const { updateConversationAnnotations: pinConv, deleteCascadeTrajectory: delConv } = Wa();
            const optSummaryDrawer = Lmt();

            const focusInput = () => {
                let tryCnt = 0;
                const t = () => {
                    const inp = document.getElementById("session-drawer-search-input");
                    if (inp) {
                        inp.focus();
                        inp.select();
                    } else if (tryCnt++ < 10) {
                        setTimeout(t, 40);
                    }
                };
                setTimeout(t, 30);
            };

            // ドロワー開閉イベント購読
            yt(() => {
                const toggleHandler = () => setIsOpen((prev) => {
                    const nxt = !prev;
                    if (nxt) focusInput();
                    return nxt;
                });
                const openFocusHandler = () => setIsOpen((prev) => {
                    if (prev) {
                        focusChatInput();
                        return false;
                    }
                    focusInput();
                    return true;
                });

                window.addEventListener("toggle-session-drawer", toggleHandler);
                window.addEventListener("open-session-drawer-focus", openFocusHandler);
                return () => {
                    window.removeEventListener("toggle-session-drawer", toggleHandler);
                    window.removeEventListener("open-session-drawer-focus", openFocusHandler);
                };
            }, []);

            const toMs = (m) => {
                if (!m) return 0;
                const sec = m.lastUserInputTime?.seconds ?? m.lastModifiedTime?.seconds ?? m.createdTime?.seconds ?? 0;
                try { return Number(sec) * 1e3; } catch (_e) { return 0; }
            };

            const fmtAgo = (ms) => {
                if (!ms) return "";
                const diff = Math.max(0, Math.floor((Date.now() - ms) / 1e3));
                if (diff < 60) return "たった今";
                const min = Math.floor(diff / 60);
                if (min < 60) return `${min}分前`;
                const hr = Math.floor(min / 60);
                if (hr < 24) return `${hr}時間前`;
                const day = Math.floor(hr / 24);
                if (day < 7) return `${day}日前`;
                const wk = Math.floor(day / 7);
                if (wk < 4) return `${wk}週間前`;
                const d = new Date(ms);
                return `${d.getMonth() + 1}/${d.getDate()}`;
            };

            const togglePin = async (cid, curPinned, ev) => {
                ev?.stopPropagation();
                if (!cid) return;
                const nextPinned = !curPinned;
                try {
                    optSummaryDrawer({ type: "updateAnnotations", cascadeId: cid, annotations: { pinned: nextPinned } });
                    await pinConv(cid, Ut(h4e, { pinned: nextPinned }), true);
                } catch (err) {
                    console.error("Pin toggle failed:", err);
                }
            };

            const toggleArchive = async (cid, curArchived, ev) => {
                ev?.stopPropagation();
                if (!cid) return;
                const nextArchived = !curArchived;
                try {
                    optSummaryDrawer({ type: "updateAnnotations", cascadeId: cid, annotations: { archived: nextArchived } });
                    await pinConv(cid, Ut(h4e, { archived: nextArchived }), true);
                    // アーカイブ済みセクションを自動で開く
                    if (nextArchived) {
                        setArchiveOpen(true);
                        try { localStorage.setItem(ARCHIVE_DRAWER_KEY, 'true'); } catch (_e) { }
                    }
                } catch (err) {
                    console.error("Archive toggle failed:", err);
                }
            };

            const deleteSession = async (cid, ev) => {
                ev?.stopPropagation();
                const isActive = cid === activeCascadeId;
                try {
                    tP?.pushUpdate({ type: "delete", cascadeId: cid });
                    await delConv(cid);
                    if (isActive) {
                        startNewConversation();
                        setIsOpen(false);
                        focusChatInput();
                    }
                } catch (err) {
                    console.error("Delete session failed:", err);
                }
            };

            // セッション一覧のフィルタ＆ソート（アーカイブ済みは除外）
            // 要件: 現在開いているセッション（activeCascadeId）を最優先で一番上に配置！
            // その後は ピン留め優先 -> 最終更新時刻の降順
            const filteredSessions = Re(() => {
                const list = (sessionEntries || []).filter((item) => {
                    const s = item.summary;
                    if (!s || s.annotations?.archived || s.trajectoryMetadata?.parentConversationId) return false;
                    const title = typeof s.summary === "string" && s.summary ? s.summary :
                        (typeof s.title === "string" && s.title ? s.title : "無題のセッション");
                    return filterText ? title.toLowerCase().includes(filterText.toLowerCase()) : true;
                });

                return list.sort((b, y) => {
                    const isB = b.cascadeId === activeCascadeId;
                    const isY = y.cascadeId === activeCascadeId;
                    if (isB !== isY) return isB ? -1 : 1;

                    const pinB = !!b.summary?.annotations?.pinned;
                    const pinY = !!y.summary?.annotations?.pinned;
                    if (pinB !== pinY) return pinB ? -1 : 1;

                    return toMs(y.summary) - toMs(b.summary);
                }), list;
            }, [summariesMap, sessionEntries.length, filterText, activeCascadeId]);

            // アーカイブ済みセッション一覧（検索フィルター対象外・更新時刻降順）
            const filteredArchived = Re(() => {
                const list = (sessionEntries || []).filter((item) => {
                    const s = item.summary;
                    if (!s || !s.annotations?.archived) return false;
                    if (s.trajectoryMetadata?.parentConversationId) return false;
                    return true;
                });
                return list.sort((a, b) => toMs(b.summary) - toMs(a.summary));
            }, [summariesMap, sessionEntries.length]);

            yt(() => {
                setCurIdx(0);
            }, [filterText]);

            // ドロワーを開いた時に最上位（現在セッション）にキーボード選択位置を合わせる
            yt(() => {
                if (isOpen) {
                    focusInput();
                    lastMousePos.current = { x: -1, y: -1 };
                    let targetIdx = filteredSessions.findIndex((m) => m.cascadeId === activeCascadeId);
                    if (targetIdx < 0) targetIdx = 0;
                    setCurIdx(targetIdx);
                    setTimeout(() => {
                        document.getElementById(`session-item-${targetIdx}`)?.scrollIntoView({ block: "nearest" });
                    }, 60);
                }
            }, [isOpen]);

            const isCurrentPinned = activeCascadeId && summariesMap && summariesMap[activeCascadeId]
                ? !!summariesMap[activeCascadeId]?.annotations?.pinned
                : false;

            const curSessionName = (() => {
                if (!activeCascadeId) return `過去セッション (${filteredSessions.length})`;
                let t = rawCurTitle && rawCurTitle !== "Untitled Conversation" && rawCurTitle !== "Agent" ? rawCurTitle : "";
                if (!t && summariesMap && summariesMap[activeCascadeId]) {
                    const summ = summariesMap[activeCascadeId];
                    t = typeof summ?.summary === "string" && summ.summary ? summ.summary :
                        (typeof summ?.title === "string" && summ.title ? summ.title : "");
                }
                if (!t || t === "Untitled Conversation" || t === "Agent") {
                    try {
                        const el = document.querySelector(".overflow-hidden.text-ellipsis.whitespace-nowrap");
                        if (el && el.textContent) {
                            const txt = el.textContent.trim();
                            if (txt && txt !== "Agent") {
                                t = txt.includes(">") ? txt.split(">").pop().trim() : txt;
                            }
                        }
                    } catch (_e) { }
                }
                return (t && t !== "Untitled Conversation" && t !== "Agent") ? t : `過去セッション (${filteredSessions.length})`;
            })();

            const onKeyDown = (k) => {
                if (k.key === "ArrowDown") {
                    k.preventDefault();
                    if (filteredSessions.length > 0) {
                        setCurIdx((p) => {
                            const nxt = (p + 1) % filteredSessions.length;
                            document.getElementById(`session-item-${nxt}`)?.scrollIntoView({ block: "nearest" });
                            return nxt;
                        });
                    }
                } else if (k.key === "ArrowUp") {
                    k.preventDefault();
                    if (filteredSessions.length > 0) {
                        setCurIdx((p) => {
                            const nxt = (p - 1 + filteredSessions.length) % filteredSessions.length;
                            document.getElementById(`session-item-${nxt}`)?.scrollIntoView({ block: "nearest" });
                            return nxt;
                        });
                    }
                } else if (k.key === "Enter") {
                    k.preventDefault();
                    if (filteredSessions[curIdx]) {
                        const targetId = filteredSessions[curIdx].cascadeId;
                        setCascadeId(targetId);
                        setIsOpen(false);
                        focusChatInput();
                    }
                } else if (k.key === "Escape") {
                    k.preventDefault();
                    setIsOpen(false);
                    focusChatInput();
                }
            };

            return E("div", {
                className: "w-full border-b border-border bg-sidebar select-none shrink-0 z-10 transition-all text-xs",
                children: [
                    // ヘッダーバー
                    E("div", {
                        className: "flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-secondary/70 transition-colors",
                        onClick: () => setIsOpen((b) => {
                            const nxt = !b;
                            if (!nxt) focusChatInput();
                            else focusInput();
                            return nxt;
                        }),
                        children: [
                            E("div", {
                                className: "flex items-center gap-1.5 min-w-0 flex-1 mr-2",
                                children: [
                                    E($e, { name: "history", size: 14, className: "text-muted-foreground shrink-0" }),
                                    E("span", {
                                        className: "font-medium text-foreground truncate",
                                        children: "セッションリストを開く"
                                    }),
                                    E($e, { name: isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down", size: 14, className: "text-muted-foreground shrink-0" })
                                ]
                            }),
                            E("div", {
                                className: "flex items-center gap-1 shrink-0",
                                onClick: (m) => m.stopPropagation(),
                                children: [
                                    activeCascadeId && E("button", {
                                        type: "button",
                                        className: yi(
                                            "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors text-[11px] cursor-pointer",
                                            isCurrentPinned
                                                ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 font-medium"
                                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                        ),
                                        title: isCurrentPinned ? "現在のセッションのピン留めを解除 (F6 / Ctrl+F6)" : "現在のセッションをピン留め (F6)",
                                        onClick: (ev) => togglePin(activeCascadeId, isCurrentPinned, ev),
                                        children: [
                                            E($e, { name: "keep", size: 13, className: isCurrentPinned ? "text-amber-500" : "" }),
                                            E("span", { children: isCurrentPinned ? "ピン留め中" : "ピン留め" })
                                        ]
                                    }),
                                    E("button", {
                                        type: "button",
                                        className: "flex items-center gap-1 px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-[11px] cursor-pointer",
                                        title: "新規会話を開始",
                                        onClick: () => {
                                            startNewConversation();
                                            setIsOpen(false);
                                            focusChatInput();
                                        },
                                        children: [
                                            E($e, { name: "add", size: 13 }),
                                            E("span", { children: "新規" })
                                        ]
                                    }),
                                    E("button", {
                                        type: "button",
                                        className: "flex items-center gap-1 px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-[11px] cursor-pointer",
                                        title: "チャットペインパッチ設定",
                                        onClick: (ev) => {
                                            ev?.stopPropagation();
                                            patch.showSettingsDialog();
                                        },
                                        children: [
                                            E($e, { name: "settings", size: 13 })
                                        ]
                                    })
                                ]
                            })
                        ]
                    }),

                    // 展開部分: 検索 + リスト
                    isOpen && E("div", {
                        className: "px-3 pb-2 pt-1 border-t border-border/50 flex flex-col gap-1.5 bg-background/95 backdrop-blur shadow-sm animate-in fade-in duration-150",
                        children: [
                            // 検索インプット
                            E("div", {
                                className: "relative flex items-center w-full h-7 rounded bg-muted/60 px-2 border border-border/60 focus-within:ring-1 focus-within:ring-primary",
                                children: [
                                    E($e, { name: "search", size: 13, className: "text-muted-foreground shrink-0 mr-1.5" }),
                                    E("input", {
                                        id: "session-drawer-search-input",
                                        type: "text",
                                        placeholder: "セッションを検索 (↑↓で選択, Enterで決定)...",
                                        value: filterText,
                                        onChange: (m) => setFilterText(m.target.value),
                                        onKeyDown: onKeyDown,
                                        autoFocus: true,
                                        className: "w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-xs"
                                    }),
                                    filterText && E("button", {
                                        type: "button",
                                        onClick: () => setFilterText(""),
                                        className: "text-muted-foreground hover:text-foreground ml-1 cursor-pointer",
                                        children: E($e, { name: "close", size: 12 })
                                    })
                                ]
                            }),

                            // セッション一覧リスト
                            E("div", {
                                className: "overflow-y-auto max-h-56 flex flex-col gap-0.5 pr-0.5",
                                children: filteredSessions.length === 0
                                    ? E("div", {
                                        className: "py-3 text-center text-muted-foreground text-[11px]",
                                        children: "セッションが見つかりません"
                                    })
                                    : filteredSessions.map((item, idx) => {
                                        const cid = item.cascadeId;
                                        const isActive = cid === activeCascadeId;
                                        const isSelected = idx === curIdx;
                                        const isPinned = !!item.summary?.annotations?.pinned;
                                        const title = typeof item.summary?.summary === "string" && item.summary.summary
                                            ? item.summary.summary
                                            : (typeof item.summary?.title === "string" && item.summary.title
                                                ? item.summary.title
                                                : "無題のセッション");
                                        const ms = toMs(item.summary);
                                        const timeAgo = fmtAgo(ms);

                                        return E("div", {
                                            key: cid,
                                            id: `session-item-${idx}`,
                                            onMouseMove: (ev) => {
                                                if (lastMousePos.current.x === -1) {
                                                    lastMousePos.current = { x: ev.clientX, y: ev.clientY };
                                                    return;
                                                }
                                                // 3px以上マウスが動いた時だけ選択を切り替える（マウスガード）
                                                if (Math.abs(ev.clientX - lastMousePos.current.x) > 3 ||
                                                    Math.abs(ev.clientY - lastMousePos.current.y) > 3) {
                                                    lastMousePos.current = { x: ev.clientX, y: ev.clientY };
                                                    if (curIdx !== idx) setCurIdx(idx);
                                                }
                                            },
                                            onClick: () => {
                                                if (!isActive) setCascadeId(cid);
                                                setIsOpen(false);
                                                focusChatInput();
                                            },
                                            className: yi(
                                                "flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors group text-xs select-none",
                                                isSelected
                                                    ? "bg-primary/25 text-foreground ring-1.5 ring-primary font-medium shadow-xs"
                                                    : isActive
                                                        ? "bg-primary/10 text-foreground border-l-2 border-primary"
                                                        : "hover:bg-secondary text-foreground/80 hover:text-foreground"
                                            ),
                                            children: [
                                                // 左側: アイコン + タイトル + 現在バッジ
                                                E("div", {
                                                    className: "flex items-center gap-1.5 min-w-0 pr-2",
                                                    children: [
                                                        isActive
                                                            ? E("span", {
                                                                className: "w-3 h-3 rounded-full border border-primary flex items-center justify-center shrink-0",
                                                                children: E("span", { className: "w-1.5 h-1.5 rounded-full bg-primary" })
                                                            })
                                                            : E($e, {
                                                                name: "chat_bubble",
                                                                size: 12,
                                                                className: "text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100"
                                                            }),
                                                        E("span", { className: "truncate", title: title, children: title }),
                                                        isActive && E("span", {
                                                            className: "text-[10px] px-1 py-0.2 rounded bg-primary/20 text-primary font-normal shrink-0",
                                                            children: "現在"
                                                        })
                                                    ]
                                                }),

                                                // 右側: ピン操作 + アーカイブ + 経過時間 + 削除ボタン
                                                E("div", {
                                                    className: "flex items-center gap-1.5 shrink-0",
                                                    children: [
                                                        E("button", {
                                                            type: "button",
                                                            className: yi(
                                                                "p-0.5 rounded hover:bg-secondary-foreground/15 transition-all cursor-pointer",
                                                                isPinned ? "text-amber-500 opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-70 hover:!opacity-100"
                                                            ),
                                                            title: isPinned ? "ピン留めを解除" : "ピン留め",
                                                            onClick: (ev) => togglePin(cid, isPinned, ev),
                                                            children: E($e, { name: "keep", size: 12 })
                                                        }),
                                                        E("button", {
                                                            type: "button",
                                                            className: "p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-secondary-foreground/15 transition-all cursor-pointer",
                                                            title: "アーカイブ",
                                                            onClick: (ev) => toggleArchive(cid, false, ev),
                                                            children: E($e, { name: "inventory_2", size: 12 })
                                                        }),
                                                        timeAgo && E("span", {
                                                            className: "text-[11px] text-muted-foreground/90 group-hover:text-foreground/90 shrink-0 font-normal transition-colors",
                                                            children: timeAgo
                                                        }),
                                                        E("button", {
                                                            type: "button",
                                                            className: yi("p-0.5 rounded text-red-500/70 hover:text-red-500 hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"),
                                                            title: "セッションを削除",
                                                            onClick: (ev) => deleteSession(cid, ev),
                                                            children: E($e, { name: "delete", size: 12 })
                                                        })
                                                    ]
                                                })
                                            ]
                                        });
                                    })
                            }),

                            // アーカイブ済みセクション
                            filteredArchived.length > 0 && E("div", {
                                className: "border-t border-border/50 mt-0.5",
                                children: [
                                    // アーカイブ済みトグルヘッダー
                                    E("div", {
                                        className: "flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-secondary/50 transition-colors select-none",
                                        onClick: toggleArchiveSection,
                                        children: [
                                            E($e, {
                                                name: "keyboard_arrow_down",
                                                size: 12,
                                                className: "text-muted-foreground shrink-0 transition-transform",
                                                style: { transform: archiveOpen ? "rotate(0deg)" : "rotate(-90deg)" }
                                            }),
                                            E($e, { name: "inventory_2", size: 12, className: "text-muted-foreground/70 shrink-0" }),
                                            E("span", {
                                                className: "text-[11px] text-muted-foreground/80",
                                                children: `アーカイブ済み (${filteredArchived.length})`
                                            })
                                        ]
                                    }),

                                    // アーカイブ済みリスト
                                    archiveOpen && E("div", {
                                        className: "overflow-y-auto max-h-40 flex flex-col gap-0.5 pr-0.5",
                                        children: filteredArchived.map((item) => {
                                            const cid = item.cascadeId;
                                            const isActive = cid === activeCascadeId;
                                            const title = typeof item.summary?.summary === "string" && item.summary.summary
                                                ? item.summary.summary
                                                : (typeof item.summary?.title === "string" && item.summary.title
                                                    ? item.summary.title
                                                    : "無題のセッション");
                                            const timeAgo = fmtAgo(toMs(item.summary));

                                            return E("div", {
                                                key: cid,
                                                onClick: () => {
                                                    if (!isActive) setCascadeId(cid);
                                                    setIsOpen(false);
                                                    focusChatInput();
                                                },
                                                className: yi(
                                                    "flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors group text-xs select-none opacity-60 hover:opacity-100",
                                                    isActive
                                                        ? "bg-primary/10 text-foreground border-l-2 border-primary"
                                                        : "hover:bg-secondary text-foreground/70 hover:text-foreground"
                                                ),
                                                children: [
                                                    E("div", {
                                                        className: "flex items-center gap-1.5 min-w-0 pr-2",
                                                        children: [
                                                            E($e, { name: "inventory_2", size: 12, className: "text-muted-foreground shrink-0 opacity-60" }),
                                                            E("span", { className: "truncate", title: title, children: title }),
                                                            isActive && E("span", {
                                                                className: "text-[10px] px-1 py-0.2 rounded bg-primary/20 text-primary font-normal shrink-0",
                                                                children: "現在"
                                                            })
                                                        ]
                                                    }),
                                                    E("div", {
                                                        className: "flex items-center gap-1.5 shrink-0",
                                                        children: [
                                                            E("button", {
                                                                type: "button",
                                                                className: "p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-secondary-foreground/15 transition-all cursor-pointer",
                                                                title: "アーカイブを解除",
                                                                onClick: (ev) => toggleArchive(cid, true, ev),
                                                                children: E($e, { name: "unarchive", size: 12 })
                                                            }),
                                                            timeAgo && E("span", {
                                                                className: "text-[11px] text-muted-foreground/70 shrink-0 font-normal",
                                                                children: timeAgo
                                                            }),
                                                            E("button", {
                                                                type: "button",
                                                                className: "p-0.5 rounded text-red-500/70 hover:text-red-500 hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-all cursor-pointer",
                                                                title: "セッションを削除",
                                                                onClick: (ev) => deleteSession(cid, ev),
                                                                children: E($e, { name: "delete", size: 12 })
                                                            })
                                                        ]
                                                    })
                                                ]
                                            });
                                        })
                                    })
                                ]
                            })
                        ]
                    })
                ]
            });
        };
    };

    // -------------------------------------------------------------------------
    // 6. AI 利用状況・クォータ残量バッジ (Vitals Module)
    // -------------------------------------------------------------------------
    patch._lsPort = null;
    patch._lsToken = null;
    patch._lsLastFetchTime = 0;
    patch._lsQuotaCache = null;
    patch._lsFetchPromise = null;
    patch._vitalsListeners = new Set();

    patch.setLanguageServerInfo = function (port, token) {
        if (!port || !token) return;
        const changed = patch._lsPort !== port || patch._lsToken !== token;
        patch._lsPort = port;
        patch._lsToken = token;
        if (changed) {
            patch.fetchQuotaSummary(true);
        }
    };

    patch.onVitalsChange = function (listener) {
        patch._vitalsListeners.add(listener);
        return () => patch._vitalsListeners.delete(listener);
    };

    patch._notifyVitalsChange = function () {
        for (const fn of patch._vitalsListeners) {
            try { fn(patch._lsQuotaCache); } catch (_e) { }
        }
    };

    // サービス稼働ステータス取得 (Google & Claude)
    // ai-vitals 準拠のステータス詳細判定（重大な障害 / 軽微な障害 / 正常 / 取得不可）
    patch._statusCache = { gemini: "正常", claude: "正常", lastCheck: 0 };
    patch.fetchServiceStatuses = async function (force = false) {
        const now = Date.now();
        if (!force && (now - patch._statusCache.lastCheck < 180000)) {
            return patch._statusCache;
        }
        patch._statusCache.lastCheck = now;
        try {
            // Google Cloud / Gemini
            fetch("https://status.cloud.google.com/incidents.json")
                .then(r => r.json())
                .then(incs => {
                    if (Array.isArray(incs)) {
                        const active = incs.filter(i => !i.end);
                        let state = "正常";
                        for (const inc of active) {
                            const desc = `${inc.service_name || ""} ${inc.external_desc || ""}`.toLowerCase();
                            if (/gemini|vertex|generative|ai platform|language/.test(desc)) {
                                const sev = (inc.severity || "").toLowerCase();
                                if (sev === "high" || sev === "critical" || sev === "major") {
                                    state = "重大な障害";
                                    break;
                                } else {
                                    state = "軽微な障害";
                                }
                            }
                        }
                        patch._statusCache.gemini = state;
                    }
                })
                .catch(() => { });

            // Claude / Anthropic
            fetch("https://status.claude.com/api/v2/summary.json")
                .then(r => r.json())
                .then(data => {
                    const indicator = data?.status?.indicator;
                    if (!indicator || indicator === "none") {
                        patch._statusCache.claude = "正常";
                    } else if (indicator === "major" || indicator === "critical") {
                        patch._statusCache.claude = "重大な障害";
                    } else {
                        patch._statusCache.claude = "軽微な障害";
                    }
                })
                .catch(() => { });
        } catch (_e) { }
        return patch._statusCache;
    };

    // リセット日時のフォーマット: YY/MM/DD HH:MM (Dd HH:MM) または (HH:MM)
    function formatResetDetails(dateStr, isWeekly = false) {
        if (!dateStr) return { absStr: "--/--/-- --:--", relStr: "--:--" };
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const yy = String(d.getFullYear()).slice(-2);
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const hh = String(d.getHours()).padStart(2, "0");
            const mi = String(d.getMinutes()).padStart(2, "0");
            const absStr = `${yy}/${mm}/${dd} ${hh}:${mi}`;

            const diffMs = d.getTime() - now.getTime();
            if (diffMs <= 0) {
                return { absStr, relStr: isWeekly ? "0d 00:00" : "00:00" };
            }
            const totalMin = Math.floor(diffMs / 60000);
            const days = Math.floor(totalMin / 1440);
            const remMin = totalMin % 1440;
            const hours = Math.floor(remMin / 60);
            const mins = remMin % 60;

            const timeStr = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
            const relStr = isWeekly ? `${days}d ${timeStr}` : timeStr;
            return { absStr, relStr };
        } catch (_e) {
            return { absStr: "--/--/-- --:--", relStr: "--:--" };
        }
    }

    // 参考元 (ai-vitals) の週枠ペース判定ロジック
    // windowMinutes = 7日(10080分)。残り時間と消費率(100 - 残量%)の差分で判定
    function calcPaceStatus(remainingPercent, dateStr) {
        if (remainingPercent === null || remainingPercent === undefined || !dateStr) return null;
        try {
            const resetsAtSec = new Date(dateStr).getTime() / 1000;
            const nowSec = Date.now() / 1000;
            const totalSec = 10080 * 60; // 7日間
            const remSec = Math.max(0, resetsAtSec - nowSec);
            const elapsedSec = Math.max(0, totalSec - remSec);
            if (elapsedSec < 1800) return "適正ペース"; // 最初の30分は十分なデータなし
            const usedPercent = 100 - remainingPercent;
            const timePct = (elapsedSec / totalSec) * 100;
            const diff = usedPercent - timePct;
            if (diff > 15) return "ハイペース注意";
            if (diff < -10) return "安全ペース";
            return "適正ペース";
        } catch (_e) {
            return "適正ペース";
        }
    }

    patch.fetchQuotaSummary = async function (force = false) {
        if (!patch._lsPort || !patch._lsToken) {
            return patch._lsQuotaCache;
        }
        const now = Date.now();
        if (!force && patch._lsQuotaCache && (now - patch._lsLastFetchTime < 60000)) {
            return patch._lsQuotaCache;
        }
        if (patch._lsFetchPromise) {
            return patch._lsFetchPromise;
        }

        patch._lsFetchPromise = (async () => {
            try {
                // 通常 port+1 が HTTP 平文ポート、port が HTTPS。両方を試行
                const portsToTry = [patch._lsPort + 1, patch._lsPort];
                let json = null;

                for (const p of portsToTry) {
                    for (const proto of ["http", "https"]) {
                        try {
                            const url = `${proto}://127.0.0.1:${p}/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`;
                            const resp = await fetch(url, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Connect-Protocol-Version": "1",
                                    "X-Codeium-Csrf-Token": patch._lsToken
                                },
                                body: JSON.stringify({
                                    metadata: { ideName: "antigravity", extensionName: "antigravity", locale: "ja" }
                                })
                            });
                            if (resp.ok) {
                                json = await resp.json();
                                if (json?.response?.groups) break;
                            }
                        } catch (_err) { }
                    }
                    if (json?.response?.groups) break;
                }

                if (!json?.response?.groups) {
                    return patch._lsQuotaCache;
                }

                const groups = json.response.groups;
                let gemini5h = null, geminiWeekly = null;
                let claude5h = null, claudeWeekly = null;

                for (const g of groups) {
                    const disp = (g.displayName || "").toLowerCase();
                    const buckets = g.buckets || [];
                    const isGemini = disp.includes("gemini");
                    const isClaude = disp.includes("claude") || disp.includes("gpt") || disp.includes("3p");

                    for (const b of buckets) {
                        const frac = b.remainingFraction !== undefined ? b.remainingFraction : 1.0;
                        const pct = Math.round(frac * 100);
                        const resetStr = b.resetTime || "";
                        const item = {
                            bucketId: b.bucketId,
                            displayName: b.displayName,
                            fraction: frac,
                            percent: pct,
                            resetTime: resetStr
                        };
                        if (isGemini) {
                            if (b.window === "5h") gemini5h = item;
                            else if (b.window === "weekly") geminiWeekly = item;
                        } else if (isClaude) {
                            if (b.window === "5h") claude5h = item;
                            else if (b.window === "weekly") claudeWeekly = item;
                        }
                    }
                }

                patch._lsQuotaCache = {
                    fetchedAt: Date.now(),
                    gemini: { h5: gemini5h, weekly: geminiWeekly },
                    claude: { h5: claude5h, weekly: claudeWeekly }
                };
                patch._lsLastFetchTime = Date.now();
                patch._notifyVitalsChange();
                return patch._lsQuotaCache;
            } catch (err) {
                console.warn("[AGY Patch] Quota fetch error:", err);
                return patch._lsQuotaCache;
            } finally {
                patch._lsFetchPromise = null;
            }
        })();

        return patch._lsFetchPromise;
    };

    // VitalsBar React コンポーネント生成（ドロワー一覧と同様の確実な独立バー方式）
    patch.createVitalsBar = function (deps) {
        const { We, yt, me, E, yi } = deps;

        return function VitalsBar() {
            try {
                const [quota, setQuota] = We(() => patch._lsQuotaCache);
                const [statusInfo, setStatusInfo] = We(() => patch._statusCache);
                const [isHovered, setIsHovered] = We(false);
                const [isRefreshing, setIsRefreshing] = We(false);

                // 初回マウント時 & 変更購読
                yt(() => {
                    const unsubscribe = patch.onVitalsChange((data) => {
                        setQuota(data);
                    });
                    if (!patch._lsQuotaCache) {
                        patch.fetchQuotaSummary();
                    }
                    patch.fetchServiceStatuses().then(s => setStatusInfo({ ...s }));

                    // 60秒ごとにクォータ自動更新、180秒ごとにステータス確認
                    const timer = setInterval(() => {
                        patch.fetchQuotaSummary();
                        patch.fetchServiceStatuses().then(s => setStatusInfo({ ...s }));
                    }, 60000);
                    return () => {
                        unsubscribe();
                        clearInterval(timer);
                    };
                }, []);

                const handleClick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsRefreshing(true);
                    Promise.all([
                        patch.fetchQuotaSummary(true),
                        patch.fetchServiceStatuses(true)
                    ]).finally(() => {
                        setStatusInfo({ ...patch._statusCache });
                        setTimeout(() => setIsRefreshing(false), 400);
                    });
                };

                const gItem = quota?.gemini?.weekly || quota?.gemini?.h5;
                const cItem = quota?.claude?.weekly || quota?.claude?.h5;

                const gPct = gItem ? gItem.percent : null;
                const cPct = cItem ? cItem.percent : null;

                // 残量カラー: 10%を下回ったら赤 (< 10)
                const getColorClass = (pct) => {
                    if (pct === null || pct === undefined) return "text-muted-foreground";
                    if (pct < 10) return "text-red-400 font-semibold";
                    if (pct <= 25) return "text-amber-400 font-medium";
                    return "text-emerald-400/90";
                };

                const getColorStyle = (pct) => {
                    if (pct === null || pct === undefined) return { color: "#94a3b8" };
                    if (pct < 10) return { color: "#f87171", fontWeight: "600" };
                    if (pct <= 25) return { color: "#fbbf24", fontWeight: "500" };
                    return { color: "#34d399" };
                };

                // ペースバッジカラー (インラインスタイルで確実に反映)
                const getPaceStyle = (pace) => {
                    if (pace === "ハイペース注意") return { color: "#f87171", fontWeight: "500" }; // 赤
                    if (pace === "安全ペース") return { color: "#22d3ee", fontWeight: "500" };     // シアン
                    return { color: "#34d399", fontWeight: "500" };                                 // 緑 (適正ペース)
                };

                // サービステータスカラー (ai-vitals 準拠: 正常=緑 / 軽微な障害=黄 / 重大な障害=赤)
                const getServiceStatusStyle = (st) => {
                    if (!st || st === "正常") return { color: "#34d399" };
                    if (st === "軽微な障害") return { color: "#fbbf24" };
                    if (st === "重大な障害") return { color: "#f87171", fontWeight: "600" };
                    return { color: "#94a3b8" };
                };

                const hasData = gPct !== null || cPct !== null;

                // 各種詳細データの計算
                const gemini5hReset = formatResetDetails(quota?.gemini?.h5?.resetTime, false);
                const geminiWeeklyReset = formatResetDetails(quota?.gemini?.weekly?.resetTime, true);
                const geminiWeeklyPace = calcPaceStatus(quota?.gemini?.weekly?.percent, quota?.gemini?.weekly?.resetTime);

                const claude5hReset = formatResetDetails(quota?.claude?.h5?.resetTime, false);
                const claudeWeeklyReset = formatResetDetails(quota?.claude?.weekly?.resetTime, true);
                const claudeWeeklyPace = calcPaceStatus(quota?.claude?.weekly?.percent, quota?.claude?.weekly?.resetTime);

                return E("div", {
                    className: "absolute bottom-full right-2 mb-1 pointer-events-none flex items-center justify-end text-xs select-none z-30",
                    children: [
                        // 右寄せ: クォータ残量バッジ（マウスオーバー/クリック対象のみ pointer-events-auto）
                        E("div", {
                            className: "relative flex items-center pointer-events-auto",
                            onMouseEnter: () => setIsHovered(true),
                            onMouseLeave: () => setIsHovered(false),
                            children: [
                                E("button", {
                                    type: "button",
                                    onClick: handleClick,
                                    title: "クリックでクォータ情報を即時更新 / ホバーで詳細表示",
                                    className: "flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono cursor-pointer transition-all bg-editor-background hover:bg-muted border-border text-foreground/90 hover:text-foreground shadow-sm whitespace-nowrap",
                                    style: { backgroundColor: "var(--vscode-editor-background, #1e1e1e)" },
                                    children: hasData ? [
                                        E("div", {
                                            className: "flex items-center gap-1 leading-none whitespace-nowrap",
                                            children: [
                                                E("span", {
                                                    className: isRefreshing ? "inline-block animate-spin mr-0.5 text-[10px]" : "opacity-60 font-sans text-[10px] mr-0.5",
                                                    children: isRefreshing ? "⚡" : ""
                                                }),
                                                E("span", { className: "opacity-60 font-sans text-[10px]", children: "AI rem." }),
                                                E("span", { className: "opacity-60 font-sans text-[10px] ml-0.5", children: "G:" }),
                                                E("span", { className: getColorClass(gPct), children: `${gPct ?? "--"}%` }),
                                                E("span", { className: "opacity-30 mx-0.5", children: "|" }),
                                                E("span", { className: "opacity-60 font-sans text-[10px]", children: "C:" }),
                                                E("span", { className: getColorClass(cPct), children: `${cPct ?? "--"}%` })
                                            ].filter(Boolean)
                                        })
                                    ] : [
                                        E("span", { className: "text-muted-foreground text-[10px] whitespace-nowrap", children: "AI rem. 取得中..." })
                                    ]
                                }),

                                // ホバー展開ツールチップ (漆黒背景 #0d0e11 / 余裕のある横幅 min-w-[340px] / 完全改行防止)
                                (isHovered && quota) ? E("div", {
                                    className: "absolute bottom-full right-0 mb-1.5 z-[99999] p-3 rounded-lg border shadow-2xl min-w-[340px] text-xs font-sans animate-in fade-in duration-100 whitespace-nowrap select-none",
                                    style: {
                                        backgroundColor: "#0d0e11",
                                        color: "#e2e8f0",
                                        borderColor: "#27272a",
                                        pointerEvents: "none"
                                    },
                                    children: [
                                        // タイトルバー (そのまま保持)
                                        E("div", {
                                            className: "flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 gap-3 whitespace-nowrap",
                                            children: [
                                                E("span", {
                                                    className: "font-semibold text-white flex items-center gap-1.5 whitespace-nowrap",
                                                    children: ["⚡", " AI クォータ利用状況"]
                                                }),
                                                E("span", {
                                                    className: "text-[10px] text-gray-400 whitespace-nowrap",
                                                    children: "クリックで更新"
                                                })
                                            ]
                                        }),

                                        // Gemini Models
                                        E("div", {
                                            className: "flex flex-col gap-1 mb-2.5",
                                            children: [
                                                // 見出し & 正常/異常ステータス（右寄せ）
                                                E("div", {
                                                    className: "flex items-center justify-between font-medium text-[11px] gap-3 whitespace-nowrap",
                                                    children: [
                                                        E("span", { className: "font-semibold whitespace-nowrap", style: { color: "#60a5fa" }, children: "Gemini Models" }),
                                                        E("span", {
                                                            className: "text-[11px] font-medium whitespace-nowrap",
                                                            style: getServiceStatusStyle(statusInfo?.gemini),
                                                            children: statusInfo?.gemini || "正常"
                                                        })
                                                    ]
                                                }),

                                                // 5h remains
                                                quota.gemini.h5 ? E("div", {
                                                    className: "flex flex-col pl-1 text-[11px]",
                                                    children: [
                                                        E("div", {
                                                            className: "flex items-center justify-between gap-3 whitespace-nowrap",
                                                            children: [
                                                                E("span", { className: "text-gray-300 whitespace-nowrap", children: "5h remains:" }),
                                                                E("span", {
                                                                    className: "whitespace-nowrap font-mono",
                                                                    style: getColorStyle(quota.gemini.h5.percent),
                                                                    children: `${quota.gemini.h5.percent ?? "--"}%`
                                                                })
                                                            ]
                                                        }),
                                                        E("div", {
                                                            className: "text-[10px] text-gray-400 text-right whitespace-nowrap",
                                                            children: `reset: ${gemini5hReset.absStr} (${gemini5hReset.relStr})`
                                                        })
                                                    ]
                                                }) : null,

                                                // 7d remains
                                                quota.gemini.weekly ? E("div", {
                                                    className: "flex flex-col pl-1 text-[11px] mt-0.5",
                                                    children: [
                                                        E("div", {
                                                            className: "flex items-center justify-between gap-3 whitespace-nowrap",
                                                            children: [
                                                                E("span", { className: "text-gray-300 whitespace-nowrap", children: "7d remains:" }),
                                                                E("div", {
                                                                    className: "flex items-center gap-1.5 whitespace-nowrap",
                                                                    children: [
                                                                        geminiWeeklyPace ? E("span", {
                                                                            className: "text-[10px] whitespace-nowrap px-1.5 py-0.2 rounded border",
                                                                            style: {
                                                                                ...getPaceStyle(geminiWeeklyPace),
                                                                                borderColor: "rgba(255,255,255,0.1)",
                                                                                backgroundColor: "rgba(255,255,255,0.03)"
                                                                            },
                                                                            children: geminiWeeklyPace
                                                                        }) : null,
                                                                        E("span", {
                                                                            className: "whitespace-nowrap font-mono",
                                                                            style: getColorStyle(quota.gemini.weekly.percent),
                                                                            children: `${quota.gemini.weekly.percent ?? "--"}%`
                                                                        })
                                                                    ].filter(Boolean)
                                                                })
                                                            ]
                                                        }),
                                                        E("div", {
                                                            className: "text-[10px] text-gray-400 text-right whitespace-nowrap",
                                                            children: `reset: ${geminiWeeklyReset.absStr} (${geminiWeeklyReset.relStr})`
                                                        })
                                                    ]
                                                }) : null
                                            ].filter(Boolean)
                                        }),

                                        // Claude & GPT Models
                                        E("div", {
                                            className: "flex flex-col gap-1 pt-2 border-t border-white/10",
                                            children: [
                                                // 見出し & 正常/異常ステータス（右寄せ）
                                                E("div", {
                                                    className: "flex items-center justify-between font-medium text-[11px] gap-3 whitespace-nowrap",
                                                    children: [
                                                        E("span", { className: "font-semibold whitespace-nowrap", style: { color: "#fbbf24" }, children: "Claude & GPT Models" }),
                                                        E("span", {
                                                            className: "text-[11px] font-medium whitespace-nowrap",
                                                            style: getServiceStatusStyle(statusInfo?.claude),
                                                            children: statusInfo?.claude || "正常"
                                                        })
                                                    ]
                                                }),

                                                // 5h remains
                                                quota.claude.h5 ? E("div", {
                                                    className: "flex flex-col pl-1 text-[11px]",
                                                    children: [
                                                        E("div", {
                                                            className: "flex items-center justify-between gap-3 whitespace-nowrap",
                                                            children: [
                                                                E("span", { className: "text-gray-300 whitespace-nowrap", children: "5h remains:" }),
                                                                E("span", {
                                                                    className: "whitespace-nowrap font-mono",
                                                                    style: getColorStyle(quota.claude.h5.percent),
                                                                    children: `${quota.claude.h5.percent ?? "--"}%`
                                                                })
                                                            ]
                                                        }),
                                                        E("div", {
                                                            className: "text-[10px] text-gray-400 text-right whitespace-nowrap",
                                                            children: `reset: ${claude5hReset.absStr} (${claude5hReset.relStr})`
                                                        })
                                                    ]
                                                }) : null,

                                                // 7d remains
                                                quota.claude.weekly ? E("div", {
                                                    className: "flex flex-col pl-1 text-[11px] mt-0.5",
                                                    children: [
                                                        E("div", {
                                                            className: "flex items-center justify-between gap-3 whitespace-nowrap",
                                                            children: [
                                                                E("span", { className: "text-gray-300 whitespace-nowrap", children: "7d remains:" }),
                                                                E("div", {
                                                                    className: "flex items-center gap-1.5 whitespace-nowrap",
                                                                    children: [
                                                                        claudeWeeklyPace ? E("span", {
                                                                            className: "text-[10px] whitespace-nowrap px-1.5 py-0.2 rounded border",
                                                                            style: {
                                                                                ...getPaceStyle(claudeWeeklyPace),
                                                                                borderColor: "rgba(255,255,255,0.1)",
                                                                                backgroundColor: "rgba(255,255,255,0.03)"
                                                                            },
                                                                            children: claudeWeeklyPace
                                                                        }) : null,
                                                                        E("span", {
                                                                            className: "whitespace-nowrap font-mono",
                                                                            style: getColorStyle(quota.claude.weekly.percent),
                                                                            children: `${quota.claude.weekly.percent ?? "--"}%`
                                                                        })
                                                                    ].filter(Boolean)
                                                                })
                                                            ]
                                                        }),
                                                        E("div", {
                                                            className: "text-[10px] text-gray-400 text-right whitespace-nowrap",
                                                            children: `reset: ${claudeWeeklyReset.absStr} (${claudeWeeklyReset.relStr})`
                                                        })
                                                    ]
                                                }) : null
                                            ].filter(Boolean)
                                        })
                                    ]
                                }) : null
                            ].filter(Boolean)
                        })
                    ]
                });
            } catch (err) {
                console.error("[AGY Patch] VitalsBar render error:", err);
                return null;
            }
        };
    };

    // グローバルオブジェクトにエクスポート
    global.__AGY_SESSION_PATCH__ = patch;

})(typeof window !== 'undefined' ? window : globalThis);
