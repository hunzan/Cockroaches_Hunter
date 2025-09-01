// js/a11y/focus-hints.js
;(function (global) {
  "use strict";

  const DEFAULTS = {
    stageEl: null,            // 必填：遊戲舞台容器（可為 div 或 svg 外層）
    srEl: null,               // 可選：現有的 aria-live 容器；若未提供會自建
    roleDuringPlay: 'application', // 進入關卡時暫時套用的 role
    hintText: '提示：已進入遊戲。若使用 NVDA，請按 NVDA 加 空白 切換到焦點模式，再用方向鍵操作。',
    repeatIfNoKeyMs: 1200,    // 進場後這段時間內未收到鍵盤事件 → 再提示一次
    useSpeechSynthesis: false,// 預設 false，避免和遊戲 TTS 打架
    ttsLang: 'zh-TW',
    // 是否讀取 sessionStorage 旗標（由關卡介紹頁設定）
    readSessionFlag: 'needFocusModeHint',
    // 是否在進場時自動 focus 舞台
    autoFocusStage: true,
  };

  function install(opts) {
    const cfg = Object.assign({}, DEFAULTS, opts || {});
    if (!cfg.stageEl) throw new Error('[A11YFocusHints] 缺少 stageEl');

    // 準備 aria-live 容器（polite + atomic），避免打斷 assertive 區
    let sr = cfg.srEl;
    if (!sr) {
      sr = document.createElement('div');
      sr.className = 'sr-only';
      sr.setAttribute('role', 'status');
      sr.setAttribute('aria-live', 'polite');
      sr.setAttribute('aria-atomic', 'true');
      // 插在 body 尾端即可
      document.body.appendChild(sr);
    } else {
      sr.setAttribute('aria-live', 'polite');
      sr.setAttribute('aria-atomic', 'true');
    }

    const stage = cfg.stageEl;

    // 讀取旗標（由前一頁設定）
    let shouldHint = false;
    try {
      if (cfg.readSessionFlag && sessionStorage.getItem(cfg.readSessionFlag) === '1') {
        shouldHint = true;
        sessionStorage.removeItem(cfg.readSessionFlag);
      }
    } catch (_) {}

    // 進場：role 切成 application、可聚焦、必要時自動聚焦
    const prevRole = stage.getAttribute('role');
    const prevTab  = stage.getAttribute('tabindex');

    stage.setAttribute('role', cfg.roleDuringPlay || 'application');
    if (prevTab === null) stage.setAttribute('tabindex', '0');
    if (cfg.autoFocusStage) {
      // 先小延遲讓 DOM/樣式穩定
      setTimeout(() => stage.focus({ preventScroll: true }), 0);
    }

    // 工具：播提示（優先 aria-live；可選用 TTS）
    function announce(txt) {
      sr.textContent = '';          // 先清空，逼 SR 重新唸
      // 小延遲以確保讀屏抓到新內容
      setTimeout(() => { sr.textContent = txt; }, 20);

      if (cfg.useSpeechSynthesis && 'speechSynthesis' in global) {
        try {
          const u = new SpeechSynthesisUtterance(txt);
          u.lang = cfg.ttsLang || 'zh-TW';
          global.speechSynthesis.cancel();
          global.speechSynthesis.speak(u);
        } catch(_) {}
      }
    }

    // 只在需要時提示一次
    if (shouldHint) announce(cfg.hintText);

    // 若在 repeatIfNoKeyMs 內沒有任何鍵盤事件 → 再提示一次（避免 NVDA 還在瀏覽模式）
    let heardKey = false;
    const onKey = () => { heardKey = true; };
    window.addEventListener('keydown', onKey, { once: true, capture: true });
    const retryTimer = setTimeout(() => {
      if (!heardKey) announce(cfg.hintText);
    }, Math.max(400, cfg.repeatIfNoKeyMs|0 || 1200));

    // 對外 API：可在切關時復原 role/tabindex
    function destroy() {
      try { clearTimeout(retryTimer); } catch(_){}
      window.removeEventListener('keydown', onKey, { capture: true });
      if (prevRole === null) stage.removeAttribute('role');
      else stage.setAttribute('role', prevRole);
      if (prevTab === null) stage.removeAttribute('tabindex');
      else stage.setAttribute('tabindex', prevTab);
    }

    return { destroy, announce };
  }

  // 輸出單一命名空間
  global.A11YFocusHints = { install };
})(window);
