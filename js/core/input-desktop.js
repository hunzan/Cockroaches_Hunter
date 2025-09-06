// js/core/input-desktop.js
export function mountDesktopKeymap(root = document) {
  const act = (name, payload) => {
    const g = window.game || window.Core || {};
    switch (name) {
      case 'announceCoords': g.announceCoords?.(); break;
      case 'attack': g.attack?.(); break;
      case 'move': g.moveBy?.(payload?.dx || 0, payload?.dy || 0); break;
      case 'openVote':
        if (typeof window.openVote === 'function') window.openVote(g);
        else window.speak?.('第 5 關才開放連署。');
        break;
      case 'announcePlayerStatus': g.announcePlayerStatus?.(); break;
    }
  };

  const stopAll = (ev) => { ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation(); };

  const handler = (ev) => {
    if (ev.repeat) return;

    // ✳️ K4 對話開啟時，不處理任何鍵（避免 Enter/F 變攻擊）
    if (window.__k4Open) {
      return;
    }
    // 🚫 不處理 Space（交給 keys.js 的 scanFn 只報座標）
    if (ev.code === 'Enter' || ev.code === 'KeyF') { stopAll(ev); act('attack'); return; }

    switch (ev.code) {
      case 'ArrowUp':    stopAll(ev); act('move', { dx: 0,  dy: -1 }); return;
      case 'ArrowDown':  stopAll(ev); act('move', { dx: 0,  dy: +1 }); return;
      case 'ArrowLeft':  stopAll(ev); act('move', { dx: -1, dy: 0  }); return;
      case 'ArrowRight': stopAll(ev); act('move', { dx: +1, dy: 0  }); return;
      case 'KeyV':       stopAll(ev); act('openVote'); return;
      case 'KeyS':
        if (ev.shiftKey) { stopAll(ev); act('announcePlayerStatus'); return; }
        break;
      default: break;
    }
  };

  window.addEventListener('keydown', handler, { capture: true, passive: false });
  return () => window.removeEventListener('keydown', handler, { capture: true });
}
