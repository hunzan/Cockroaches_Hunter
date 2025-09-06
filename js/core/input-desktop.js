// js/core/input-desktop.js
import { bindAction } from './input-adapter.js';

/**
 * 掛上桌機鍵盤對應：
 * Space → announceCoords（只報蟑螂座標）
 * Enter/KeyF → attack（真正攻擊，才會觸發 hit/miss）
 * KeyV → openVote（有 gating，內部會擋 1~4 關）
 * Shift+KeyS → announcePlayerStatus（維持你原有 Shift+S 行為）
 */
export function mountDesktopKeymap(root = document){
  const handler = (ev)=>{
    if (ev.repeat) return;

    // 統一在這裡擋掉可能引發捲動的鍵
    const block = ()=>{ ev.preventDefault(); ev.stopPropagation(); };

    // 修：空白鍵只報座標，不呼叫攻擊邏輯
    if (ev.code === 'Space'){
      block();
      bindAction?.('announceCoords');
      return;
    }

    // 攻擊鍵（兩個擇一皆可，保留 Enter 與 KeyF 兼容）
    if (ev.code === 'Enter' || ev.code === 'KeyF'){
      block();
      bindAction?.('attack');
      return;
    }

    // 連署（vote）：在 core 會檢查第 5 關才開
    if (ev.code === 'KeyV'){
      block();
      bindAction?.('openVote');
      return;
    }

    // Shift + S：讀取玩家狀態
    if (ev.code === 'KeyS' && ev.shiftKey){
      block();
      bindAction?.('announcePlayerStatus');
      return;
    }

    // 其他鍵（方向、切換武器…）可視你的現有邏輯補上
    // 例：方向鍵交給 action 層（若你有網格位移）
    switch (ev.code){
      case 'ArrowUp':    block(); bindAction?.('move', {dx:0, dy:-1}); break;
      case 'ArrowDown':  block(); bindAction?.('move', {dx:0, dy: 1}); break;
      case 'ArrowLeft':  block(); bindAction?.('move', {dx:-1,dy: 0}); break;
      case 'ArrowRight': block(); bindAction?.('move', {dx: 1,dy: 0}); break;
      default: break;
    }
  };

  root.addEventListener('keydown', handler);
  return ()=> root.removeEventListener('keydown', handler);
}
