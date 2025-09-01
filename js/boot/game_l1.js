// game_l1.js
window.MULTI_PAGE_MODE = true;

window.addEventListener("DOMContentLoaded", () => {
  Core.setModeHooks(ModeLane);        // 第 1 關是單列 7 格
  Core.init({ level: 1 });            // 只做 UI/事件初始化，不生怪

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
