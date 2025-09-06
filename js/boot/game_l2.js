// js/boot/game_l2.js （第 2 關：grid）
window.MULTI_PAGE_MODE = true;

window.addEventListener('DOMContentLoaded', () => {
  Core.setModeHooks(ModeGrid);   // ✅ grid 模式
  Core.init({ level: 2 });       // ✅ 啟動
  window.game = Core;            // ✅ 掛全域（保險）

  // —— 保險絲：在「空白鍵掃描期間」禁止攻擊 —— //
  (function () {
    let spaceScanGuard = false;
    const origAttack = Core.attack?.bind(Core);
    Core.attack = function (...args) {
      if (spaceScanGuard) return;
      return origAttack?.(...args);
    };
    const onKeyDown = (e) => {
      if ((e.code === 'Space' || e.key === ' ') && !e.repeat) {
        spaceScanGuard = true;
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        spaceScanGuard = false;
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true, passive: false });
    window.addEventListener('keyup',   onKeyUp,   { capture: true, passive: false });
    const SAFE_TIMEOUT_MS = 300;
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Space' || e.key === ' ') && !e.repeat) {
        setTimeout(() => { spaceScanGuard = false; }, SAFE_TIMEOUT_MS);
      }
    }, { capture: true, passive: false });
  })();

  // 👉 綁輸入（用 adapter 把 Core 接到動作層；不啟用舊鍵盤）
  window.bindInputs?.(Core, { grid: 1 });

  // 👉 鎖 k1/k2/k3（第 5 關才可用；這關=2 → 先鎖）
  window.syncVoteChoicesLock?.(2);

  // 👉 Space 只報座標，交給 keys.js 管
  window.scanArea = () => Core.announceCoords?.();
  window.Keys?.init?.({
    stageSelector: '#gameArea',
    scanFn: () => Core.announceCoords?.(),
    activeGuardFn: () => true
  });

  // ★ 補發一次 game-ready（給晚掛監聽的人接）
  setTimeout(() => {
    try {
      document.dispatchEvent(new CustomEvent('game-ready', { detail: { game: Core, by: 'boot' } }));
    } catch (_) {}
  }, 0);
});
