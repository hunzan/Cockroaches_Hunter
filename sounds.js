// /sounds.js
// 目的：保持原本 window.SOUNDS 介面不變，但自動優先用 .ogg，失敗再用 .mp3
// 作法：每一個音效路徑變成一個「SoundRef」物件，會在需要字串時自動轉成最佳格式。
// 例如：audio.src = SOUNDS.sfx.fire  // 會自動得到 '.../firegun.ogg'（若支援），否則 '.../firegun.mp3'

(function(){
  // 檢查瀏覽器對音訊格式支援度（不做 UA 偵測）
  const probe = (() => {
    const el = document.createElement('audio');
    return {
      ogg: !!el.canPlayType && el.canPlayType('audio/ogg; codecs="vorbis"') !== '',
      mp3: !!el.canPlayType && el.canPlayType('audio/mpeg') !== '',
    };
  })();

  // 小工具：把 *.mp3 轉成 base（去掉副檔名）
  const stripExt = (p) => p.replace(/\.(mp3|ogg)$/i, '');

  // 可同時帶多個「基底檔名」（用來容錯 cockroach/cockrach）
  class SoundRef {
    constructor(baseNames /* string[]，不含副檔名 */){
      this.baseNames = Array.isArray(baseNames) ? baseNames : [baseNames];
    }
    // 產生候選清單（優先 ogg，再來 mp3；同一個音檔可有多個基底名稱以容錯）
    candidates(){
      const out = [];
      for(const base of this.baseNames){
        if (probe.ogg) out.push(`${base}.ogg`);
        if (probe.mp3) out.push(`${base}.mp3`);
      }
      // 若什麼都不支援，至少回傳 mp3（大多環境都可）
      if (!out.length) this.baseNames.forEach(b => out.push(`${b}.mp3`));
      return out;
    }
    // 最佳單一路徑（字串情境自動呼叫）
    toString(){ return this.best(); }
    valueOf(){ return this.best(); }
    best(){ return this.candidates()[0]; }
  }

  // 建立 SoundRef：輸入「含副檔名 mp3 的既有路徑」或「多個可能檔名」
  function sound(pathOrPaths){
    if (Array.isArray(pathOrPaths)){
      // 多個完整路徑：先都 strip，再包裝
      const bases = pathOrPaths.map(stripExt);
      return new SoundRef(bases);
    }else{
      return new SoundRef(stripExt(pathOrPaths));
    }
  }

  // ==== 你的原本結構（保留不變）但值改為 SoundRef（自動做 ogg→mp3 回退） ====
  // 特別處理：fly 檔名常見拼錯，容錯成兩種拼法都試
  const FLY_BASES = [
    'assets/sounds/cockroach_fly', // 正確拼法
    'assets/sounds/cockrach_fly',  // 你的專案樹中疑似舊檔名（少了 'o'）
  ];

  // 如果你有「蟑螂語音」這類以 id 組成檔名的函式，也改成回傳 SoundRef
  function bugIntroRef(id){ return sound(`assets/sounds/${id}_intro.mp3`); }
  function bugHitRef(id){   return sound(`assets/sounds/${id}_hit.mp3`);   }

  window.SOUNDS = {
    bgm: {
      index:    sound('assets/sounds/start_theme.mp3'),
      tutorial: sound('assets/sounds/tutorial_theme.mp3'),
      game: {
        1: sound('assets/sounds/game_01.mp3'),
        2: sound('assets/sounds/game_02.mp3'),
        3: sound('assets/sounds/game_03.mp3'),
        4: sound('assets/sounds/game_04.mp3'),
        5: sound('assets/sounds/game_05.mp3'),
      }
    },
    sfx: {
      fire:    sound('assets/sounds/firegun.mp3'),
      spray:   sound('assets/sounds/spray.mp3'),
      slipper: sound('assets/sounds/slipper.mp3'),
      miss:    sound('assets/sounds/miss.mp3'),
      fly:     sound(FLY_BASES.map(b => `${b}.mp3`)), // 兩種拼法都容錯，且會優先轉為 .ogg
    },
    // 這兩個維持你的原本 API 型態（函式），但回傳 SoundRef
    bugIntro: bugIntroRef,
    bugHit:   bugHitRef,
  };

  // === 進階：若你在別處需要「候選清單」（例如 WebAudio 逐一嘗試），提供工具：
  window.SOUNDS_CANDIDATES = {
    sfx(name){
      const ref = window.SOUNDS?.sfx?.[name];
      return ref?.candidates ? ref.candidates() : [String(ref || '')];
    },
    bgm(keyOrLevel){
      // key: 'index' | 'tutorial' | {level}
      if (typeof keyOrLevel === 'string'){
        const ref = window.SOUNDS?.bgm?.[keyOrLevel];
        return ref?.candidates ? ref.candidates() : [String(ref || '')];
      }else{
        const ref = window.SOUNDS?.bgm?.game?.[Number(keyOrLevel)];
        return ref?.candidates ? ref.candidates() : [String(ref || '')];
      }
    },
    bugIntro(id){ return window.SOUNDS.bugIntro(id).candidates(); },
    bugHit(id){   return window.SOUNDS.bugHit(id).candidates();   }
  };

})();
