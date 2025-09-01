// A11YArbiter v1.0 — 專治 SR 狀態洗頻 & 和 TTS 搶話
// 把「血量/金幣/武器」的 SR 報讀做合併＋節流，並避開 TTS 與生怪半拍。
// 用法：A11YArbiter.install({ ...options })
;(function(global){
  "use strict";

  const defaults = {
    // 必填：三個數值的元素（textContent 會被念）
    hpEl: null,          // e.g. document.getElementById('playerHP')
    coinEl: null,        // e.g. document.getElementById('playerCoins')
    wpnEl: null,         // e.g. document.getElementById('weaponStatus')
    srEl: null,          // e.g. document.getElementById('srStatus') (role="status" aria-live="polite")

    // 時序參數（可按關卡節奏微調）
    coolDownMs: 1200,    // 兩次播報的最短間隔，避免洗頻
    quietNeedMs: 400,    // 需要偵測到安靜這麼久才播
    checkInterval: 200,  // 輪詢安靜狀態的間隔

    // TTS 是否忙碌？預設讀 Core._speechDepth
    ttsBusyFn: function(){
      try { return (global.Core && typeof Core._speechDepth === 'number' && Core._speechDepth > 0); }
      catch(_) { return false; }
    },

    // 生怪時呼叫 noteSpawn()，或讓本模組自動 patch Core.spawnBug
    autoPatchSpawn: true,

    // 如何組合要念的文字（可依語言習慣客製）
    buildStatusText: function(hpText, coinText, wpnText){
      const hp = (hpText||'').trim();
      const cn = (coinText||'').trim();
      const wp = (wpnText||'').trim();
      return `狀態更新：血量 ${hp}。金幣 ${cn}。${wp}`;
    },
  };

  function Install(opts){
    const cfg = Object.assign({}, defaults, opts||{});
    const { hpEl, coinEl, wpnEl, srEl } = cfg;
    if(!hpEl || !coinEl || !wpnEl || !srEl){
      throw new Error('[A11YArbiter] 缺少必要元素：hpEl / coinEl / wpnEl / srEl');
    }
    // 強化 srEl
    srEl.setAttribute('aria-live','polite');
    srEl.setAttribute('aria-atomic','true');

    let lastAnnounceAt = 0;
    let pendingText = '';
    let timer = null;
    let lastSpawnAt = 0;

    function now(){ return Date.now(); }
    function scheduleTick(){
      if(timer) return;
      timer = setTimeout(function tick(){
        // 間隔不足 → 延後
        if(now() - lastAnnounceAt < cfg.coolDownMs){ timer = setTimeout(tick, cfg.checkInterval); return; }
        // 生怪剛發生 → 讓出半拍
        if(now() - lastSpawnAt < cfg.quietNeedMs){   timer = setTimeout(tick, cfg.checkInterval); return; }
        // TTS 忙碌 → 等安靜
        if(cfg.ttsBusyFn()){                         timer = setTimeout(tick, cfg.checkInterval); return; }
        // 播報（交給 aria-live）
        srEl.textContent = pendingText;
        lastAnnounceAt = now();
        pendingText = '';
        clearTimeout(timer); timer = null;
      }, cfg.checkInterval);
    }

    function scheduleAnnounce(){
      const text = cfg.buildStatusText(hpEl.textContent, coinEl.textContent, wpnEl.textContent);
      pendingText = text; // 合併覆蓋，永遠念最新
      scheduleTick();
    }

    // 監控三個數值的變化
    const mo = new MutationObserver(scheduleAnnounce);
    [hpEl, coinEl, wpnEl].forEach(el=>{
      if(el) mo.observe(el, { childList:true, characterData:true, subtree:true });
    });

    // 可選：自動攔 Core.spawnBug 以標記生怪時間（避開出場/座標 TTS）
    if(cfg.autoPatchSpawn && global.Core && typeof Core.spawnBug === 'function' && !Core.__a11yArbiterPatched){
      const orig = Core.spawnBug.bind(Core);
      Core.spawnBug = function(){
        api.noteSpawn();
        return orig();
      };
      Core.__a11yArbiterPatched = true;
    }

    // 對外 API
    const api = {
      // 通知「剛要生怪」：避開這段時間
      noteSpawn(){ lastSpawnAt = now(); },
      // 立即排程一次（例如 Shift+S 重唸）
      poke(){ scheduleAnnounce(); },
      // 銷毀（切關或卸載）
      destroy(){
        try{ mo.disconnect(); }catch(_){}
        if(timer){ clearTimeout(timer); timer=null; }
      }
    };
    return api;
  }

  // 暴露
  global.A11YArbiter = {
    install: Install
  };
})(window);
