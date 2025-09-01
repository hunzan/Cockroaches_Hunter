// SpawnConductor v1.0 — 擊殺後先念狀態，再生怪（跨關卡共用）
// 用法：const sc = SpawnConductor.install({ ...options });
// 依賴（可選）：A11YArbiter（若存在則用 sc.options.arbPoke() 促發合併朗讀）

;(function (global) {
  "use strict";

  const DEFAULTS = {
    // 朗讀完成判斷
    srEl:        null,     // e.g. document.getElementById('srStatus')（建議提供，否則以 TTS 靜音為準）
    waitTimeout: 2200,     // 最長等待「狀態朗讀完成」的時間 (ms)
    quietNeed:   300,      // 需要連續安靜多久才算朗讀完成 (ms)
    poll:        60,       // 輪詢間隔 (ms)

    // 觸發合併朗讀（若用 A11YArbiter）
    arbPoke:     () => { try { global.__arb?.poke(); } catch(_){} },

    // TTS 忙碌判斷：預設同時看 Core 與 speechSynthesis
    ttsBusyFn: () => {
      try {
        const coreBusy  = !!(global.Core && typeof Core._speechDepth === 'number' && Core._speechDepth > 0);
        const synthBusy = !!(global.speechSynthesis && speechSynthesis.speaking);
        return coreBusy || synthBusy;
      } catch(_) { return false; }
    }
  };

  function install(opts) {
    const cfg = Object.assign({}, DEFAULTS, opts || {});
    const sr  = cfg.srEl;

    // ---- 1) 包裝 Core.spawnBug：支援 pause / resume / 隊列只保留最新 ----
    const C = global.Core;
    if (!C || typeof C.spawnBug !== 'function')
      throw new Error('[SpawnConductor] 找不到 Core.spawnBug()');

    if (C.__spawnConductorPatched)
      return C.__spawnConductorAPI; // 已安裝過，直接回傳 API

    const origSpawn = C.spawnBug.bind(C);
    const queue = [];
    let paused = false;

    C.pauseSpawns  = () => { paused = true; };
    C.resumeSpawns = () => {
      paused = false;
      const job = queue.shift();
      if (job) job(); // 只補一次，避免爆量
    };

    C.spawnBug = function () {
      if (paused) {
        queue.length = 0;       // 只保留最新一個請求
        queue.push(() => origSpawn());
        return;
      }
      return origSpawn();
    };

    // ---- 2) 等待「狀態朗讀完成」的工具 ----
    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    async function waitStatusDone() {
      const { waitTimeout, quietNeed, poll } = cfg;
      let mo = null, sawMutation = false, quietStart = 0;

      if (sr && typeof MutationObserver !== 'undefined') {
        mo = new MutationObserver(() => { sawMutation = true; });
        try { mo.observe(sr, { childList:true, characterData:true, subtree:true }); } catch(_) {}
      }

      const t0 = Date.now();
      while (Date.now() - t0 < waitTimeout) {
        // 若有 sr 變動，且 TTS 一直安靜達 quietNeed，就認定完成
        if (!cfg.ttsBusyFn()) {
          if (sawMutation || !sr) {               // 有 sr 變動 或 未提供 sr（則只看安靜）
            if (!quietStart) quietStart = Date.now();
            if (Date.now() - quietStart >= quietNeed) {
              try { mo?.disconnect(); } catch(_){}
              return true;
            }
          }
        } else {
          quietStart = 0; // 忙了就重算
        }
        await wait(poll);
      }
      try { mo?.disconnect(); } catch(_){}
      return false; // 超時也當完成，避免卡關
    }

    // ---- 3) 公用 API：擊殺後的硬序流程 ----
    async function afterKillThenSpawn() {
      try {
        // 先促發合併朗讀（若用 A11YArbiter）
        cfg.arbPoke?.();

        // 暫停出怪
        C.pauseSpawns?.();

        // 等「狀態朗讀完成」或超時
        await waitStatusDone();

        // 恢復並補出一隻
        C.resumeSpawns?.();
        C.spawnBug?.();
      } catch (e) {
        // 防守：任何錯誤都解除暫停
        try { C.resumeSpawns?.(); } catch(_){}
        // console.warn('[SpawnConductor] afterKillThenSpawn error:', e);
      }
    }

    // ---- 4) 事件橋接：全域 bug-killed → 執行硬序 ----
    global.addEventListener?.('bug-killed', () => afterKillThenSpawn());

    // ---- 5) 導出 API ----
    const api = {
      afterKillThenSpawn,
      pause:  () => C.pauseSpawns?.(),
      resume: () => C.resumeSpawns?.(),
      isPaused: () => paused,
      config: cfg
    };
    C.__spawnConductorPatched = true;
    C.__spawnConductorAPI = api;
    return api;
  }

  global.SpawnConductor = { install };
})(window);
