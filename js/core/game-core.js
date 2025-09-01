// js/core/game-core.js
(function (g) {
  const MAX_AMMO = 99;

  // === 全域音效對照（檔案放在 assets/sounds/ 底下） ===
  const SFX = {
    hit:             "assets/sounds/hit_ok.mp3",
    miss:            "assets/sounds/miss.mp3",
    bite:            "assets/sounds/bite.mp3",          // 被咬
    warn:            "assets/sounds/warn_beep.mp3",     // 通用倒數警告
    soap_warn:       "assets/sounds/warn_beep.mp3",     // 踩到肥皂時的提示（共用 warn）
    slip:            "assets/sounds/slip.mp3",          // 滑倒音效
    select_fire:     "assets/sounds/firegun.mp3",
    select_spray:    "assets/sounds/spray.mp3",
    select_slipper:  "assets/sounds/slipper.mp3",
    select_bait:     "assets/sounds/bait.mp3",
    select_cat:      "assets/sounds/cat.mp3",
    select_recall:   "assets/sounds/recall.mp3",
    select_vote:     "assets/sounds/vote_select.mp3", // ← 選到罷免連署武器時的提示音（較短、較輕）
    vote_ok:         "assets/sounds/vote_ok.mp3",     // ← 真正完成罷免連署時的音效
    recall_success:  "assets/sounds/recall.mp3",        // 罷免成功
    deny:            "assets/sounds/warn_beep.mp3"      // 金幣不足／禁止
  };

  // === Level 5 專屬設定（不要用 export；必要時掛到全域 g） ===
  const L5 = Object.freeze({
    k5BaseHP: 200,
    catAdoptCost: 200,
    catHit: 30
  });

  const RECALL_TARGET = Object.freeze({
    k1: 20,
    k2: 10,
    k3: 5
  });

  // 若其他檔案需要，可開放到全域（可留可拿掉）
  g.LEVEL5 = L5;
  g.RECALL_TARGET = RECALL_TARGET;
  g.SFX = SFX;

  function inRect(x, y, r){ return x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2; }
  function isBlockedOrTV(core, x, y){
    const obs = core.cfg?.obstacles || [];
    const tvs = core.cfg?.weaponForbiddenZones || [];
    return obs.some(r => inRect(x,y,r)) || tvs.some(r => inRect(x,y,r));
  }

  const Core = {
    // —— 狀態 —— //
    state: {
      level: 1, mode: "lane",
      positions: 7, playerPos: 3,
      gridPos: { x: 0, y: 0 }, grid: { cols: 7, rows: 1 },
      player: null, bug: null, weapon: "fire",
      perKindKills: {}, killsThisLevel: 0,
      userInteracted: false, isResolving: false,

      _saidIntroOnce: {},     // 記錄已唸過哪個關卡
      _bugTTL: null,          // 本隻蟑螂的超時計時器
      _bugTTLWarn: null,      // 超時預警（嗶＋語音）
      hazards: [],            // 場上陷阱（第 3 關會用）
      _soapTimer: null,       //（保留接口）踩肥皂倒數
      _soapTile: null,        //（保留接口）踩肥皂座標
      _k4AskedByLevel: {},  // 每關已出題數量（實際進入作答才+1）

      // —— L5 相關 —— //
      k5HP: L5.k5BaseHP,      // 這裡改用上面的 L5（不再未定義）
      catOwned: false,        // 是否已養貓
      recallReady: false,     // 是否達成罷免門檻（你會在程式中動態更新）
      progress: {             // 門檻統計（保留你的舊結構）
        bought: { K1:0, K2:0, K3:0 },
        solvedK4: 0,
        k5HitsByCat: 0
      },
    },

    // —— DOM 參考 —— //
    dom: { area: null, msg: null, status: null, audio: null },

    // —— 關卡設定與 hooks —— //
    cfg: null,
    hooks: { build: null, spawnPos: null, sameTile: null, moveBy: null }, // 由 ModeLane / ModeGrid 設定

    // 追蹤目前是否有語音在講，以及是否有延後的出場需求
    _speechDepth: 0,     // 同時講多段時會累計，歸零代表「完全安靜」
    _spawnQueued: false, // 有新蟑螂要出場，但被語音暫停了

    // —— 進場初始化 —— //
    init({ level }) {
      // 關卡與配置
      this.state.level = level;
      this.cfg = g.getLevelCfg(level);
      this.state.mode = this.cfg.mode;
      this.state.grid = this.cfg.grid || { cols: 7, rows: 1 };
      this.state.votes       = this.state.votes       ?? 0;
      this.state.voteBought  = this.state.voteBought  ?? { k1: 0, k2: 0, k3: 0 };

      // 玩家資料（延續上一關，並加上本關 pack）
      this.state.player = JSON.parse(localStorage.getItem("bugSlayerPlayer") || "{}");
      Object.assign(this.state.player, {
        name:  this.state.player.name  || "無名勇者",
        hp:    (this.state.player.hp    ?? 10),
        coins: (this.state.player.coins ?? 10),
        weaponUsage: {
          fire:    (this.state.player.weaponUsage?.fire    ?? 0),
          spray:   (this.state.player.weaponUsage?.spray   ?? 0),
          slipper: (this.state.player.weaponUsage?.slipper ?? 0),
          bait:    (this.state.player.weaponUsage?.bait    ?? 0),
          cat:     (this.state.player.weaponUsage?.cat     ?? 0),
          vote:    (this.state.player.weaponUsage?.vote    ?? 0)
        }
      });

      // HUD 舊欄位鏡像（非權威）
      this.state.player.recallVotes = this.state.player.recallVotes ?? this.state.votes;

      // 非彈藥型欄位：cat/vote 只作使用次數統計
      const W = this.state.player.weaponUsage = this.state.player.weaponUsage || {};
      W.fire     = W.fire     ?? 0;
      W.spray    = W.spray    ?? 0;
      W.slipper  = W.slipper  ?? 0;
      W.bait     = W.bait     ?? 5;  // 「??」不會把 0 變 5
      W.cat      = W.cat      ?? 0;  // 統計用
      W.vote     = W.vote     ?? 0;  // 統計用
      delete W.recall;               // 避免語意混淆

      // ★ 每關一次：起始彈藥（預設 10/10/10/5，可由 cfg 覆蓋）
      const baseAmmo = this.cfg?.baseAmmo ?? { fire:10, spray:10, slipper:10, bait:5 };
      const BASE_KEY = `baseApplied_L${level}`;
      if (localStorage.getItem(BASE_KEY) !== "1") {
        const W = this.state.player.weaponUsage || (this.state.player.weaponUsage = { fire:0,spray:0,slipper:0,bait:0 });
        ["fire","spray","slipper","bait"].forEach(k => {
          const add = baseAmmo[k] || 0;
          W[k] = Math.min(MAX_AMMO, (W[k] || 0) + add);
        });
        this.savePlayer();
        localStorage.setItem(BASE_KEY, "1");
      }

      // 套用本關 pack（只加一次）
      const pack = (this.cfg && this.cfg.pack) ? this.cfg.pack : null;
      const PACK_KEY = `packApplied_L${level}`;
      const alreadyApplied = localStorage.getItem(PACK_KEY) === "1";
      if (pack && !alreadyApplied) {
        const P = this.state.player;
        if (typeof pack.hp === "number")    P.hp    = Math.max(0, (P.hp    || 0) + pack.hp);
        if (typeof pack.coins === "number") P.coins = Math.max(0, (P.coins || 0) + pack.coins);
        const ammo = pack.ammo || {};
        // ★ 確保有容器
        P.weaponUsage = P.weaponUsage || { fire: 0, spray: 0, slipper: 0, bait: 0 };
        ["fire","spray","slipper","bait"].forEach(w => {
          const add = ammo[w] || 0;
          P.weaponUsage[w] = Math.min(MAX_AMMO, (P.weaponUsage[w] || 0) + add);
        });
        this.savePlayer();
        localStorage.setItem(PACK_KEY, "1");
      }

      // DOM 綁定
      this.dom.area   = document.getElementById("gameArea");
      this.dom.msg    = document.getElementById("message");
      this.dom.status = document.getElementById("weaponStatus");
      this.dom.audio  = document.getElementById("voicePlayer");

      // 起點（lane：中間；grid：中央）—— 只保留「含安全檢查」版本
      if (this.state.mode === "grid") {
        this.state.gridPos = {
          x: Math.floor(this.state.grid.cols / 2),
          y: Math.floor(this.state.grid.rows / 2)
        };
        // ★ 若起點落在家具或電視區 → 移到最近安全格
        if (isBlockedOrTV(this, this.state.gridPos.x, this.state.gridPos.y)) {
          this.state.gridPos = this._nearestFreePos({ x:this.state.gridPos.x, y:this.state.gridPos.y });
        }
      } else {
        this.state.playerPos = Math.floor((this.state.positions || 7) / 2);
      }

      // 任何「可見」遮罩/對話框存在時，只是暫停熱鍵處理；不要 return
      const hasVisible = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const hiddenByClass = el.classList.contains('sr-only') ||
                              el.hasAttribute('hidden') ||
                              el.getAttribute('aria-hidden') === 'true';
        const cs = window.getComputedStyle(el);
        const hiddenByStyle = (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0');
        return !(hiddenByClass || hiddenByStyle);
      };
      const isOverlayOpen = () =>
        (window.__gateOpen === true) ||
        (window.__k4Open === true) ||
        hasVisible('.quiz-overlay') ||
        hasVisible('.k4-overlay') ||
        hasVisible('[role="dialog"]') ||
        hasVisible('[role="alertdialog"]');

      // 鍵盤事件 + 首次互動解除音訊限制（避免重複綁定）
      if (!this._keysBound) {
        this._keysBound = true;

        document.addEventListener("keydown", (e) => {
          this.state.userInteracted = true;

          // 若有 overlay，直接讓對話框處理，不進遊戲熱鍵
          if (isOverlayOpen()) return;

          // Shift+S：播報狀態（票數改讀 this.state.votes）
          if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
            const P = this.state.player;
            const left = P.weaponUsage[this.state.weapon] || 0;
            this.speak(
              `玩家 ${P.name}，血量 ${P.hp}，金幣 ${P.coins}，` +
              `目前武器 ${this.getWeaponName(this.state.weapon)}，可用次數 ${left} 次，` +
              `累積選票 ${this.state.votes}。`
            );
            return;
          }

        // 支援 Numpad 鍵
        const keyMap = {
          Numpad1: "1", Numpad2: "2", Numpad3: "3", Numpad4: "4",
          Numpad5: "5", Numpad6: "6", Numpad7: "7"
        };
        const k = keyMap[e.code] || e.key;

          switch (e.key) {
            case "ArrowLeft":  this.moveBy(-1, 0); break;
            case "ArrowRight": this.moveBy( 1, 0); break;
            case "ArrowUp":    this.moveBy(0, -1); break;
            case "ArrowDown":  this.moveBy(0,  1); break;
            case " ":          e.preventDefault(); this.scanArea(); break;

            case "Enter": {
              // vote/recall 特例處理：ENTER 當攻擊鍵用，但要先分流
              if (this.state.weapon === 'vote') {
                this._tryBuyVoteByCurrentTarget();
                break;
              }
              if (this.state?.bug?.id === 'k4') {
                const isBait = (this.state.weapon === 'bait');
                const declined = !!this.state?.bug?._quizDeclined;
                const quizClosed = !window.__k4Open;
                if ((isBait || declined) && quizClosed) {
                  this.attack();
                }
              } else {
                this.attack();
              }
              break;
            }

            case "1": this.changeWeapon("fire");    break;
            case "2": this.changeWeapon("spray");   break;
            case "3": this.changeWeapon("slipper"); break;
            case "4": this.changeWeapon("bait");    break;
            case "5": this.changeWeapon("cat");     break;
            case "6": this.changeWeapon("vote");    break;
            case "7": this.changeWeapon("recall");  break;
          }
        }, { passive: false });

        // 首次滑鼠/觸控也算互動，解除音訊限制
        document.addEventListener("click",      () => { this.state.userInteracted = true; }, { once: true });
        document.addEventListener("touchstart", () => { this.state.userInteracted = true; }, { once: true, passive: true });
      }

      // 1) 先更新數值
      this.updateUI();

      // 2) 只在第一次、而且是第 3 關時，布置陷阱（肥皂）
      if (!this._hazardsSetupDone && this.state.level === 3) {
        this.setupHazards();
        this._hazardsSetupDone = true;   // ← 只做一次
      }

      // 3) 畫出場地
      this.build();

      // ★ 第 5 關：建立活動式菜籃車（會左右巡邏）
      if (this.state.level === 5) {
        this._setupCartHazard?.();
      }

      // 預載音效（補上 select_bait / select_cat）
      [
        "select_fire","select_spray","select_slipper","select_bait","select_cat",
        "warn","soap_warn","bite","slip",
        "select_vote","vote_ok","recall_success"
      ].forEach(k => {
        const p = SFX[k]; if (!p) return;
        const a = new Audio(); a.src = p; a.preload = "auto";
      });

      // 5) 唸完關卡資訊再生第一隻
      this.state._saidIntroOnce = this.state._saidIntroOnce || {};
      if (!this.state._saidIntroOnce[this.state.level]) {
        this.announceLevelIntro();  // 內部會在唸完後呼叫 spawnBug()
        this.state._saidIntroOnce[this.state.level] = true;
      } else {
        this.spawnBug();
      }

      // 廣播就緒（只發一次）
      if (!this._emittedReady) {
        this._emittedReady = true;
        document.dispatchEvent(new CustomEvent('game-ready', { detail: { game: this } }));
      }
    },  // ← 收掉 init 方法

    // 取得目前可被罷免連署的目標：優先抓「已捕捉的一隻」，否則抓玩家面前的鎖定目標
    getCurrentVoteTarget(){
      return this.state.capturedRoach
          || this.state.targetRoach
          || this.state.bug  // 若你的系統只有單一當前蟑螂
          || null;
    },

    // 取得本關 K4 題數上限（預設 L4/L5 = 10；其他關無上限）
    _k4CapForLevel(lv = this.state.level) {
      if (this.cfg?.k4MaxQuestionsPerLevel != null) return Number(this.cfg.k4MaxQuestionsPerLevel) || 0;
      return (lv === 4 || lv === 5) ? 10 : Infinity;
    },

    // 是否還可以再出題（未達上限）
    k4CanAskMore(lv = this.state.level) {
      const asked = (this.state._k4AskedByLevel?.[lv] || 0);
      return asked < this._k4CapForLevel(lv);
    },

    // 紀錄本關「實際出了一題」
    k4MarkAsked(lv = this.state.level) {
      const asked = (this.state._k4AskedByLevel?.[lv] || 0) + 1;
      this.state._k4AskedByLevel = { ...(this.state._k4AskedByLevel || {}), [lv]: asked };
      // 如要跨頁保留也可寫入 localStorage（可選）
      // localStorage.setItem('k4AskedByLevel', JSON.stringify(this.state._k4AskedByLevel));
    },

    _tryBuyVoteByCurrentTarget(){
      const roach = this.getCurrentVoteTarget();
      if (!roach) {
        this.ui?.toast?.('目前沒有鎖定的蟑螂可罷免連署');
        (this.sfx?.play?.('warn') || this.sfx?.('warn'));
        return;
      }
      this._buyVoteForRoach(roach);
    },

    _buyVoteForRoach(roach){
      const S = this.state;
      if (S._isBuyingVote) return;         // 原子鎖（避免連按）
      S._isBuyingVote = true;

      try{
        // —— 是否需要同格（可由關卡設定覆寫；預設需要）——
        const needSameTile = (this.cfg?.voteNeedSameTile ?? true);
        if (needSameTile) {
          const onSame = (this.hooks && typeof this.hooks.sameTile === "function")
            ? this.hooks.sameTile(this, S, roach)
            : (S.mode === "grid"
                ? (S.gridPos.x === roach?.pos?.x && S.gridPos.y === roach?.pos?.y)
                : (S.playerPos === roach?.pos));
          if (!onSame) {
            this.ui?.toast?.('沒有可操作的目標。');
            (this.sfx?.play?.('warn') || this.sfx?.('warn'));
            return;
          }
        }

        // —— 用 bugs.js 的單價與票值 ——（兼容大小寫 id）
        const kind = ((roach.id || roach.kind || '') + '').toLowerCase();   // 'k1'..'k5'
        if (!['k1','k2','k3'].includes(kind)) {
          this.ui?.toast?.('只能對 K1、K2、K3 使用罷免連署');
          (this.sfx?.play?.('warn') || this.sfx?.('warn'));
          return;
        }
        const def = (window.bugs || []).find(b => b.id === kind);
        if (!def || !def.voteCost || !def.voteTicket) {
          this.ui?.toast?.('這隻不接受罷免連署');
          (this.sfx?.play?.('warn') || this.sfx?.('warn'));
          return;
        }

        // 金幣檢查
        const price = def.voteCost, tickets = def.voteTicket;
        if ((S.player.coins || 0) < price){
          this.ui?.toast?.('金幣不足，無法罷免連署');
          (this.sfx?.play?.('warn') || this.sfx?.('warn'));
          return;
        }

        // —— 原子化：先標記，避免重複 ——
        if (roach.status === 'bought' || roach.removed) return;
        roach.status = 'bought';

        // 扣款
        S.player.coins -= price;

        // 立刻移除，避免它的 attack 計時器再咬人
        this._despawnRoach?.(roach);
        // 若這隻正好是 state.bug，也保險清一次（_despawnRoach 已處理，但再守一層不影響）
        if (S.bug === roach) {
          if (this._bugTTL)     { clearTimeout(this._bugTTL);     this._bugTTL = null; }
          if (this._bugTTLWarn) { clearTimeout(this._bugTTLWarn); this._bugTTLWarn = null; }
          S.bug = null;
        }

        // 計票／計數
        S.votes += tickets;
        S.voteBought = S.voteBought || { k1:0, k2:0, k3:0 };
        if (S.voteBought[kind] != null) {
          S.voteBought[kind] += 1;
        }
        // 鏡像到舊 HUD 欄位（如果你還在用）
        S.player.recallVotes = S.votes;

        // 計「使用 vote 武器」次數（純統計）
        S.player.weaponUsage.vote = (S.player.weaponUsage.vote || 0) + 1;

        // 音效＋UI
        (this.sfx?.play?.('vote_ok') || this.sfx?.('vote_ok'));
        this.updateUI?.();          // HUD 請讀 this.state.votes / voteBought
        this._checkRecallGate?.();  // 門檻達標提示（此函式內不要再呼叫 updateUI 避免遞迴）

        // ★ 節奏：延遲一點再生下一隻蟑螂，避免切得太快
        setTimeout(() => this.spawnBug?.(), this.cfg?.spawnDelayMs || 800);

      } finally {
        S._isBuyingVote = false;
      }
    },

    // 從場上移除蟑螂（清計時器、移出陣列與 DOM）；同時相容單一 this.state.bug
    _despawnRoach(roach){
      if (!roach || roach.removed) return;
      roach.removed = true;

      if (roach.attackTimer) { clearInterval(roach.attackTimer); roach.attackTimer=null; }
      if (roach.moveTimer)   { clearInterval(roach.moveTimer);   roach.moveTimer=null; }
      if (roach.aiTimer)     { clearInterval(roach.aiTimer);     roach.aiTimer=null; }

      // activeRoaches（若有）
      const list = this.state.activeRoaches || [];
      const i = list.indexOf(roach);
      if (i >= 0) list.splice(i,1);

      // 當前單一 bug（若系統採單一目標）
      if (this.state.bug === roach) {
        if (this._bugTTL)     { clearTimeout(this._bugTTL);     this._bugTTL = null; }
        if (this._bugTTLWarn) { clearTimeout(this._bugTTLWarn); this._bugTTLWarn = null; }
        this.state.bug = null;
      }

      if (roach.el && roach.el.parentNode) roach.el.parentNode.removeChild(roach.el);
    },

    // —— Mode 切換/建構/移動 —— //
    setModeHooks(hooks) {
      this.hooks = hooks;
    },

    build() {
      if (this.hooks?.build) this.hooks.build(this);
    },

    moveBy(dx, dy) {
      if (this.hooks?.moveBy) {
        this.hooks.moveBy(this, dx, dy);
      }
      this.updateUI();
      this.build();

      // ★ 播放移動音效（簡單作法；若覺得太吵可加節流/快取）
      if (this.state?.level) {
        const lv = this.state.level;
        const audio = new Audio(`assets/sounds/move_0${lv}.mp3`);
        audio.volume = 0.7;
        audio.play().catch(()=>{});
      }
    },

    changeWeapon(t) {
      this.state.weapon = t;

      const key = t === "fire"    ? "select_fire"
               : t === "spray"   ? "select_spray"
               : t === "slipper" ? "select_slipper"
               : t === "bait"    ? "select_bait"
               : t === "cat"     ? "select_cat"
               : t === "vote"    ? "select_vote"
               : t === "recall"  ? "select_recall"
               : null;

    if (key) this.sfx(key);
      if (t === 'vote') {
        // 明確教學，避免誤會「選擇音 = 已罷免連署」
        this.speak('罷免連署模式。移到蟑螂旁，按 Enter 收買。');
      } else {
        this.speak(`${this.getWeaponName(t)}。`);
      }

      this.updateUI();

      // 若切到養貓且尚未領養 → 直接開視窗
      if (t === 'cat' && !this.state.catOwned) {
        g.openCatPicker?.();
      }
    },

    // —— 小工具 —— //
    wait(ms) {
      if (!(ms >= 0)) return Promise.resolve();
      return new Promise(r => setTimeout(r, ms));
    },

    speakAsync(text, { interrupt = true } = {}) {
      return new Promise(resolve => {
        if (!text || !("speechSynthesis" in g)) return resolve();

        try {
          if (interrupt) speechSynthesis.cancel();
        } catch(_) {}

        const u = new SpeechSynthesisUtterance(text);
        u.lang = "zh-TW";
        u.rate = 1.5;   // 語速 (預設=1，0.1 最慢，10 最快)
        u.pitch = 1.0;  // 音高 (預設=1，範圍 0~2)
        u.volume = 1.0; // 音量 (0~1)

        // 防呆初始化
        if (typeof this._speechDepth !== 'number') this._speechDepth = 0;
        if (typeof this._spawnQueued !== 'boolean') this._spawnQueued = false;

        this._speechDepth++;

        let doneCalled = false;
        const done = () => {
          if (doneCalled) return;
          doneCalled = true;

          if (this._speechDepth > 0) this._speechDepth--;

          // 若所有語音都結束，且之前有人排隊要出場 → 讓蟑螂出來
          if (this._speechDepth === 0 && this._spawnQueued && !this.state.bug) {
            this._spawnQueued = false;
            try { this.spawnBug(); } catch(_) {}
          }
          resolve();
        };

        u.onend = done;
        u.onerror = done;

        try { speechSynthesis.speak(u); } catch(_) { done(); }

        // 安全守門員：避免某些瀏覽器取消不觸發 onend
        setTimeout(() => {
          if (!doneCalled) done();
        }, 12000);
      });
    },

    // —— 計時暫停 / 恢復 —— //
    pauseTimer(){
      this._paused = true;
      const now = performance.now?.() ?? Date.now();

      // 預警
      if (this._bugTTLWarn) {
        this._bugTTLWarnRemain = Math.max(0, (this._bugTTLWarnDueAt || 0) - now);
        clearTimeout(this._bugTTLWarn);
        this._bugTTLWarn = null;
      }

      // 主倒數
      if (this._bugTTL) {
        this._bugTTLRemain = Math.max(0, (this._bugTTLDueAt || 0) - now);
        clearTimeout(this._bugTTL);
        this._bugTTL = null;
      }

      // 停菜籃車
      if (this._cartTimer) {
        clearInterval(this._cartTimer);
        this._cartTimer = null;
      }

      // 若有移動計時器也停掉
      if (this._bugMoveTimer) {
        clearInterval(this._bugMoveTimer);
        this._bugMoveTimer = null;
      }
    },

    resumeTimer(){
      this._paused = false;

      // 若當前沒有蟑螂或已被清場，就不恢復
      if (!this.state.bug) {
        this._bugTTLRemain = null;
        this._bugTTLWarnRemain = null;
        return;
      }

      const now = performance.now?.() ?? Date.now();

      // 恢復預警
      if (typeof this._bugTTLWarnRemain === 'number' && this._bugTTLWarnRemain > 0) {
        this._bugTTLWarnDueAt = now + this._bugTTLWarnRemain;
        this._bugTTLWarn = setTimeout(() => {
          if (this.state.bug) {
            try { this.sfx && this.sfx('warn'); } catch(_) {}
            this.speak('剩 5 秒！');
          }
        }, this._bugTTLWarnRemain);
      }

      // 恢復主倒數
      if (typeof this._bugTTLRemain === 'number' && this._bugTTLRemain > 0) {
        this._bugTTLDueAt = now + this._bugTTLRemain;
        this._bugTTL = setTimeout(async () => {
          if (!this.state.bug) return;

          const dmg = this.state.bug.damage || { hp: 1, coins: 0 };

          try { this.sfx && this.sfx('bite'); } catch(_) {}
          await this.wait(400);
          await this.speakAsync('被咬了！扣血。');

          if (this.applyPenalty(dmg)) return; // 已敗 → 不要繼續後續動作

          // 清掉這隻，稍等再生下一隻
          this.state.bug = null;
          this.build?.();

          // 清殘留
          if (this._bugTTL)     { clearTimeout(this._bugTTL);     this._bugTTL = null; }
          if (this._bugTTLWarn) { clearTimeout(this._bugTTLWarn); this._bugTTLWarn = null; }
          this._bugTTLDueAt = this._bugTTLWarnDueAt = null;
          this._bugTTLRemain = this._bugTTLWarnRemain = null;

          setTimeout(() => this.spawnBug?.(), 2000);
        }, this._bugTTLRemain);
      }

      // 恢復菜籃車（第 5 關）
      if (this.state.level === 5) {
        if (!this._cartTimer) {
          this._cartTimer = setInterval(() => this._tickCart?.(), 580);
        }
      }

      // 清掉暫存
      this._bugTTLRemain = null;
      this._bugTTLWarnRemain = null;
    },

    // —— 語音/音效 —— //
    speak(text) {
      if (!text) return;
      if ("speechSynthesis" in g) {
        try { speechSynthesis.cancel(); } catch(_) {}
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "zh-TW";
        u.rate = 1.5;   // 語速
        u.pitch = 1.0;  // 音高
        u.volume = 1.0; // 音量
        try { speechSynthesis.speak(u); } catch(_) {}
      }
    },

    sfx(pathOrKey) {
      if (!this.state.userInteracted) return; // 需互動後才能播
      const a = this.dom.audio;
      if (!a) return;
      const path = (typeof SFX[pathOrKey] === 'string') ? SFX[pathOrKey] : pathOrKey;
      if (!path) return;

      try {
        a.pause();
        a.currentTime = 0;
        a.src = path;
        a.onerror = () => { /* 靜音忽略 404/解碼失敗 */ };
        a.play().catch(() => { /* 靜音忽略自動播放限制 */ });
      } catch(_) {}

      return a;
    },

    // ★ 相容舊呼叫風格：this.sfx.play('vote') 也能用
    //   （某些段落我們用到了 ?.play ，這裡做別名相容）
    get sfxPlayer(){
      // 可選：若你不想加 getter，改成 this.sfx.play = (k)=>this.sfx(k) 也行
      const fn = (k) => this.sfx(k);
      fn.play = (k) => this.sfx(k);
      return fn;
    },

    _weaponSelectSfx(type) {
      switch (type) {
        case "fire":    return SFX.select_fire;
        case "spray":   return SFX.select_spray;
        case "slipper": return SFX.select_slipper;
        case "bait":    return SFX.select_bait;
        case "cat":     return SFX.select_cat;
        case "vote":    return SFX.select_vote;
        case "recall":  return SFX.select_recall;
        default:        return null;
      }
    },

    // —— 取得本關可出現的蟑螂池 —— //
    getAllowedBugs() {
      const ids = (this.cfg?.allowedBugIds || []);
      const all = (window.bugs || g.bugs || []);
      return all.filter(b => ids.includes(b.id));
    },

    // —— 開場唸關卡資訊（含目標） —— //
    async announceLevelIntro() {
      const cfg = this.cfg || g.getLevelCfg(this.state.level);
      const nameOf = (id) => ((window.bugs || []).find(b => b.id === id)?.name || id);

      let targetStr = "";
      const T = cfg.targets || {};
      const entries = Object.entries(T);
      if (entries.length) {
        targetStr = "。目標：" + entries.map(([id, n]) => `${nameOf(id)} ${n} 隻`).join("、");
      }

      // 播旁白前壓低 BGM 音量
      const bgm = document.getElementById('bgm');
      if (bgm) bgm.volume = 0.25;

      // 用 speakAsync：講完才繼續
      await this.speakAsync(`第 ${this.state.level} 關：${cfg.name}${targetStr}。按空白鍵掃描，Enter 攻擊。`);

      // 講完恢復音量，再生第一隻蟑螂
      if (bgm) bgm.volume = 1;
      if (!window.__gateOpen) {
      this.spawnBug();
    } else {
      // 等 gate 關閉時由開始鈕觸發 announceLevelIntro() 或直接 spawn
    }
    },

    // —— 生蟑螂 —— //
    spawnBug() {
      let pool = this.getAllowedBugs();
      if (!pool.length && (g.bugs || []).length) {
        console.warn("⚠️ allowedBugIds 沒有匹配，暫用 bugs[0]");
        pool = [g.bugs[0]];
      }
      if (!pool.length) return;

      const base = pool[Math.floor(Math.random() * pool.length)];
      const bug  = JSON.parse(JSON.stringify(base));

      // 一定要有座標
      if (this.state.mode === "grid") {
        const { cols, rows } = this.state.grid || { cols: 3, rows: 3 };

        // 🔑 loop 找合法格子：不在家具／禁區／玩家位置
        let guard = 200;
        while (guard-- > 0) {
          const x = Math.floor(Math.random() * cols);
          const y = Math.floor(Math.random() * rows);

          // 家具區 or 電視禁用區要避開
          const blocked = this.isBlockedCell ? this.isBlockedCell(x, y) : false;
          const inTV = (this.cfg?.weaponForbiddenZones || []).some(z => inRect(x, y, z));

          const clashPlayer = (this.state.gridPos.x === x && this.state.gridPos.y === y);

          if (!blocked && !inTV && !clashPlayer) {
            bug.pos = { x, y };
            break;
          }
        }
        if (!bug.pos) {
          // 萬一 guard 用完，還是隨便放
          bug.pos = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
        }
      } else {
        const N = this.state.positions || 7;
        bug.pos = (typeof bug.pos === "number") ? bug.pos : Math.floor(Math.random() * N);
      }

      bug.attackCount = 0;
      this.state.bug  = bug;
      bug._quizAsked = false;  // ⭐ 每隻新 K4 預設尚未問過

      // 肥皂不疊到蟑螂（若撞到，移動那顆肥皂到空格）
      (this.state.hazards || []).forEach(h => {
        if (h.type === "soap" && h.alive && this.state.mode === "grid" &&
            h.x === bug.pos?.x && h.y === bug.pos?.y) {
          const np = this._randFreePos();
          h.x = np.x; h.y = np.y;
        }
      });

      // 先清掉上一隻的超時計時器
      if (this._bugTTL)     { clearTimeout(this._bugTTL);     this._bugTTL = null; }
      if (this._bugTTLWarn) { clearTimeout(this._bugTTLWarn); this._bugTTLWarn = null; }

    // 讀關卡 escapeAfterMs（有設定才啟動超時計時）
    let TTL_MS = this.cfg?.escapeAfterMs;
    if (typeof TTL_MS === "number" && TTL_MS > 0) {

      // ★ 若是 K4，延長到 60 秒（可自行調整數值）
      if (bug.id === 'k4') {
        TTL_MS = Math.max(TTL_MS, 60000);
      }

      const warnMs = TTL_MS > 5000 ? (TTL_MS - 5000) : null;

      // 預警：先記錄 dueAt，再排 timer
      if (warnMs != null) {
        this._bugTTLWarnDueAt = performance.now() + warnMs;
        this._bugTTLWarn = setTimeout(() => {
          if (this.state.bug && this.state.bug.id === bug.id) {
            this.sfx('warn');
            this.speak('剩 5 秒！');
          }
        }, warnMs);
        // 清掉暫存剩餘
        this._bugTTLWarnRemain = null;
      }

      // 主倒數：記錄 dueAt
      this._bugTTLDueAt = performance.now() + TTL_MS;
      this._bugTTL = setTimeout(async () => {
        if (!this.state.bug || this.state.bug.id !== bug.id) return;

        // 反咬處置（原樣）
        const P   = this.state.player;
        const dmg = this.state.bug.damage || { hp: 1, coins: 0 };

        this.sfx('bite');
        await this.wait(400);
        await this.speakAsync('被咬了！扣血。');

        if (this.applyPenalty(dmg)) return; // 已敗 → 不要繼續後續動作

        // 清掉這隻，稍等再生下一隻
        this.state.bug = null;
        this.build();

        // 清計時器與標記
        if (this._bugTTL)     { clearTimeout(this._bugTTL);     this._bugTTL = null; }
        if (this._bugTTLWarn) { clearTimeout(this._bugTTLWarn); this._bugTTLWarn = null; }
        this._bugTTLDueAt = this._bugTTLWarnDueAt = null;
        this._bugTTLRemain = this._bugTTLWarnRemain = null;

        setTimeout(() => this.spawnBug(), 2000);
      }, TTL_MS);

      // 清掉暫存剩餘
      this._bugTTLRemain = null;
    }

      // 進場音效 + 報位置
        (() => {
          // 用站點根目錄的絕對路徑，避免 dev 伺服器子路徑干擾
          const root = window.ASSETS_ROOT || "";
          const p = `${root}assets/sounds/${bug.id}_intro.mp3`;
          this.sfx(p);
        })();

        if (bug.id !== 'k4') {
          const where = this.posToSpeech();
          this.speak(`${bug.name} 出現在 ${where}`);
        }

        // K4：直接廣播事件，由 k4_dialog/quiz 接手（這裡不再說話）
        if (bug.id === 'k4') {
          setTimeout(() => {
            document.dispatchEvent(new CustomEvent('encounter-k4', { detail: { t: Date.now() } }));
          }, 200);
        }
      this.build();
    },

    // —— 第三關：生成肥皂陷阱（只做一次），重生覆用 —— //
    setupHazards(){
      this.state.hazards = []; // 清空
      const cfg = this.cfg;
      if (!cfg || !Array.isArray(cfg.hazards)) return;

      const soapCfg = cfg.hazards.find(h => h.type === "soap");
      if (!soapCfg) return;

      // 建議一顆，避免混亂；如需多顆可調高 count
      const count = 1;

      this._soapCfg = {
        hpLoss:    soapCfg.hpLoss    ?? 3,
        armTimeMs: soapCfg.armTimeMs ?? 2000, // 踩上去延遲後滑倒
        respawnMs: soapCfg.respawnMs ?? 6000  // 重生時間
      };

      for (let i = 0; i < count; i++){
        const pos = this._randFreePos();
        this.state.hazards.push({
          id: `soap-${i}`,  // 有 id，重生時覆用
          type: "soap",
          x: pos.x, y: pos.y,
          alive: true
        });
      }
    },
        // 建立一台會動的菜籃車
    _setupCartHazard(){
      const { cols, rows } = this.state.grid || { cols:10, rows:10 };
      // 挑一條沒有家具的大致安全路徑（優先靠近餐桌列上/下）
      const candidateRows = [3,6,2,7,1,8].filter(y => {
        // 至少有 6 個可走格
        let free = 0;
        for (let x=0; x<cols; x++){
          if (!this.isBlockedCell(x,y)) free++;
        }
        return free >= 6;
      });
      const y = candidateRows[0] ?? 0;

      // 在該列找一個可走的起點
      let x = 0;
      for (let guard=0; guard<100; guard++){
        const t = Math.floor(Math.random()*cols);
        if (!this.isBlockedCell(t,y)) { x=t; break; }
      }

      // 建立 hazard
      this.state.hazards = this.state.hazards || [];
      // 先移除既有 cart（避免重複）
      this.state.hazards = this.state.hazards.filter(h=>h.type!=='cart');

      this.state.hazards.push({
        id: 'cart-1',
        type: 'cart',
        x, y,
        dir: (Math.random()<0.5? -1 : 1), // 往左或往右
        alive: true
      });

      // 啟動移動 Timer
      if (this._cartTimer) { clearInterval(this._cartTimer); this._cartTimer = null; }
      this._cartTimer = setInterval(()=> this._tickCart(), 580);
    },

    // 每拍讓菜籃車動一步；撞到玩家扣 1 血，嘗試把玩家推一格
    _tickCart(){
      const cart = (this.state.hazards||[]).find(h=>h.type==='cart' && h.alive);
      if (!cart) return;

      const { cols, rows } = this.state.grid || { cols:10, rows:10 };
      const tryStep = (x,y,dir) => {
        let nx = x + dir;
        // 撞牆或家具就反向
        if (nx < 0 || nx >= cols || this.isBlockedCell(nx, y)) {
          cart.dir *= -1;
          nx = x + cart.dir;
          // 連反向也擋住 → 不動
          if (nx < 0 || nx >= cols || this.isBlockedCell(nx, y)) return x;
        }
        return nx;
      };

      const nx = tryStep(cart.x, cart.y, cart.dir);
      if (nx === cart.x) {
        // 原地卡住就不重繪
        return;
      }

      // 與玩家碰撞判定
      const p = this.state.gridPos;
      if (p.x === nx && p.y === cart.y) {
        this.sfx('warn');
        this.speak('被菜籃車撞到，扣血一！扣金幣一！');

        // 扣血
        this.applyPenalty({ hp:1, coins:1 }, /*speakOnLose*/true);

        // 嘗試把玩家推一格（與車同方向）
        const pushX = p.x + cart.dir;
        if (pushX >= 0 && pushX < cols && !this.isBlockedCell(pushX, p.y)) {
          this.state.gridPos = { x: pushX, y: p.y };
        }
      }

      cart.x = nx;
      this.build();
    },

    // —— 攻擊（加入 finally 保證解鎖；擊中/未擊中有音效+語音等待） —— //
    async attack() {
      const S = this.state, P = S.player, B = S.bug;
      if (S.isResolving) return;
      S.isResolving = true;

      const watchdog = setTimeout(() => {
        if (S.isResolving) {
          S.isResolving = false;
          console.warn("[attack] 解鎖看門狗啟動，避免卡死");
        }
      }, 3000);

      try {
        if (!B) { this.speak("目前沒有蟑螂。"); return; }

        // —— 單一「同格」判定，整個方法共用 —— //
        const onSame = (this.hooks && typeof this.hooks.sameTile === "function")
          ? this.hooks.sameTile(this, S, B)
          : (S.mode === "grid"
              ? (S.gridPos.x === B?.pos?.x && S.gridPos.y === B?.pos?.y)
              : (S.playerPos === B?.pos));

        // —— L5：非彈藥型武器（vote/cat/recall）不消耗彈藥 —— //
        if (["vote","cat","recall"].includes(S.weapon)) {
          if (!onSame) { this.speak("沒有可操作的目標。"); return; }

          const kindRaw = (B.id || B.kind || '').toString();
          const KIND = kindRaw.toUpperCase();   // 'K1'..'K5'
          const kind = kindRaw.toLowerCase();   // 'k1'..'k5'

          // === vote：罷免連署＝以金幣擊敗該蟑螂 → 累積票數與分項計數 ===
          if (S.weapon === 'vote') {
            // 規則：K1–K3 可買，K4 走題目，K5 不賣
            if (!/^K[123]$/.test(KIND)) { this.speak('只能對 K1、K2、K3 使用罷免連署。'); return; }

            // 從 bugs.js 讀單價與票值（若沒定義，安全 fallback）
            const def = this._bugDef(kind);
            const price   = (def && def.voteCost)   ? def.voteCost   : (this.cfg?.ticketPrice ?? 3);
            const tickets = (def && def.voteTicket) ? def.voteTicket : 1;

            // 金幣檢查
            if ((P.coins || 0) < price) {
              this.sfx?.('deny');
              await this.speakAsync(`金幣不足，${KIND} 需要 ${price} 枚金幣。`);
              return;
            }

            // 扣金幣
            P.coins -= price;

            // 把這隻視為「被收買」並移除，避免之後咬人/計時器觸發
            B.status = 'bought';
            this._despawnCurrentBug();

            // 累計票數與分項數
            S.votes += tickets;
            S.voteBought[kind] = (S.voteBought[kind] || 0) + 1;

            // 舊 HUD 鏡像（若還有地方讀 player.recallVotes）
            P.recallVotes = S.votes;

            // 統計（保留你原架構）
            if (S?.progress?.bought && S.progress.bought[KIND] != null) {
              S.progress.bought[KIND] += 1;
            }

            this.updateUI();
            this.sfx?.('vote');
            await this.speakAsync(`以 ${price} 金幣收買 ${KIND} 成功。你獲得 ${tickets} 張罷免票。`);

            // 達標就提示（或直接結算；看你的想要）
            if (this._isRecallAchieved()) {
              this.tts?.speak?.('罷免條件已達成！遇到蟑螂王可直接罷免。');
            }

            // 讓共用指揮官接手：先念狀態，再生下一隻
            window.dispatchEvent(new CustomEvent('bug-killed'));
            return;
          }

          // === cat：對 K5 造成傷害（需已養貓） ===
          if (S.weapon === 'cat') {
            if (!this.state.catOwned) {
              this.speak('你還沒有貓咪，請先養貓。');
              if (typeof g.openCatPicker === 'function') g.openCatPicker();
              return;
            }
            if (KIND !== 'K5') { this.speak('喵喵只對蟑螂王有興趣。'); return; }

            this.state.k5HP = Math.max(0, this.state.k5HP - L5.catHit);
            this.state.progress.k5HitsByCat++;
            this.updateUI();
            this.sfx?.('hit');
            await this.speakAsync(`貓咪出擊！對 K5 造成 ${L5.catHit} 傷害，剩餘 ${this.state.k5HP}。`);
            if (this.state.k5HP <= 0) { this._onBossDefeated(); return; }
            return;
          }

          // === recall：罷免（以門檻達成為準，不再消耗「票庫」） ===
          if (S.weapon === 'recall') {
            if (KIND !== 'K5') { this.speak('罷免只能用在蟑螂王。'); return; }

            if (!this._isRecallAchieved()) {
              const need = this._recallNeedText(); // 產生提示文字
              this.speak(`罷免門檻尚未達成。${need}`);
              return;
            }

            // 直接一擊必殺（不再扣掉累積票）
            this.updateUI();
            this.sfx?.('hit');
            await this.speakAsync('罷免成功！蟑螂王下台。');

            this.state.k5HP = 0;
            this._onBossDefeated();
            return;
          }
        } // ← 關閉 ["vote","cat","recall"] 特例分支

        // —— 其餘武器（fire/spray/slipper/bait）仍走原彈藥檢查 —— //
        if ((P.weaponUsage[S.weapon] || 0) <= 0) { this.speak("武器數量用完。"); return; }

        // 扣彈
        P.weaponUsage[S.weapon]--;
        this.updateUI();

        // —— 命中判定（同格 + 弱點相符）—— //
        if (onSame) {
          const eff = Array.isArray(B.weaknesses) && B.weaknesses.includes(S.weapon);
          if (eff) {
            this.sfx('hit');
            await this.speakAsync(`${B.name} 被打中了！`);

            // 只補當前武器，但不把「這一發」補回
            const rw = B.reward || {};
            const used = S.weapon;
            let ammoGain = rw[used] || 0;
            if (ammoGain > 0) ammoGain = Math.max(0, ammoGain - 1);

            P.hp    += (rw.hp    || 0);
            P.coins += (rw.coins || 0);
            P.weaponUsage[used] = Math.min(MAX_AMMO, (P.weaponUsage[used] || 0) + ammoGain);
            this.updateUI();

              // ★ 在這裡通知共用出怪指揮官
            window.dispatchEvent(new CustomEvent('bug-killed'));

            // 計數
            S.killsThisLevel++;
            S.perKindKills[B.id] = (S.perKindKills[B.id] || 0) + 1;

            // 清掉這隻 & 清倒數
            if (this._bugTTL)     { clearTimeout(this._bugTTL);     this._bugTTL = null; }
            if (this._bugTTLWarn) { clearTimeout(this._bugTTLWarn); this._bugTTLWarn = null; }
            S.bug = null;

            this.build();

            const passed = await this._checkLevelClearAndAdvance();
            if (passed) return;

            return;

          } else {
            // 同格但不是弱點 → 「武器無效」且不反擊
            this.speak("武器無效，蟑螂嘲笑你！");
            return;
          }
        }

        // —— 沒打中：蟑螂反擊 —— //
        B.attackCount = (B.attackCount || 0) + 1;
        const dmg = B.damage || { hp: 1, coins: 0 };
        P.hp    = Math.max(0, P.hp    - (dmg.hp    || 0));
        P.coins = Math.max(0, P.coins - (dmg.coins || 0));

        if (P.hp <= 0 || (B.id === "k5" && B.attackCount >= 5)) {
          this.speak("你輸了！蟑螂大軍全面佔領你家。");
          setTimeout(() => location.href = "lose.html", 1200);
          return;
        }

        this.sfx('miss');
        await this.speakAsync(`沒打中！${B.name} 反擊造成損失。`);

        // ★ 改成共用檢查
        if (this.applyPenalty(dmg)) return;

        this.updateUI();
        this.build();

      } catch (err) {
        console.error("[attack] 例外：", err);
      } finally {
        clearTimeout(watchdog);
        S.isResolving = false;
      }
    },  // ←←← 這個逗號很重要！attack 方法在這裡結束

        // —— 判定是否過關（統一小寫比對；無 targets 則用 killTarget） —— //
    _checkLevelClearAndAdvance: async function () {
      const S = this.state;
      const Traw = this.cfg?.targets || {};
      // 全部轉小寫鍵
      const T = Object.fromEntries(
        Object.entries(Traw).map(([k, v]) => [String(k).toLowerCase(), Number(v)||0])
      );

      let cleared = false;

      if (Object.keys(T).length) {
        // 逐項比對
        cleared = Object.keys(T).every(k => (S.perKindKills[k] || 0) >= T[k]);
      } else {
        // 沒設定 targets → 用 killTarget
        const need = Number(this.cfg?.killTarget || 0);
        cleared = need > 0 ? (S.killsThisLevel >= need) : false;
      }

      if (!cleared) {
        // 可選：提示還缺多少（除錯好用；正式要關掉可以註解）
        const remainText = Object.keys(T).map(k => {
          const have = S.perKindKills[k] || 0;
          const need = T[k];
          const left = Math.max(0, need - have);
          return left > 0 ? `${k.toUpperCase()} 還差 ${left}` : null;
        }).filter(Boolean).join("、");
        if (remainText) {
          console.debug(`[L${S.level}] 尚未過關：${remainText}`);
          // 想語音提示可以開這行：
          // this.speak(`還沒達標，${remainText}。`);
        }
        return false;
      }

      // —— 過關收尾（和你原本邏輯一致）——
      if (this._bugTTL)     { clearTimeout(this._bugTTL);     this._bugTTL = null; }
      if (this._bugTTLWarn) { clearTimeout(this._bugTTLWarn); this._bugTTLWarn = null; }

      if (window.MULTI_PAGE_MODE) {
        if (S.level >= 5) {
          this.speak("恭喜全數破關！");
          setTimeout(() => location.href = "win.html", 1200);
        } else {
          const nxt = S.level + 1;
          this.speak(`前往第 ${nxt} 關介紹頁`);
          setTimeout(() => location.href = `level_intro_0${nxt}.html`, 1000);
        }
      } else {
        this.speak("過關！");
      }
      return true;
    },

    scanArea() {
      const B = this.state.bug;
      if (!B) {
        this.speak("目前沒有蟑螂。");
        return;
      }
      this.speak(`${B.name} 在 ${this.posToSpeech()}`);
    },

    // —— 由問答（或其它機制）結算當前蟑螂 —— //
    async resolveQuizOutcome(r){
      const S = this.state, P = S.player, B = S.bug;
      if (!B) return;

      if (r?.correct) {
        // 視覺/語音
        this.sfx('hit');
        await this.speakAsync(`${B.name} 被你收服！`);

        // 獎勵：加幣（以及你想要的其它獎勵）
        const gain = Number(r.points || 0) || 10;
        P.coins = (P.coins || 0) + gain;

        // 清倒數（主/預警）與標記
        if (this._bugTTL)     { clearTimeout(this._bugTTL);     this._bugTTL = null; }
        if (this._bugTTLWarn) { clearTimeout(this._bugTTLWarn); this._bugTTLWarn = null; }
        this._bugTTLDueAt = this._bugTTLWarnDueAt = null;
        this._bugTTLRemain = this._bugTTLWarnRemain = null;

        this._checkRecallGate();

        // 計數
        S.killsThisLevel++;
        S.perKindKills[B.id] = (S.perKindKills[B.id] || 0) + 1;

        // 清場並更新
        S.bug = null;
        this.updateUI();
        this.build();

        const passed = await this._checkLevelClearAndAdvance();
        if (passed) return;

        // 沒過關 → 延遲再生下一隻
        await this.wait(this.cfg?.spawnDelayMs || 800);
        this.spawnBug();
        return;
      }

      // —— 答錯：套懲罰、維持這隻蟑螂在場（TTL 會在 resume 後繼續） —— //
      const p = r?.penalty || { hp:0, coins:0 };
      this.sfx('miss');
      await this.speakAsync('答錯，受到懲罰！');
      if (this.applyPenalty(p)) return; // 掉到 0 就直接結束
      this.build();
    },

    // —— 位置轉語音（lane：第 N 格；grid：第 X 行，第 Y 列） —— //
    posToSpeech() {
      const S = this.state, B = S.bug;
      if (!B) return "";
      if (!("pos" in B) || B.pos == null) {
        if (S.mode === "grid") {
          const { cols, rows } = S.grid || { cols: 3, rows: 3 };
          B.pos = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
        } else {
          const N = S.positions || 7;
          B.pos = Math.floor(Math.random() * N);
        }
      }
      return (S.mode === "grid")
        ? `第 ${B.pos.x + 1} 行，第 ${B.pos.y + 1} 列`
        : `第 ${B.pos + 1} 格`;
    },

    // —— 小工具：隨機找一個沒被佔用的格子 —— //
    _randFreePos() {
      const s = this.state;
      const { cols, rows } = s.grid || { cols: 3, rows: 3 };

      const collide = (x, y) =>
        (x === s.gridPos.x && y === s.gridPos.y) ||                                   // 玩家
        (s.bug && s.bug.pos && x === s.bug.pos.x && y === s.bug.pos.y) ||             // 蟑螂
        ((s.hazards || []).some(h => h.alive && h.x === x && h.y === y)) ||
        isBlockedOrTV(this, x, y);             // ★ 避開家具/電視區

      let guard = 100;
      while (guard-- > 0) {
        const x = Math.floor(Math.random() * cols);
        const y = Math.floor(Math.random() * rows);
        if (!collide(x, y)) return { x, y };
      }
      // 實在找不到就回傳一個隨機點（而不是固定角落）
      return { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
    },
    _nearestFreePos(from = this.state.gridPos){
      const { cols, rows } = this.state.grid || { cols:3, rows:3 };
      const cells = [];
      for (let y=0; y<rows; y++){
        for (let x=0; x<cols; x++){
          if (isBlockedOrTV(this, x, y)) continue;                    // 避開家具/電視區
          if (x === from.x && y === from.y) continue;                 // 避開當前點
          // 也可避開現有蟑螂與陷阱
          if (this.state.bug?.pos && this.state.bug.pos.x === x && this.state.bug.pos.y === y) continue;
          if ((this.state.hazards||[]).some(h => h.alive && h.x===x && h.y===y)) continue;
          const d = Math.abs(x - from.x) + Math.abs(y - from.y);
          cells.push({x,y,d});
        }
      }
      cells.sort((a,b)=> a.d - b.d);
      return cells[0] ? {x:cells[0].x, y:cells[0].y} : this._randFreePos();
    },
        // 讀 bugs.js 定義
    _bugDef(kind /* 'k1'..'k5' */){
      return (window.bugs || []).find(b => b.id === kind) || null;
    },

    // 清掉當前這隻（與你現有 TTL 配合）
    _despawnCurrentBug(){
      const S = this.state;
      if (this._bugTTL)     { clearTimeout(this._bugTTL);     this._bugTTL = null; }
      if (this._bugTTLWarn) { clearTimeout(this._bugTTLWarn); this._bugTTLWarn = null; }
      S.bug = null;
      // 如你有 activeRoaches 陣列/DOM，可在這裡一併處理
    },

    // 是否達成罷免門檻（讀 RECALL_TARGET 與 this.state.voteBought）
    _isRecallAchieved(){
      const v = this.state.voteBought || { k1:0, k2:0, k3:0 };
      const T = (typeof RECALL_TARGET !== 'undefined') ? RECALL_TARGET
              : (this.cfg?.recallTarget /* 可選的舊相容 */) || { k1:20, k2:10, k3:5 };
      return (v.k1 >= T.k1) && (v.k2 >= T.k2) && (v.k3 >= T.k3);
    },

    // 產生門檻提示字串（給沒達標時友善提示）
    _recallNeedText(){
      const v = this.state.voteBought || { k1:0, k2:0, k3:0 };
      const T = (typeof RECALL_TARGET !== 'undefined') ? RECALL_TARGET
              : (this.cfg?.recallTarget) || { k1:20, k2:10, k3:5 };
      const r1 = Math.max(0, T.k1 - (v.k1||0));
      const r2 = Math.max(0, T.k2 - (v.k2||0));
      const r3 = Math.max(0, T.k3 - (v.k3||0));
      return `尚需 K1：${r1}、K2：${r2}、K3：${r3}`;
    },

    savePlayer() {
      try {
        localStorage.setItem("bugSlayerPlayer", JSON.stringify(this.state.player));
      } catch (e) {
        console.warn("[savePlayer] 無法寫入 localStorage：", e);
      }
    },

        // —— 扣血/扣錢並檢查是否戰敗 —— //
    applyPenalty(dmg = { hp:0, coins:0 }, speakOnLose = true) {
      const P = this.state.player;
      const hpLoss    = Math.max(0, dmg.hp    || 0);
      const coinsLoss = Math.max(0, dmg.coins || 0);

      if (hpLoss)    P.hp    = Math.max(0, (P.hp    || 0) - hpLoss);
      if (coinsLoss) P.coins = Math.max(0, (P.coins || 0) - coinsLoss);

      this.updateUI();

      if (P.hp <= 0) {
        if (speakOnLose) this.speak("你輸了！蟑螂們全面佔領你家。");
            // ★ 先把當前剩餘資源寫回 localStorage
        this.savePlayer();

        // ★ 帶上目前關卡編號，給 lose.html 判斷要重試哪關
        setTimeout(() => {
          const lv = this.state.level;
          location.href = `lose.html?level=${lv}`;
        }, 1200);
        return true; // 已經戰敗
      }
      return false;   // 還活著
    },

    _checkRecallGate(){
      const v = this.state.voteBought || { k1:0, k2:0, k3:0 };
      const T = (typeof RECALL_TARGET !== 'undefined') ? RECALL_TARGET
              : (this.cfg?.recallTarget) || { k1:20, k2:10, k3:5 };

      const ok = (v.k1 >= T.k1) && (v.k2 >= T.k2) && (v.k3 >= T.k3);
      const before = !!this.state.recallReady;
      this.state.recallReady = ok;

      if (!before && ok) {
        this.sfx('warn');
        this.speak('罷免條件已達成！切換到罷免武器，對準蟑螂王。');
      }
      // ⚠️ 不要在這裡呼叫 updateUI()，避免互相遞迴
    },

    _onBossDefeated(){
      // 清除現場蟑螂與計時器
      if (this._bugTTL)     { clearTimeout(this._bugTTL);     this._bugTTL = null; }
      if (this._bugTTLWarn) { clearTimeout(this._bugTTLWarn); this._bugTTLWarn = null; }
      this.state.bug = null;

        // ★ 把當下剩餘（HP / 金幣 / 彈藥 / 罷免票…）存回去
      this.savePlayer();

      if (window.MULTI_PAGE_MODE) {
        this.speak('恭喜全數破關！');
        setTimeout(() => location.href = 'win.html', 1200);
      } else {
        this.speak('勝利！王者倒下。');
      }
    },

    /* ====== K4 出題不重覆：共用機制（跨關卡/跨頁） ====== */

    // 1) 讀/寫 localStorage 中的「已使用題目鍵」集合
    _loadUsedQuizSet() {
      try {
        if (!this._usedQuizSet) {
          const raw = localStorage.getItem('usedQuizKeys') || '[]';
          this._usedQuizSet = new Set(JSON.parse(raw));
        }
      } catch (_) {
        this._usedQuizSet = new Set();
      }
      return this._usedQuizSet;
    },
    _saveUsedQuizSet() {
      try {
        const arr = Array.from(this._loadUsedQuizSet());
        localStorage.setItem('usedQuizKeys', JSON.stringify(arr));
      } catch (_) {}
    },

    // 2) 生成一個穩定的 key：用 prefix 區分題型/來源，避免跟別的系統衝到
    _quizKey(prefix, q) {
      // 題目物件需有穩定 id（建議你的題庫都有 id）；
      // 若沒有 id，就用內容 hash（簡化：取前 40 字做 key）
      const id = (q && (q.id || q.qid || q.key)) ? (q.id || q.qid || q.key) : String(q?.text || q?.title || '').slice(0, 40);
      return `${prefix}:${id}`;
    },

    // 3) 從題庫 pool 挑一題「尚未使用」的；若都用過了，保險起見允許重置或回傳 null
    _pickUniqueQuestion(pool = [], { prefix = 'k4', allowResetWhenExhausted = true } = {}) {
      const used = this._loadUsedQuizSet();

      // 先過濾掉已使用的
      const fresh = pool.filter(q => !used.has(this._quizKey(prefix, q)));

      if (fresh.length > 0) {
        // 可再加隨機化
        const idx = Math.floor(Math.random() * fresh.length);
        return fresh[idx];
      }

      // 題庫全用過了：通常你說題庫會一直增加，所以理論上不會走到這裡
      // 但為了不讓遊戲卡住，提供一個保險：重置或回傳 null。
      if (allowResetWhenExhausted) {
        console.warn('[quiz] 題庫已用盡，重置 usedQuizKeys（保險機制）');
        this._usedQuizSet = new Set();
        this._saveUsedQuizSet();
        // 重置後再挑一次
        return this._pickUniqueQuestion(pool, { prefix, allowResetWhenExhausted: false });
      }
      return null;
    },

    // 4) 標記某題已使用
    _markQuestionUsed(prefix, q) {
      const used = this._loadUsedQuizSet();
      used.add(this._quizKey(prefix, q));
      this._saveUsedQuizSet();
    },

    // 5) （可選）重置所有已用題（例如在新遊戲、重開機制時呼叫）
    resetAllQuizUsed() {
      this._usedQuizSet = new Set();
      this._saveUsedQuizSet();
      console.info('[quiz] 已清空使用紀錄');
    },

    // —— UI 同步 —— //
    updateUI() {
      const P = this.state.player;
      const w = this.state.weapon;

        // 每次更新時做一次門檻檢查，保持燈號最新
      if (typeof this._checkRecallGate === 'function') this._checkRecallGate();

      // 狀態列：對 cat/vote/recall 顯示特別資訊
      if (this.dom.status) {
        let right = '';
        if (w === 'cat') {
          right = this.state.catOwned ? `（已領養）` : `（未領養）`;
        } else if (w === 'recall') {
          right = this.state.recallReady ? `（可發動）` : `（未就緒）`;
        } else if (w === 'vote') {
          // 票制是用金幣；實際價格依目標蟑螂而定，這裡給提示字
          right = `（用金幣換票）`;
        } else {
          right = `｜剩餘次數：${P.weaponUsage[w] || 0}`;
        }
        this.dom.status.textContent = `武器：${this.getWeaponName(w)} ${right}`;
      }

      // 基本數值
      const hpEl   = document.getElementById("playerHP");
      const coinEl = document.getElementById("playerCoins");
      const nameEl = document.getElementById("playerName");
      if (hpEl)   hpEl.textContent   = P.hp;
      if (coinEl) coinEl.textContent = P.coins;
      if (nameEl) nameEl.textContent = P.name;

      // 票制顯示（若網頁有這些節點就更新）
      const votesEl = document.getElementById("recallVotes");
      const vk1El   = document.getElementById("voteBoughtK1");
      const vk2El   = document.getElementById("voteBoughtK2");
      const vk3El   = document.getElementById("voteBoughtK3");
      if (votesEl) votesEl.textContent = this.state.votes || 0;
      if (vk1El)   vk1El.textContent   = this.state.voteBought?.k1 ?? 0;
      if (vk2El)   vk2El.textContent   = this.state.voteBought?.k2 ?? 0;
      if (vk3El)   vk3El.textContent   = this.state.voteBought?.k3 ?? 0;

      // 儲存
      this.savePlayer();

      // SR 報讀（把票制也講清楚）
      const sr = document.getElementById("srStatus");
      if (sr) {
        let extra = '';
        if (w === 'cat')    extra += this.state.catOwned ? '，已領養貓咪' : '，尚未領養貓咪';
        if (w === 'recall') extra += this.state.recallReady ? '，罷免可用' : '，罷免未就緒';

        const left = P.weaponUsage[w] || 0;
        const usageText = (w==='cat' || w==='vote' || w==='recall') ? '' : `，可用次數 ${left} 次`;

        const v  = this.state.votes || 0;
        const vb = this.state.voteBought || {k1:0,k2:0,k3:0};
        const voteText = `，累積選票 ${v}（K1 ${vb.k1}，K2 ${vb.k2}，K3 ${vb.k3}）`;

        sr.textContent = `玩家 ${P.name}，血量 ${P.hp}，金幣 ${P.coins}，目前武器 ${this.getWeaponName(w)}${usageText}${extra}${voteText}。`;
      }
    },
    // 是否為不可通行格（家具/TV 區）
    isBlockedCell(x, y) {
      const obs = this.cfg?.obstacles || [];
      const tvs = this.cfg?.weaponForbiddenZones || [];
      const inRect = (x,y,r) => x>=r.x1 && x<=r.x2 && y>=r.y1 && y<=r.y2;
      return obs.some(r => inRect(x,y,r)) || tvs.some(r => inRect(x,y,r));
    },

    getWeaponName(t) {
      return t === "fire" ? "噴火槍"
           : t === "spray" ? "香氛噴霧"
           : t === "slipper" ? "藍白拖"
           : t === "bait"    ? "毒餌"
           : t === "cat"    ? "養貓"
           : t === "vote"    ? "罷免連署"
           : t === "recall"    ? "發動罷免"
           : "未知";
    },
  };

  // —— 對外 API（給 boot 檔與 HTML 按鈕） —— //
  g.Core = Core;
  g.game = Core;  // ★ 讓外部可以用 window.game 取得 Core 單例

  g.moveLeft  = () => Core.moveBy(-1, 0);
  g.moveRight = () => Core.moveBy( 1, 0);
  g.moveUp    = () => Core.moveBy(0, -1);
  g.moveDown  = () => Core.moveBy(0,  1);

  g.scanArea  = () => {
    const B = Core.state.bug;
    if (!B) { Core.speak("目前沒有蟑螂。"); return; }
    Core.speak(`${B.name} 在 ${Core.posToSpeech()}`);
  };

  g.attack = () => Core.attack();

  g.changeWeapon = (t) => {
    Core.state.weapon = t;
    const key = t === "fire"    ? "select_fire"
             : t === "spray"   ? "select_spray"
             : t === "slipper" ? "select_slipper"
             : t === "bait"    ? "select_bait"
             : t === "cat"     ? "select_cat"
             : t === "vote"    ? "select_vote"
             : t === "recall"  ? "select_recall"
             : null;
    if (key) Core.sfx(key);
    Core.speak(`${Core.getWeaponName(t)}。`);
    Core.updateUI();
      // ★ 若切到養貓且尚未領養 → 直接開視窗（鍵盤按 5 也會觸發）
    if (t === 'cat' && !Core.state.catOwned) {
      g.openCatPicker();
    }
  };

      // —— 題目挑選/標記（提供給 k4_dialog / quiz 使用） —— //
    g.pickK4Question = (questionPool) => {
      // 你可以在這裡先做洗牌、過濾難度等等，再交給 Core
      return Core._pickUniqueQuestion(questionPool, { prefix: 'k4' });
    };
    g.markK4Used = (questionObj) => {
      Core._markQuestionUsed('k4', questionObj);
    };

    // 若未來還有別型題庫（例如 boss 問答），你可以用不同 prefix：
    // g.pickBossQuestion = (pool) => Core._pickUniqueQuestion(pool, { prefix:'boss' });
    // g.markBossUsed     = (q)    => Core._markQuestionUsed('boss', q);

    // （可選）提供一個重置
    g.resetAllQuizUsed = () => Core.resetAllQuizUsed();

    // —— L5：養貓相關對外 API —— //
    g.openCatPicker = () => {
      const d = document.getElementById('catDialog');
      if (!d) { Core.speak('此關未提供養貓視窗。'); return; }

      // ★ 暫停所有倒數/移動（蟑螂 TTL、預警、菜籃車等）
      Core.pauseTimer?.();

      d.classList.remove('sr-only');
      d.removeAttribute('hidden');
      d.setAttribute('aria-hidden', 'false');
      document.getElementById('catPanel')?.focus();
      document.getElementById('srStatus')?.replaceChildren(document.createTextNode('開啟養貓視窗。'));
    };

    g.closeCatPicker = () => {
      const d = document.getElementById('catDialog');
      if (!d) return;

      // 先把焦點移到狀態欄（或其他可聚焦元素）
      document.getElementById('srStatus')?.focus?.();

      d.classList.add('sr-only');
      d.setAttribute('hidden','');
      d.setAttribute('aria-hidden', 'true');
      document.getElementById('srStatus')?.replaceChildren(document.createTextNode('關閉養貓視窗。'));

      // ★ 關閉後再恢復所有倒數/移動
      Core.resumeTimer?.();
    };

  // catId 可傳 'cat_01' 或 'cat_01.png' 皆可
  g.adoptCat = (catId) => {
    const P = Core.state.player;
    // L5 常數保險（若你上方已宣告 L5 會直接用；否則 fallback）
    const cost = (typeof L5 !== 'undefined' && L5?.catAdoptCost) ? L5.catAdoptCost : 200;

    if (Core.state.catOwned) { Core.speak('已經有貓咪啦。'); g.closeCatPicker(); return; }
    if ((P.coins || 0) < cost) { Core.speak(`金幣不足，需要 ${cost}。`); return; }

    P.coins -= cost;
    Core.state.catOwned = true;

    const nameMap = {
      'cat_01':'白貓北下閜',
      'cat_02':'虎斑阿后',
      'cat_03':'黑貓歐罵瑪',
      'cat_04':'三花貓五告揮',
      'cat_05':'麒麟尾暹邏貓帕嘎抓'
    };
    // 正規化：取出 cat_XX
    const k = String(catId || '').match(/cat_\d{2}/)?.[0] || 'cat_01';
    Core.state.catName = nameMap[k] || '喵戰友';

    Core.updateUI();
    Core.savePlayer();
    Core.speak(`養貓成功，${Core.state.catName} 加入戰鬥！`);
    g.closeCatPicker();
    g.changeWeapon('cat');
  };

})(window);
