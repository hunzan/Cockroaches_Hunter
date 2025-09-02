// js/core/keys.js
;(function(){
  if (window.Keys?.__bound) return;

  const isEditable = (el) => {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    const type = (el.type || '').toLowerCase();
    return el.isContentEditable || tag === 'input' || tag === 'textarea' || type === 'search';
  };

  const isSpaceKey = (e) => (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');

  // 以 options 控制
  let _opts = {
    stageEl: null,           // 指定舞台 DOM（建議）
    stageSelector: null,     // 或提供 CSS 選擇器（延後查找）
    scanFn: null,            // 空白鍵要做的事
    activeGuardFn: null      // return false 時停用（例如 quiz 開啟）
  };

  // 取得舞台元素（允許延後才存在）
  function getStageEl(){
    if (_opts.stageEl) return _opts.stageEl;
    if (_opts.stageSelector) {
      _opts.stageEl = document.querySelector(_opts.stageSelector) || null;
      return _opts.stageEl;
    }
    // 預設相容：找 #gameArea
    _opts.stageEl = document.getElementById('gameArea') || null;
    return _opts.stageEl;
  }

  // 焦點是否在舞台內（包含其子孫）
  function isOnStage(){
    const st = getStageEl();
    if (!st) return false;
    const a = document.activeElement;
    return a === st || st.contains(a);
  }

  function init(opts = {}){
    // 合併參數
    _opts = Object.assign({}, _opts, opts);

    const scanFn = (typeof _opts.scanFn === 'function')
      ? _opts.scanFn
      : () => { try { window.scanArea?.(); } catch(_){} };

    const canHandle = () => {
      if (typeof _opts.activeGuardFn === 'function' && _opts.activeGuardFn() === false) return false;
      return isOnStage();
    };

    // 1) 捕獲階段 keydown：避免空白被當 click（但僅限舞台範圍）
    document.addEventListener('keydown', (e) => {
      if (isSpaceKey(e) && !isEditable(e.target) && canHandle()) {
        e.preventDefault();
      }
    }, true);

    // 2) 冒泡階段用 keyup 觸發掃描（NVDA 多半放行 keyup）
    document.addEventListener('keyup', (e) => {
      const isShiftSpace = (e.shiftKey && isSpaceKey(e));
      if (!isEditable(e.target) && canHandle() && (isSpaceKey(e) || isShiftSpace)) {
        e.preventDefault();
        scanFn();
      }
    });

    // 3) Shift+S 重唸（交給 Arbiter），同樣僅在舞台有效
    document.addEventListener('keyup', (e) => {
      if (e.shiftKey && (e.key === 'S' || e.key === 's') && canHandle()) {
        try { window.__arb?.poke(); } catch(_){}
      }
    });

    window.Keys = window.Keys || {};
    window.Keys.__bound = true;
  }

  // 允許動態更新（少用；一般只在 init 傳入即可）
  function setStageEl(el){ _opts.stageEl = el || null; }
  function setActiveGuard(fn){ _opts.activeGuardFn = fn; }

  window.Keys = Object.assign(window.Keys || {}, { init, setStageEl, setActiveGuard });
})();
