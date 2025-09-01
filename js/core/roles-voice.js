// js/core/roles-voice.js
(function (w) {
  const VOICE_ROOT = (w.ASSETS_ROOT || "") + "assets/sounds/roles/";

  // 預設中文名 → MP3 對照；你也可以在外部 window.ROLE_VOICES 覆蓋
  const DEFAULT_ROLE_VOICES = {
    "金巴":        VOICE_ROOT + "kinbah.mp3",
    "麥拉":        VOICE_ROOT + "mailah.mp3",
    "考盃":        VOICE_ROOT + "khaupe.mp3",
    "赫拉":        VOICE_ROOT + "holah.mp3",
    "金．艾捆":    VOICE_ROOT + "chinaikhun.mp3",
    "郊．萊北":    VOICE_ROOT + "chiaulaipeh.mp3",
  };

  // 若你用檔名辨識（ex: <img src=".../kinbah.png">）
  const FILE_TO_NAME = {
    "kinbah": "金巴",
    "mailah": "麥拉",
    "khaupe": "考盃",
    "holah": "赫拉",
    "chinaikhun": "金．艾捆",
    "chiaulaipeh": "郊．萊北",
  };

  let ROLE_VOICES = { ...(w.ROLE_VOICES || DEFAULT_ROLE_VOICES) };

  function setVoices(map) {
    if (map && typeof map === "object") ROLE_VOICES = { ...map };
  }

  // ==== Audio / TTS 基礎 ====
  function getVoiceAudio() {
    let a = document.getElementById("voicePlayer");
    if (!a) {
      a = document.createElement("audio");
      a.id = "voicePlayer";
      a.hidden = true;
      document.body.appendChild(a);
    }
    return a;
  }

  function speakTTS(text) {
    if (!text || !("speechSynthesis" in w)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-TW";
      u.rate = 1.5; u.pitch = 1.0; u.volume = 1.0;
      w.speechSynthesis.cancel();
      w.speechSynthesis.speak(u);
    } catch(_) {}
  }

  async function play(name, { fallbackTTSText = "" } = {}) {
    try { w.speechSynthesis?.cancel(); } catch(_) {}
    const src = ROLE_VOICES[name];
    if (!src) { if (fallbackTTSText) speakTTS(fallbackTTSText); return false; }

    const a = getVoiceAudio();
    try {
      a.pause(); a.currentTime = 0; a.src = src;
      await a.play();
      return true;
    } catch(_) {
      if (fallbackTTSText) speakTTS(fallbackTTSText);
      return false;
    }
  }

  // ==== 名稱推斷 ====
  function inferNameFromCard(el) {
    // 1) data-role-name 優先
    const byData = el?.getAttribute?.("data-role-name");
    if (byData) return byData.trim();

    // 2) .role-name 文字
    const label = el?.querySelector?.(".role-name")?.textContent;
    if (label && label.trim()) return label.trim();

    // 3) 從 img 檔名推測
    const src = el?.querySelector?.("img")?.getAttribute?.("src") || "";
    const base = src.split(/[\\/]/).pop()?.replace(/\.(png|jpg|jpeg|webp|gif)$/i, "");
    if (base && FILE_TO_NAME[base]) return FILE_TO_NAME[base];

    return "";
  }

  // ==== 綁定卡片 ====
  function init({
    selector = ".role-card",
    hover = true,
    focus = true,
    fallbackToTTS = true,
    debounceMs = 250,
    autoPrime = true,
  } = {}) {
    const cards = Array.from(document.querySelectorAll(selector));
    if (!cards.length) return;

    // 通過自動播放策略：第一次互動先啟動 audio
    if (autoPrime) {
      const prime = () => {
        const a = getVoiceAudio();
        a.play().catch(()=>{}); a.pause(); a.currentTime = 0;
        w.removeEventListener("click", prime, true);
        w.removeEventListener("keydown", prime, true);
        w.removeEventListener("touchstart", prime, true);
      };
      w.addEventListener("click", prime, { once: true, capture: true });
      w.addEventListener("keydown", prime, { once: true, capture: true });
      w.addEventListener("touchstart", prime, { once: true, capture: true, passive: true });
    }

    let last = 0;
    const tryPlayFor = (el) => {
      const now = performance.now();
      if (now - last < debounceMs) return;
      last = now;

      const name = inferNameFromCard(el);
      const tts = fallbackToTTS ? (name || "") : "";
      play(name, { fallbackTTSText: tts });
    };

    cards.forEach(el => {
      if (focus)  el.addEventListener("focus",      () => tryPlayFor(el));
      if (hover)  el.addEventListener("mouseenter", () => tryPlayFor(el));
      // 需要點擊再播一次可加：
      // el.addEventListener("click", () => tryPlayFor(el));
    });
  }

  // ==== 預載並列出缺檔（開發用） ====
  async function preload({ logMissing = true } = {}) {
    const entries = Object.entries(ROLE_VOICES);
    for (const [name, url] of entries) {
      try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!res.ok && logMissing) console.warn("[roles-voice] 檔案不存在：", name, url);
      } catch (e) {
        if (logMissing) console.warn("[roles-voice] 載入失敗：", name, url);
      }
    }
  }

  w.RolesVoice = { init, play, preload, setVoices };
})(window);
