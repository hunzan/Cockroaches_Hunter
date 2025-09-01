// js/core/mode-grid.js

// 小工具：矩形判定 & 障礙判定（供 build/moveBy 使用）
function inRect(x, y, r){
  return x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2;
}
function isBlocked(core, x, y){
  const obs = core.cfg?.obstacles || [];
  return obs.some(r => inRect(x, y, r));
}

// 回傳目前所撞到的「障礙區域 id」；用於防連續撞的累計
function regionIdFor(core, x, y){
  const obs = core.cfg?.obstacles || [];
  for (let i=0; i<obs.length; i++){
    if (inRect(x,y,obs[i])) return `obs:${i}`;
  }
  return null;
}

(function (g) {
  const Grid = {
    build(core) {
      const s = core.state;
      const area = core.dom.area;
      if (!area) return;

      // 以 levels.js 的 grid 為準（保險）
      const cfg = g.getLevelCfg ? g.getLevelCfg(s.level) : null;
      if (cfg && cfg.grid && typeof cfg.grid.cols === "number") {
        s.grid = { cols: cfg.grid.cols, rows: cfg.grid.rows };
      }
      const { cols, rows } = s.grid;

      // 佈局：CSS Grid
      area.style.display = "grid";
      area.style.gridTemplateColumns = `repeat(${cols}, 50px)`;
      area.style.gridTemplateRows = `repeat(${rows}, 50px)`;
      area.style.gap = "6px";
      area.innerHTML = "";

      const obs = core.cfg?.obstacles || [];
      const cart = (s.hazards || []).find(h => h.type === "cart" && h.alive);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const t = document.createElement("div");
          t.className = "tile";
          t.dataset.x = x;
          t.dataset.y = y;

          const onPlayer = (s.gridPos.x === x && s.gridPos.y === y);
          const onBug = (s.bug && s.bug.pos && s.bug.pos.x === x && s.bug.pos.y === y);
          const hasSoap = (s.hazards || []).some(h => h.type === "soap" && h.alive && h.x === x && h.y === y);

          let aria = `第 ${y + 1} 行，第 ${x + 1} 列`;

          // 玩家 / 蟑螂
          if (onPlayer && onBug) {
            t.classList.add("player", "bug");
            t.textContent = "😠🪳";
            aria += `：你與 ${s.bug.name}`;
          } else if (onPlayer) {
            t.classList.add("player");
            t.textContent = "😠";
            aria += "：你";
          } else if (onBug) {
            t.classList.add("bug");
            t.textContent = "🪳";
            aria += `：${s.bug.name}`;
          }

          // 家具（以 obstacles 的 label 判斷 sofa/table/tv；供渲染層蓋 PNG）
          const hitObs = obs.find(r => inRect(x,y,r));
          if (hitObs) {
            t.classList.add("obstacle");
            if (hitObs.label) t.dataset.furniture = hitObs.label; // 'sofa' | 'table' | 'tv'

            // 文字備援（無圖時至少看得到）
            if (!t.textContent) {
              const lab = hitObs.label;
              t.textContent = lab === 'sofa' ? '🛋️' : (lab === 'tv' ? '📺' : '🍽️');
            }
            const zh = hitObs.label === 'sofa' ? '沙發' : (hitObs.label === 'tv' ? '電視' : '餐桌');
            aria += `，家具（${zh}），無法通過`;
          }

          // 肥皂（僅標示）
          if (hasSoap) {
            t.classList.add("hazard");
            if (!t.textContent) t.textContent = "🧼";
            aria += "，地上有肥皂";
          }

          // 菜籃車
          if (cart && cart.x === x && cart.y === y) {
            t.classList.add("hazard-cart");
            if (!t.textContent) t.textContent = "🛒";
            aria += "，菜籃車通過中";
          }

          t.setAttribute("aria-label", aria);
          area.appendChild(t);
        }
      }
            // ★★★ 所有 tile 都建好後再蓋家具（全域版＋防呆）
      if (typeof window.renderFurniture === "function") {
        window.renderFurniture(area, core); // 參數順序：area, core
      }
    },

    spawnPos(core) {
      const { cols, rows } = core.state.grid;
      return {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
    },

    sameTile(core, S, B) {
      return !!(B && B.pos && S.gridPos.x === B.pos.x && S.gridPos.y === B.pos.y);
    },

    moveBy(core, dx, dy) {
      const s = core.state;
      const { cols, rows } = s.grid;

      const nx = Math.max(0, Math.min(cols - 1, s.gridPos.x + dx));
      const ny = Math.max(0, Math.min(rows - 1, s.gridPos.y + dy));

      // 只看家具障礙
      const willBlock = (typeof core.isBlockedCell === 'function')
        ? core.isBlockedCell(nx, ny)
        : isBlocked(core, nx, ny);

      if (willBlock) {
        core.sfx?.('warn');
        core.speak?.('前方有家具，無法通過。');

        // 以「區域」為單位累積撞牆（防連續撞一直扣）
        const regionKey = (typeof regionIdFor === 'function') ? (regionIdFor(core, nx, ny) || 'unknown') : `${nx},${ny}`;
        s._bumpByRegion = s._bumpByRegion || {};
        s._bumpByRegion[regionKey] = (s._bumpByRegion[regionKey] || 0) + 1;

        if (s._bumpByRegion[regionKey] >= 2) {
          s._bumpByRegion[regionKey] = 0;
          const hpLoss = 1, coinLoss = 1;
          s.player.hp = Math.max(0, (s.player.hp || 0) - hpLoss);
          s.player.coins = Math.max(0, (s.player.coins || 0) - coinLoss);
          core.updateUI();
          core.speak?.('硬撞家具！扣血一、扣金幣一。');
        }

        core.build();
        return; // 不移動
      }

      // 2) 菜籃車阻擋（不能走進去）
      const cart = (s.hazards || []).find(h => h.type === 'cart' && h.alive && h.x === nx && h.y === ny);
      if (cart) {
        core.sfx?.('warn');
        core.speak?.('小心菜籃車！');
        return;
      }

      // 更新玩家位置
      s.gridPos.x = nx;
      s.gridPos.y = ny;

      // 3) 肥皂陷阱（延遲滑倒）
      const soap = (s.hazards || []).find(h => h.type === "soap" && h.alive && h.x === s.gridPos.x && h.y === s.gridPos.y);
      if (soap && core._soapCfg) {
        core.sfx('warn');
        core.speak('地上有肥皂！');

        if (soap._armTimer) { clearTimeout(soap._armTimer); soap._armTimer = null; }

        soap._armTimer = setTimeout(() => {
          const stillOn = (s.gridPos.x === soap.x && s.gridPos.y === soap.y) && soap.alive;
          if (!stillOn) return;

          core.sfx('slip');
          const loss = core._soapCfg.hpLoss ?? 3;
          s.player.hp = Math.max(0, (s.player.hp || 0) - loss);
          core.speak(`滑倒！扣血 ${loss}。`);
          core.updateUI();

          soap.alive = false;
          core.build();

          const respawn = core._soapCfg.respawnMs ?? 6000;
          if (soap._respawnTimer) { clearTimeout(soap._respawnTimer); soap._respawnTimer = null; }
          soap._respawnTimer = setTimeout(() => {
            const pos = (typeof core._randFreePos === 'function')
              ? core._randFreePos()
              : { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };

            soap.x = pos.x;
            soap.y = pos.y;
            soap.alive = true;
            core.build();
          }, respawn);
        }, core._soapCfg.armTimeMs ?? 2000);
      }
            // ★★★ 成功移動才播放（放在 build() 之前）
      if (core.state?.level) {
        const lv = core.state.level;
        try {
          const audio = new Audio(`assets/sounds/move_0${lv}.mp3`);
          audio.volume = 0.6;           // 可自行調整
          audio.play().catch(()=>{});
        } catch (_) {}
      }

      core.build();
    },
  };

  // 對外暴露
  g.ModeGrid = Grid;

  // ★ 若 Core 在我們之後載入也能自動掛上 hooks（grid 關卡）
  if (g.Core && typeof g.Core.init === 'function') {
    const origInit = g.Core.init.bind(g.Core);
    g.Core.init = function patchedInit(opts){
      try {
        const nextLevel = opts?.level ?? this.state?.level;
        const cfg = (typeof g.getLevelCfg === 'function') ? g.getLevelCfg(nextLevel) : null;
        const mode = cfg?.mode || this.state?.mode;
        if (mode === 'grid') this.setModeHooks(Grid);
      } catch (_) { /* 靜默即可 */ }
      return origInit(opts);
    };
  }
})(window);
