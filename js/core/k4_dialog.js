/* =============================================
 * js/core/k4_dialog.js — L4/L5 compatible (fixed)
 *  - Esc 放棄：不扣血、不判失敗；延遲恢復計時
 *  - 全鍵盤可用：初始焦點、Tab 循環、Enter/Esc 在對話層攔下
 *  - Works with various quiz global names
 *  - Exports bindK4Trigger(game), bindQuizHandlers(game)
 * ============================================= */
(function (w) {
  // —— 全域別名：找得到就用 —— //
  const QUIZ =
    w.quiz || w.QUIZ || w.Quiz || w.k4Quiz || w.L4Quiz || null;

  // 取用遊戲實例
  const getGame = () => w.game;

  // 是否為 K4 且尚未問過
  function isK4NotAsked(G = getGame()) {
    const b = G?.state?.bug;
    const ok = !!(b && b.id === 'k4' && !b._quizAsked);
    if (!ok) return false;
    // ✅ 需要 Core 回報尚未達題數上限
    if (G && typeof G.k4CanAskMore === 'function') {
      return G.k4CanAskMore(G.state?.level);
    }
    return true;
  }

  // ====== 題庫整合：取得題庫 & 挑一題不重複 ======
  function getAnyQuestionPool(quizLib) {
    // 優先使用 quizLib 提供的池
    if (quizLib?.getPool && typeof quizLib.getPool === 'function') {
      try { const p = quizLib.getPool(); if (Array.isArray(p) && p.length) return p; } catch(_) {}
    }
    if (Array.isArray(quizLib?.pool) && quizLib.pool.length) return quizLib.pool;

    // 退回全域常用名稱
    const cand = w.K4_QUESTION_POOL || w.QUESTION_POOL || w.QUIZ_POOL;
    if (Array.isArray(cand) && cand.length) return cand;

    // 最後一招：請外部監聽者提供
    const ev = new CustomEvent('k4:request-pool', { detail: { pool: null }, bubbles:false, cancelable:false });
    try { document.dispatchEvent(ev); } catch(_){}
    if (Array.isArray(ev.detail?.pool) && ev.detail.pool.length) return ev.detail.pool;

    return []; // 找不到就回空陣列
  }

  function pickUniqueK4Question(quizLib) {
    const pool = getAnyQuestionPool(quizLib);
    if (!Array.isArray(pool) || pool.length === 0) return null;
    if (!w.game || typeof w.game._pickUniqueQuestion !== 'function') {
      // 走對外 API 包裝
      if (typeof w.pickK4Question === 'function') return w.pickK4Question(pool);
      // 沒有 Core 的不重複機制時，退回隨機（不建議，但不卡死）
      return pool[Math.floor(Math.random() * pool.length)];
    }
    // 直接用 Core 的共用機制
    return w.game._pickUniqueQuestion(pool, { prefix:'k4' });
  }

  function markK4Used(q) {
    if (!q) return;
    if (w.game && typeof w.game._markQuestionUsed === 'function') {
      w.game._markQuestionUsed('k4', q);
    } else if (typeof w.markK4Used === 'function') {
      w.markK4Used(q);
    }
  }

  // ====== 對話：是否接受挑戰 ======
  function showK4ChoiceDialog({
    container = document.body,
    enableTTS = false,
    ttsText = '軍師蟑到爆下戰帖！按 Enter 接受挑戰，Esc 拒絕。'
  } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.setAttribute('role', 'alertdialog');
      overlay.setAttribute('aria-modal', 'true');
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,.55)',
        zIndex: '9998',
      });

      try { document.body.inert = true; } catch(_) {}

      const panel = document.createElement('div');
      Object.assign(panel.style, {
        minWidth: 'min(90vw,480px)',
        maxWidth: '90vw',
        background: '#0f1115',
        color: '#fff',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
        padding: '22px',
      });

      const live = document.createElement('div');
      live.setAttribute('aria-live', 'assertive');
      live.setAttribute('aria-atomic', 'true');
      live.style.position = 'absolute';
      live.style.left = '-9999px';

      const h2 = document.createElement('h2');
      h2.id = 'k4DialogTitle';
      h2.textContent = '軍師蟑到爆下戰帖！';

      const p = document.createElement('p');
      p.id = 'k4DialogDesc';
      p.textContent = '是否接受挑戰？（Enter 接受 / Esc 放棄）';

      panel.setAttribute('aria-labelledby', 'k4DialogTitle');
      panel.setAttribute('aria-describedby', 'k4DialogDesc');

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '12px';

      const ok = document.createElement('button');
      ok.type = 'button';
      ok.textContent = '接受挑戰（Enter）';

      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '放棄（Esc）';

      const styleBtn = (b, primary) => {
        b.style.padding = '12px 14px';
        b.style.borderRadius = '12px';
        b.style.cursor = 'pointer';
        if (primary) {
          b.style.border = '0';
          b.style.background = '#22c55e';
          b.style.color = '#0b1117';
          b.style.fontWeight = '700';
        } else {
          b.style.border = '1px solid #2a2a2a';
          b.style.background = '#151922';
          b.style.color = '#fff';
        }
      };
      styleBtn(ok, true);
      styleBtn(cancel, false);

      row.append(ok, cancel);
      panel.append(live, h2, p, row);
      overlay.append(panel);
      container.append(overlay);

      ok.tabIndex = 0;
      cancel.tabIndex = 0;
      ok.focus({ preventScroll: true });

      // 通知開啟（同步旗標 + 暫停）
      w.__k4Open = true;
      try { document.dispatchEvent(new CustomEvent('k4:open')); } catch (_) {}

      // aria-live 提示
      live.textContent = '軍師蟑到爆出現，按 Enter 開始答題或 Esc 放棄。';

      const finish = (val) => {
        w.removeEventListener('keydown', onKey, true);
        // 移焦避免 aria-hidden 警告
        document.getElementById('srStatus')?.focus?.();
        overlay.remove();
        try { document.body.inert = false; } catch(_) {}

        // 通知關閉（旗標稍後由外層統一關）
        try { document.dispatchEvent(new CustomEvent('k4:close')); } catch (_) {}
        resolve(val);
      };

      ok.onclick = () => finish('quiz');
      cancel.onclick = () => finish('cancel');

      const onKey = (e) => {
        // 對話開啟期間，關鍵鍵在此被處理並阻止冒泡
        if (e.code === 'Enter') {
          e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
          ok.click();
          return;
        }
        if (e.code === 'Escape') {
          e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
          cancel.click();
          return;
        }
        // Space：若焦點在按鈕上，允許原生行為（啟動按鈕）
        if (e.code === 'Space') {
          // 讓 button 的原生 Space 觸發 click，但避免傳到遊戲層
          if (document.activeElement === ok || document.activeElement === cancel) {
            e.stopImmediatePropagation(); e.stopPropagation();
          }
          return;
        }
        // 確保 Tab 在兩顆按鈕之間循環（簡易 focus trap）
        if (e.code === 'Tab') {
          const focusables = [ok, cancel];
          const idx = focusables.indexOf(document.activeElement);
          const next = (idx + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
          focusables[next].focus();
          e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
        }
      };

      // 用捕獲階段綁定，確保優先攔下
      w.addEventListener('keydown', onKey, true);

      if (enableTTS && 'speechSynthesis' in w) {
        try {
          const u = new SpeechSynthesisUtterance(ttsText);
          const zh = (speechSynthesis.getVoices() || [])
            .find(v => (v.lang || '').toLowerCase().startsWith('zh'));
          if (zh) u.voice = zh;
          u.lang = zh?.lang || 'zh-TW';
          speechSynthesis.cancel();
          speechSynthesis.speak(u);
        } catch (_) {}
      }
    });
  }

  // 接管一次完整 K4 流程（暫停 → 詢問 → 出題 → 恢復）
  async function handleK4Encounter({
    quizLib = QUIZ,
    game = getGame(),
    container = document.body,
  }) {
    const G = game;
    if (!G) return { action: 'cancel' };

    // 暫停
    try { G.pauseTimer?.(); } catch (_) {}

    // >>> 進入對話前：若已達本關上限，直接當作拒絕，不再出題
    try {
      if (G && typeof G.k4CanAskMore === 'function' && !G.k4CanAskMore(G.state?.level)) {
        // 標記本隻 K4 已拒絕，讓玩家可用毒餌或直接攻擊（你現有邏輯）
        if (G?.state?.bug?.id === 'k4') G.state.bug._quizDeclined = true;
        try { G.resumeTimer?.(); } catch(_) {}
        return { action: 'cancel' };
      }
    } catch (_) {}

    // 是否接受挑戰
    const action = await showK4ChoiceDialog({ container, enableTTS: true });

    if (action !== 'quiz') {
      // 玩家選擇放棄：不視為失敗，不扣血，可在時間內再找牠用毒餌
      try {
        if (G?.state?.bug?.id === 'k4') G.state.bug._quizDeclined = true;
        // ✅ 播放語音提示
        if (typeof window.speak === 'function') {
          window.speak('已放棄挑戰');
        } else if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance('已放棄挑戰');
          const zh = (speechSynthesis.getVoices() || []).find(v => (v.lang || '').toLowerCase().startsWith('zh'));
          if (zh) u.voice = zh;
          u.lang = zh?.lang || 'zh-TW';
          speechSynthesis.cancel();
          speechSynthesis.speak(u);
        }

        // 直接恢復計時
        setTimeout(() => { try { G.resumeTimer?.(); } catch(_) {} }, 0);

        document.dispatchEvent(new CustomEvent('k4:declined', { detail: { level: G.state?.level }}));
      } catch(_) {}

      return { action: 'cancel' };
    }

    // ✅ 真的要進入作答 → 先記數
    try { G.k4MarkAsked?.(G.state?.level); } catch(_) {}

    // 出題
    if ('speechSynthesis' in w) {
      try { speechSynthesis.cancel(); } catch (_) {}
    }
    if (!quizLib || !quizLib.ask) {
      console.error('[k4] quiz library missing or invalid');
      try { G.resumeTimer?.(); } catch (_) {}
      return { action: 'cancel' };
    }

    // 先挑一題「不重覆」的題目
    const q = pickUniqueK4Question(quizLib);

    // 嘗試把「指定題目」傳給題庫；盡量相容不同實作
    let result;
    try {
      if (q) {
        result = await quizLib.ask({
          container,
          randomize: true,
          timeLimitSec: 60,
          presetQuestion: q,
          question: q,
          fixedQuestion: q,
        });
      } else {
        result = await quizLib.ask({
          container,
          randomize: true,
          timeLimitSec: 60,
        });
      }
    } catch (e) {
      // 題庫不支援傳入題目的話，派發事件讓題庫自行讀 q
      if (q) {
        try {
          document.dispatchEvent(new CustomEvent('k4:preset-question', { detail:{ question:q } }));
        } catch(_) {}
      }
      // 再呼叫一次不帶題目的 ask 作為 fallback
      result = await quizLib.ask({
        container,
        randomize: true,
        timeLimitSec: 60,
      });
    }

    // 作答完就標記「已使用」，不管對錯；確保下次不會抽到同題
    try { if (q) markK4Used(q); } catch(_) {}

    // 恢復（真正的結算會在外層 resolve 後再看情況處理）
    try { G.resumeTimer?.(); } catch (_) {}

    return { action: 'quiz', quizResult: result };
  }

  // 防重入開窗（全域單例）
  w.openK4QuizNow = async function ({ quiz, pauseTimer, resumeTimer, container = document.body, game = getGame() }) {
    if (w.__k4Open) return;
    w.__k4Open = true;
    try {
      // 優先用參數 quiz，其次 QUIZ
      const quizLib = quiz || QUIZ;
      const outcome = await handleK4Encounter({ quizLib, game, container });
      return outcome;
    } finally {
      // 稍後關旗標，避免連點
      setTimeout(() => { w.__k4Open = false; }, 600);
    }
  };

  // 主開窗：做一次並結算
  async function doK4Dialog(game) {
    const G = game || getGame();
    if (!G) return;

    if (!isK4NotAsked(G)) return;
    // 標記避免重複開
    try { if (G.state?.bug?.id === 'k4') G.state.bug._quizAsked = true; } catch (_) {}

    // 交給 openK4QuizNow（會處理暫停/詢問/出題/恢復）
    const outcome = await w.openK4QuizNow({ container: document.body, game: G });

    if (!outcome || outcome.action !== 'quiz') {
      // 關閉或放棄：不重問
      return;
    }

    const r = outcome.quizResult;
    try {
      await G.resolveQuizOutcome?.(r); // 正式結算
    } catch (e) {
      console.error('[k4] resolveQuizOutcome 失敗：', e);
    }

    // 若答錯蟑螂仍在場，保險恢復一次（通常 handleK4Encounter 已恢復）
    try { if (G.state?.bug) G.resumeTimer?.(); } catch (_) {}
  }

  // ===== Public API（給 L4/L5 呼叫） =====
  function bindK4ForGame(game) {
    const G = game || getGame();
    if (!G) return;

    // 避免重複綁定
    if (w.__k4Bound) return;
    w.__k4Bound = true;

    // 1) Enter 快捷（當前是 K4 且未出題）
    w.addEventListener('keydown', (e) => {
      if (e.code !== 'Enter') return;
      if (!isK4NotAsked(G)) return;
      e.preventDefault();
      doK4Dialog(G);
    });

    // 2) K4 出場自動彈（由 Core 發出）
    document.addEventListener('encounter-k4', () => {
      if (!isK4NotAsked(G)) return;
      doK4Dialog(G);
    });

    // 3) 輪詢保險（避免錯過事件）
    if (!w.__k4Poller) {
      w.__k4Poller = setInterval(() => {
        if (isK4NotAsked(G) && !w.__k4Open) {
          doK4Dialog(G);
        }
      }, 300);
    }
  }

  function bindQuizHandlers(game) {
    // 擴充點（需要時補）
    return;
  }

  // 導出（供 HTML glue 呼叫）
  w.bindK4Trigger = bindK4ForGame;
  w.bindQuizHandlers = bindQuizHandlers;

})(window);
