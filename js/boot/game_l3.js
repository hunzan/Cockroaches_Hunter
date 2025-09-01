// js/boot/game_l3.js （第 3 關：grid）
window.MULTI_PAGE_MODE = true;

window.addEventListener('DOMContentLoaded', () => {
  Core.setModeHooks(ModeGrid);   // ✅ grid 模式
  Core.init({ level: 3 });       // ✅ 啟動
  window.game = Core;            // ✅ 掛全域（保險）

  // ★ 補發一次 game-ready（給晚掛監聽的人接）
  setTimeout(() => {
    try {
      document.dispatchEvent(new CustomEvent('game-ready', { detail: { game: Core, by: 'boot' } }));
    } catch (_) {}
  }, 0);
});
