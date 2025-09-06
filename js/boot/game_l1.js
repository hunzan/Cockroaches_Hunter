// game_l1.js
window.MULTI_PAGE_MODE = true;

window.addEventListener("DOMContentLoaded", () => {
  Core.setModeHooks(ModeLane);        // 第 1 關是單列 7 格
  Core.init({ level: 1 });            // 只做 UI/事件初始化，不生怪
  window.game = Core;            // ✅ 掛全域（保險）

    // —— 保險絲：在「空白鍵掃描期間」禁止攻擊 —— //
    (function () {
      // 1) 打一個旗標：只要 Space 正在做掃描，就擋攻擊
      let spaceScanGuard = false;

      // 2) 將 Core.attack 包一層（monkey-patch）
      const origAttack = Core.attack?.bind(Core);
      Core.attack = function (...args) {
        if (spaceScanGuard) {
          // console.warn('[guard] Space 掃描中，阻擋這次攻擊');
          return; // 直接忽略本次攻擊
        }
        return origAttack?.(...args);
      };

      // 3) 在捕獲階段攔 Space：按下就開啟保險絲，放開再關閉
      const onKeyDown = (e) => {
        if ((e.code === 'Space' || e.key === ' ') && !e.repeat) {
          spaceScanGuard = true;             // ⬅️ 這一瞬間禁止攻擊
        }
      };
      const onKeyUp = (e) => {
        if (e.code === 'Space' || e.key === ' ') {
          // KeyUp 才讓 keys.js 去做 scanFn() 報座標；然後關掉保險絲
          // （keys.js 本來就用 keyup 觸發掃描）
          spaceScanGuard = false;
        }
      };
      window.addEventListener('keydown', onKeyDown, { capture: true, passive: false });
      window.addEventListener('keyup', onKeyUp, { capture: true, passive: false });

      // 4) 保險：就算 keyup 沒被觸發（例如視窗切換），最慢 300ms 自動解除
      //    這樣不會把攻擊永遠鎖死
      const SAFE_TIMEOUT_MS = 300;
      window.addEventListener('keydown', (e) => {
        if ((e.code === 'Space' || e.key === ' ') && !e.repeat) {
          setTimeout(() => { spaceScanGuard = false; }, SAFE_TIMEOUT_MS);
        }
      }, { capture: true, passive: false });
    })();

      // 只報座標，不做攻擊、不播 miss
    window.scanArea = () => Core.announceCoords?.();

    // 啟用 keys.js（用它管理 Space），並指定掃描行為
    window.Keys?.init?.({
      stageSelector: '#gameArea',                // 你的舞台容器（若不同，填你的 id）
      scanFn: () => Core.announceCoords?.(),     // 明定：Space → 只報座標
      activeGuardFn: () => true                  // 有需要再換成你的條件
    });

        // 👉 ① 綁輸入（用 adapter 把 Core 接到動作層；不啟用舊鍵盤）
      window.bindInputs?.(Core, { grid: 1 });

      // 👉 ② 鎖 k1/k2/k3（第 5 關才可用；這關=1 → 先鎖）
      window.syncVoteChoicesLock?.(1);

  // 用 IIFE 來等待語音
  (async () => {
    const cfg = getLevelCfg(1);

    // 組一下目標字串
    const nameOf = id => ((window.bugs||[]).find(b=>b.id===id)?.name || id);
    const T = cfg.targets || {};
    const entries = Object.entries(T);
    const targetStr = entries.length
      ? "有怪聲音。破關目標：" + entries.map(([id,n]) => `${nameOf(id)} ${n} 隻`).join("、")
      : "";

    // ⬇️ 等語音說完
    await Core.speakAsync(`第 1 關：${cfg.name}${targetStr}。按空白鍵掃描，Enter 攻擊。`);

    // ⬇️ 語音講完才生第一隻
    Core.spawnBug();
  })();
});
