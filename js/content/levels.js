// js/content/levels.js
(function (g) {
  // —— 全域預設 —— //
  const DEFAULTS = {
    escapeAfterMs: 15000,
    bugMoveIntervalMs: 1000,
    spawnDelayMs: 1000,
    pack: { hp: 0, coins: 0, ammo: { fire: 0, spray: 0, slipper: 0, bait: 0 } },
    grid: { cols: 3, rows: 3 },
    // 票價預設
    ticketPriceByBug: { k1: 1, k2: 2, k3: 3, k4: 5, k5: 99 },
    ticketPrice: 3
  };

  // —— 小工具：淺合併 —— //
  function makeLevel(id, cfg) {
    const out = {
      id,
      name: cfg.name,
      mode: cfg.mode || "grid",
      grid: { ...(DEFAULTS.grid), ...(cfg.grid || {}) },
      allowedBugIds: cfg.allowedBugIds || [],
      targets: cfg.targets || {},
      hazards: cfg.hazards || undefined,
      obstacles: cfg.obstacles || undefined,

      // 保留票價設定
      ticketPriceByBug: cfg.ticketPriceByBug || DEFAULTS.ticketPriceByBug,
      ticketPrice:      cfg.ticketPrice      ?? DEFAULTS.ticketPrice,

      bugMoveIntervalMs: cfg.bugMoveIntervalMs ?? DEFAULTS.bugMoveIntervalMs,
      escapeAfterMs:     cfg.escapeAfterMs     ?? DEFAULTS.escapeAfterMs,
      spawnDelayMs:      cfg.spawnDelayMs      ?? DEFAULTS.spawnDelayMs,

      pack: {
        hp:    (cfg.pack?.hp    ?? DEFAULTS.pack.hp),
        coins: (cfg.pack?.coins ?? DEFAULTS.pack.coins),
        ammo: {
          fire:    (cfg.pack?.ammo?.fire    ?? DEFAULTS.pack.ammo.fire),
          spray:   (cfg.pack?.ammo?.spray   ?? DEFAULTS.pack.ammo.spray),
          slipper: (cfg.pack?.ammo?.slipper ?? DEFAULTS.pack.ammo.slipper),
          bait:    (cfg.pack?.ammo?.bait    ?? DEFAULTS.pack.ammo.bait),
        }
      }
    };
    return Object.freeze(out);
  }

  // —— 關卡定義 —— //
  const Levels = {
    1: makeLevel(1, {
      name: "儲藏室",
      mode: "lane",
      grid: { cols: 7, rows: 1 },
      allowedBugIds: ["k1"],
      targets: { k1: 10 },
      pack: { hp: 10, coins: 10, ammo: { fire: 10, spray: 10, slipper: 10 } },
      bugMoveIntervalMs: 1200,
      spawnDelayMs: 1200
    }),

    2: makeLevel(2, {
      name: "床上好像有什麼東西在爬，啊，牠會飛",
      mode: "grid",
      grid: { cols: 3, rows: 3 },
      allowedBugIds: ["k1", "k2"],
      targets: { k1: 7, k2: 5 },
      pack: { hp: 10, coins: 0, ammo: { fire: 0, spray: 0, slipper: 0 } },
      bugMoveIntervalMs: 1000,
      spawnDelayMs: 1000
      // 本關暫無家具
    }),

    3: makeLevel(3, {
      name: "廁所浴室被佔領了！",
      mode: "grid",
      grid: { cols: 6, rows: 3 },
      allowedBugIds: ["k1", "k2", "k3"],
      targets: { k1: 10, k2: 7, k3: 3 },
      hazards: [{ type: "soap", count: 2, hpLoss: 3, armTimeMs: 2000, respawnMs: 6000 }],
      pack: { hp: 10, coins: 0, ammo: { fire: 0,  spray: 0,  slipper: 0,  bait: 5 } },
      bugMoveIntervalMs: 900,
      spawnDelayMs: 1000
      // 本關暫無家具
    }),

    4: makeLevel(4, {
      name: "危機四伏的客廳",
      mode: "grid",
      grid: { cols: 7, rows: 7 },
      allowedBugIds: ["k1", "k2", "k3", "k4"],
      targets: { k1: 12, k2: 10, k3: 6, k4: 3 },
      pack: { hp: 10, coins: 0, ammo: { fire: 0,  spray: 0,  slipper: 0,  bait: 5 } },

      // 家具
      obstacles: [
        // 中央沙發：x=2..4, y=2..3（3×2）
        { x1: 2, y1: 2, x2: 4, y2: 3, label: "sofa" },
        // 下方電視：x=2..4, y=6（3×1）
        { x1: 2, y1: 6, x2: 4, y2: 6, label: "tv" }
      ],

      bugMoveIntervalMs: 800,
      spawnDelayMs: 900
    }),

    5: makeLevel(5, {
      name: "廚房飯廳是最後的防線",
      mode: "grid",
      grid: { cols: 10, rows: 10 },
      allowedBugIds: ["k1", "k2", "k3", "k4", "k5"],
      targets: { k1: 15, k2: 10, k3: 7, k4: 5 },
      pack: { hp: 10, coins: 0, ammo: { fire: 0,  spray: 0,  slipper: 0,  bait: 5 } },
      bugMoveIntervalMs: 700,
      spawnDelayMs: 900,

      obstacles: [
        // 餐桌：x=3..6, y=4..5（4×2）
        { x1: 3, y1: 4, x2: 6, y2: 5, label: "table" }
      ]
    })
  };

  g.Levels = Levels;
  g.getLevelCfg = (lv) => {
    const src = Levels[lv] || Levels[1];
    return JSON.parse(JSON.stringify(src));
  };
})(window);
