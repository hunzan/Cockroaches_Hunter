// js/core/keys.js
;(function(){
  if (window.Keys?.__bound) return;

  const isEditable = (el) => {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    const type = (el.type || '').toLowerCase();
    return el.isContentEditable || tag === 'input' || tag === 'textarea' || type === 'search';
  };

  function init(opts = {}){
    const scanFn = typeof opts.scanFn === 'function' ? opts.scanFn
                  : () => { try { window.scanArea?.(); } catch(_){} };

    // 1) 捕獲階段攔 keydown：避免空白被當「點擊」
    document.addEventListener('keydown', (e) => {
      const isSpace = (e.code === 'Space' || e.key === ' ');
      if (isSpace && !isEditable(e.target)) {
        e.preventDefault();
      }
    }, true);

    // 2) 冒泡階段用 keyup 觸發掃描（NVDA 多半放行 keyup）
    document.addEventListener('keyup', (e) => {
      const isSpace = (e.code === 'Space' || e.key === ' ');
      const isShiftSpace = (e.shiftKey && isSpace);
      if (!isEditable(e.target) && (isSpace || isShiftSpace)) {
        e.preventDefault();
        scanFn();
      }
    });

    // 3) Shift+S 重唸（交給 Arbiter）
    document.addEventListener('keyup', (e) => {
      if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
        try { window.__arb?.poke(); } catch(_){}
      }
    });

    window.Keys = window.Keys || {};
    window.Keys.__bound = true;
  }

  window.Keys = Object.assign(window.Keys || {}, { init });
})();
