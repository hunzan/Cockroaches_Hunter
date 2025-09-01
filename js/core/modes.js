// js/core/modes.js
(function (w) {
  const KEY = 'gameMode'; // 'audio' | 'visual'
  function getQueryMode() {
    const m = new URLSearchParams(location.search).get('mode');
    return (m === 'audio' || m === 'visual') ? m : null;
  }
  function getMode() {
    return getQueryMode() || localStorage.getItem(KEY) || 'visual';
  }
  function setMode(mode) {
    const v = (mode === 'audio') ? 'audio' : 'visual';
    localStorage.setItem(KEY, v);
    applyModeToDocument(v);
  }
  function applyModeToDocument(mode) {
    const v = (mode === 'audio') ? 'audio' : 'visual';
    document.documentElement.setAttribute('data-mode', v);
    // 友善朗讀
    try {
      if ('speechSynthesis' in w) {
        const u = new SpeechSynthesisUtterance(
          v === 'audio' ? '已切換到純聽覺模式' : '已切換到顯示畫面模式'
        );
        u.lang = 'zh-TW'; u.rate = 1.5;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      }
      const sr = document.getElementById('srStatus');
      if (sr) sr.textContent = (v === 'audio') ? '純聽覺模式' : '顯示畫面模式';
    } catch (_){}
  }
  function applyModeOnLoad() {
    applyModeToDocument(getMode());
  }
  // 關卡內快速切換（Shift+M）
  function bindQuickToggle() {
    window.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        const cur = getMode();
        setMode(cur === 'audio' ? 'visual' : 'audio');
        e.preventDefault();
      }
    }, { passive:false });
  }

  w.Modes = { getMode, setMode, applyModeOnLoad, bindQuickToggle };
})(window);
