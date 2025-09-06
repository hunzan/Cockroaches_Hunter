// js/core/input-adapter.js
export function bindInputs(core, opts = {}) {
  const grid = opts.grid ?? 1;
  const enableKeyboardAdapter = opts.enableKeyboardAdapter === true; // 預設不綁鍵盤

  const api = {
    move: (dx, dy) => core.moveBy?.(dx * grid, dy * grid),
    attack: () => core.attack?.(),
    announceCoords: () => core.announceCoords?.(),
    announcePlayerStatus: () => core.announcePlayerStatus?.(),
    selectWeapon: core.selectWeapon?.bind(core),
  };

  // --- 舊的鍵盤監聽（預設關閉） ---
  const onKey = (e) => {
    const k = e.key;
    if (k === 'ArrowUp')         { api.move(0, +1); e.preventDefault(); }
    else if (k === 'ArrowDown')  { api.move(0, -1); e.preventDefault(); }
    else if (k === 'ArrowLeft')  { api.move(-1, 0); e.preventDefault(); }
    else if (k === 'ArrowRight') { api.move(+1, 0); e.preventDefault(); }
    else if (k === ' ')          { api.announceCoords(); e.preventDefault(); }                 // Space → 只報座標
    else if (k === 'Enter' || k === 'F' || k === 'f') { api.attack(); e.preventDefault(); }   // Enter/F → 攻擊
    else if (k === '1') { api.selectWeapon ? api.selectWeapon('fire')    : core.selectWeapon?.('fire'); }
    else if (k === '2') { api.selectWeapon ? api.selectWeapon('spray')   : core.selectWeapon?.('spray'); }
    else if (k === '3') { api.selectWeapon ? api.selectWeapon('slipper') : core.selectWeapon?.('slipper'); }
    else if (k === '4') { core.selectWeapon?.('bait'); }
    else if (k === '5') { core.selectWeapon?.('cat'); }
    else if (k === '6' || k === '7') { core.selectWeapon?.('vote'); }
    else if ((k === 'S' || k === 's') && e.shiftKey) { api.announcePlayerStatus?.(); e.preventDefault(); }
  };

  if (enableKeyboardAdapter) {
    window.addEventListener('keydown', onKey);
  }

  // 手機手勢維持
  import('./input-mobile.js').then(({ MobileInput }) => {
    const layer = document.getElementById('gestureLayer');
    if (!layer) return;
    new MobileInput(layer, api, { swipeThreshold: 30, doubleTapWindow: 240, maxTapTravel: 14 });
  });

  return () => {
    if (enableKeyboardAdapter) {
      window.removeEventListener('keydown', onKey);
    }
  };
}

// 讓 <script type="module" src="..."> 方式也能從 window 呼叫
window.bindInputs = bindInputs;
