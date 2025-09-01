// js/core/mode-lane.js
(function(g){
  const Lane = {
    build(core){
      const s = core.state, area = core.dom.area;
      if (!area) return;
      // 以 levels.js 為準（若沒設就沿用預設）
      const cfg = g.getLevelCfg ? g.getLevelCfg(s.level) : null;
      if (cfg && cfg.grid && typeof cfg.grid.cols === "number") {
        s.positions = cfg.grid.cols; // 第1關通常是 7
      }

      area.style.display = "flex";
      area.innerHTML = "";

      for (let i = 0; i < s.positions; i++){
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.index = i;

        const onPlayer = (i === s.playerPos);
        const onBug    = (s.bug && i === s.bug.pos);

        // 可視化狀態（避免覆蓋）
        if (onPlayer && onBug) {
          tile.classList.add("player","bug");
          tile.textContent = "😠🪳"; // 看得出同一格
          tile.setAttribute("aria-label", `位置 ${i+1}：你與${s.bug.name}`);
        } else if (onPlayer) {
          tile.classList.add("player");
          tile.textContent = "😠";
          tile.setAttribute("aria-label", `位置 ${i+1}：你`);
        } else if (onBug) {
          tile.classList.add("bug");
          tile.textContent = "🪳";
          tile.setAttribute("aria-label", `位置 ${i+1}：${s.bug.name}`);
        } else {
          tile.setAttribute("aria-label", `位置 ${i+1}：空`);
        }

        area.appendChild(tile);
      }

      // 小小偵錯：在 Console 看看現在的狀態
      if (s.bug) {
        // console.log(`[Lane.build] playerPos=${s.playerPos}, bugPos=${s.bug.pos}, bug=${s.bug.id}`);
      } else {
        // console.log(`[Lane.build] no bug yet`);
      }
    },

    spawnPos(core){
      const s = core.state;
      const idx = Math.floor(Math.random() * (s.positions || 7));
      return idx;
    },

    sameTile(core, S, B){
      const same = (S.playerPos === B.pos);
      // console.log(`[Lane.sameTile] playerPos=${S.playerPos}, bugPos=${B.pos}, same=${same}`);
      return same;
    },

    moveBy(core, dx) {
      const s = core.state;
      if (dx < 0) s.playerPos = Math.max(0, s.playerPos - 1);
      if (dx > 0) s.playerPos = Math.min((s.positions || 7) - 1, s.playerPos + 1);

      // ★ 播放 Lane 模式移動音效
      if (s.level) {
        const lv = s.level;
        const audio = new Audio(`assets/sounds/move_0${lv}.mp3`);
        audio.volume = 0.6;
        audio.play().catch(()=>{});
      }
    }
  };

  g.ModeLane = Lane;
})(window);
