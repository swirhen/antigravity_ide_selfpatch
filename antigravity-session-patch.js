/**
 * Antigravity IDE - セッション一覧・名前変更・改行パッチ 独立モジュール
 * File: antigravity-session-patch.js
 */
(function (global) {
    'use strict';

    const patch = {};

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
                } catch (_e) {}
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

        window.addEventListener("action-session-rename", onRename);
        window.addEventListener("action-session-pin", onPin);
        window.addEventListener("action-session-unpin", onUnpin);
        window.addEventListener("action-session-new", onNew);

        return () => {
            window.removeEventListener("action-session-rename", onRename);
            window.removeEventListener("action-session-pin", onPin);
            window.removeEventListener("action-session-unpin", onUnpin);
            window.removeEventListener("action-session-new", onNew);
        };
    };

    // -------------------------------------------------------------------------
    // 4. チャット送信時のコロンコマンド判定と実行
    // -------------------------------------------------------------------------
    patch.handleColonCommand = async function (rawText, ctx) {
        const txt = (rawText || "").trim();
        if (!txt.startsWith(":")) return false;

        const { rf, ti, Z$, Ot, Dt, fV, O, renameConv, optSummary, notify, getCurTitle, startNewConv, Ut, h4e } = ctx;

        // :resume / :res
        if (/^:(resume|res)$/i.test(txt)) {
            Z$(rf); Ot(); Dt([]);
            if (ti) { rf.getRootElement()?.blur(); fV(false); }
            window.dispatchEvent(new CustomEvent("open-session-drawer-focus"));
            return true;
        }

        // :new / :n
        if (/^:(new|n)$/i.test(txt)) {
            Z$(rf); Ot(); Dt([]);
            if (ti) { rf.getRootElement()?.blur(); fV(false); }
            startNewConv();
            focusChatInput();
            return true;
        }

        // :pin / :p または :unpin / :up
        const isPin = /^:(pin|p)$/i.test(txt);
        const isUnpin = /^:(unpin|up)$/i.test(txt);
        if (isPin || isUnpin) {
            Z$(rf); Ot(); Dt([]);
            if (ti) { rf.getRootElement()?.blur(); fV(false); }
            if (O) {
                try {
                    optSummary({ type: "updateAnnotations", cascadeId: O, annotations: { pinned: isPin } });
                    await renameConv(O, Ut(h4e, { pinned: isPin }), true);
                    notify({ title: isPin ? "セッションをピン留めしました" : "ピン留めを解除しました", autoDismissMs: 3e3 });
                } catch (err) {
                    notify({ title: "ピン留めの変更に失敗しました", message: String(err), autoDismissMs: 5e3 });
                }
            } else {
                notify({ title: "有効なセッションが見つかりません", autoDismissMs: 3e3 });
            }
            focusChatInput();
            return true;
        }

        // :rename / :ren
        if (/^:(rename|ren)(\s.*)?$/i.test(txt)) {
            let nextTitle = txt.replace(/^:(rename|ren)\s*/i, "").trim();
            if (!nextTitle) {
                try {
                    nextTitle = await showPromptDialog("新しいセッション名を入力してください:", getCurTitle());
                } catch (_e) {}
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

        return false;
    };

    // -------------------------------------------------------------------------
    // 5. セッション一覧ドロワー コンポーネント生成ファクトリー
    // -------------------------------------------------------------------------
    patch.createSessionDrawer = function (deps) {
        const { We, yt, Re, mt, Of, nl, wC, bra, co, Cqo, HTn, Wa, Lmt, Ut, h4e, E, $e, yi } = deps;

        return function __SessionDrawer() {
            const [isOpen, setIsOpen] = We(false);
            const [filterText, setFilterText] = We("");
            const [curIdx, setCurIdx] = We(0);
            const lastMousePos = mt({ x: -1, y: -1 });

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

            // セッション一覧のフィルタ＆ソート
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
                    } catch (_e) {}
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
                                        className: "font-medium text-foreground truncate max-w-[200px] sm:max-w-[280px]",
                                        title: curSessionName,
                                        children: curSessionName
                                    }),
                                    isCurrentPinned && E($e, {
                                        name: "keep",
                                        size: 13,
                                        className: "text-amber-500 shrink-0",
                                        title: "現在のセッションはピン留めされています"
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
                                        title: "ダイアログで表示",
                                        onClick: () => showPastConversationsPicker(),
                                        children: [
                                            E($e, { name: "open_in_new", size: 13 })
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
                                                            ? E("div", {
                                                                className: "flex items-center gap-1 shrink-0",
                                                                children: [
                                                                    E("span", {
                                                                        className: "w-3 h-3 rounded-full border border-primary flex items-center justify-center shrink-0",
                                                                        children: E("span", { className: "w-1.5 h-1.5 rounded-full bg-primary" })
                                                                    }),
                                                                    isPinned && E($e, { name: "keep", size: 11, className: "text-amber-500 shrink-0" })
                                                                ]
                                                            })
                                                            : isPinned
                                                                ? E($e, { name: "keep", size: 12, className: "text-amber-500 shrink-0" })
                                                                : E($e, { name: "chat_bubble", size: 12, className: "text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100" }),
                                                        E("span", { className: "truncate", title: title, children: title }),
                                                        isActive && E("span", {
                                                            className: "text-[10px] px-1 py-0.2 rounded bg-primary/20 text-primary font-normal shrink-0",
                                                            children: "現在"
                                                        })
                                                    ]
                                                }),

                                                // 右側: ピン操作 + 経過時間 + 削除ボタン
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
                            })
                        ]
                    })
                ]
            });
        };
    };

    // グローバルオブジェクトにエクスポート
    global.__AGY_SESSION_PATCH__ = patch;

})(typeof window !== 'undefined' ? window : globalThis);
