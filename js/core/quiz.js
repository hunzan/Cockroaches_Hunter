/* js/core/quiz.js — QuizEngine (keyboard-first, SR-friendly, TTS: question then choices) */
(function () {
  class QuizEngine {
    constructor({
      dataUrl,
      voiceLang = "zh-TW",
      enableTTS = true,
      readChoicesOnOpen = true,   // 開啟時朗讀選項
      speakOnSelect = true        // 變更選取時朗讀該選項
    } = {}) {
      this.dataUrl = dataUrl;
      this.voiceLang = voiceLang;
      this.enableTTS = enableTTS;
      this.readChoicesOnOpen = readChoicesOnOpen;
      this.speakOnSelect = speakOnSelect;
      this.bank = [];
      this._loaded = false;
      // === 外部整合 ===
      this._externalPreset = null;   // 透過事件傳進來的指定題
      this._idCounter = 1;           // 給沒有 id 的題目用
      this._voicesCached = null;     // (可選) 緩存語音
    }
        getPool() {
      if (!this._loaded) return this.bank || [];
      return this.bank || [];
    }

    async load() {
      if (!this.dataUrl) throw new Error("QuizEngine: dataUrl 未設定");
      const res = await fetch(this.dataUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("讀取題庫失敗: " + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("題庫必須是陣列");

      // 統一補上穩定 id
      const seen = new Set();
      const mkId = (q) => {
        const base = (q.id || q.qid || q.key ||
          (String(q.prompt || q.title || "").slice(0, 40)) ||
          ("q_" + (this._idCounter++)));
        let id = String(base).trim() || ("q_" + (this._idCounter++));
        // 確保唯一
        while (seen.has(id)) id = id + "_" + (this._idCounter++);
        seen.add(id);
        return id;
      };
      this.bank = data.map(q => ({ ...q, id: mkId(q) }));
      this._loaded = true;
      return this.bank.length;
    }

    async ask({ container = document.body, randomize = true, timeLimitSec = 0,
                presetQuestion = null, question = null, fixedQuestion = null,
                uniqueWithCore = true } = {}) {
      if (!this._loaded) await this.load();
      if (!this.bank.length) throw new Error("題庫為空");

      // 1) 指定題目優先
      let q = presetQuestion || question || fixedQuestion || this._externalPreset || null;

      // 2) 若未指定題目，且允許與 Core 整合，走 Core 的不重複挑選
      if (!q && uniqueWithCore && window.game &&
          typeof window.game._pickUniqueQuestion === 'function') {
        try {
          q = window.game._pickUniqueQuestion(this.bank, { prefix: 'k4' });
        } catch (_) { /* 忽略，退回隨機 */ }
      }

      // 3) 最後退回隨機
      if (!q) q = this.bank[(Math.random() * this.bank.length) | 0];

      // 4) 呈現並回傳結果
      const result = await this._present(container, q, { randomize, timeLimitSec });

      // 5) 自動標記已用（雙保險；k4_dialog 也會標一次）
      try {
        if (result?.question && (window.markK4Used || window.game?._markQuestionUsed)) {
          if (typeof window.markK4Used === 'function') {
            window.markK4Used(result.question);
          } else if (window.game && typeof window.game._markQuestionUsed === 'function') {
            window.game._markQuestionUsed('k4', result.question);
          }
        }
      } catch (_) {}

      // 清掉一次性外部題
      this._externalPreset = null;

      return result;
    }

    // ===== TTS 小工具 =====
    _speak(text) {
      if (!this.enableTTS || !text) return;
      try {
        if (!("speechSynthesis" in window)) return;
        const synth = window.speechSynthesis;
        synth.cancel();

        if (!this._voicesCached) this._voicesCached = synth.getVoices();
        const zh = (this._voicesCached || []).find(v => (v.lang || '').toLowerCase().startsWith('zh'));

        const u = new SpeechSynthesisUtterance(text);
        u.lang = this.voiceLang || zh?.lang || "zh-TW";
        if (zh) u.voice = zh;
        u.rate = 1.5; u.pitch = 1.0; u.volume = 1.0;
        synth.speak(u);
      } catch (_) {}
    }

    _speakAsync(text) {
      return new Promise((resolve) => {
        if (!this.enableTTS || !text || !("speechSynthesis" in window)) return resolve();
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = this.voiceLang || "zh-TW";
          u.rate = 1.5; u.pitch = 1.0; u.volume = 1.0;
          u.onend = u.onerror = () => resolve();
          window.speechSynthesis.speak(u);
        } catch (_) { resolve(); }
      });
    }

    _present(container, q, { randomize, timeLimitSec }) {
      return new Promise((resolve) => {
        const previouslyFocused = document.activeElement;

        // ===== 遮罩 =====
        const overlay = document.createElement("div");
        overlay.className = "quiz-overlay";
        Object.assign(overlay.style, {
          position: "fixed", inset: "0", display: "grid", placeItems: "center",
          background: "rgba(0,0,0,.55)", zIndex: "9999"
        });

        // ===== 面板（Alertdialog）=====
        const panel = document.createElement("div");
        panel.className = "quiz-panel";
        Object.assign(panel.style, {
          minWidth: "min(92vw, 720px)", maxWidth: "92vw",
          background: "#0f1115", color: "#fff",
          borderRadius: "16px", padding: "20px",
          boxShadow: "0 20px 60px rgba(0,0,0,.5)"
        });
        panel.setAttribute("role", "alertdialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-labelledby", "quizQuestion");
        panel.setAttribute("aria-describedby", "quizPrompt quizChoices quizHint");

        const srLive = document.createElement("div"); // 低調 live 區
        srLive.setAttribute("aria-live", "polite");
        srLive.setAttribute("aria-atomic", "true");
        Object.assign(srLive.style, { position: "absolute", left: "-9999px" });

        const titleRow = document.createElement("div");
        Object.assign(titleRow.style, { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" });

        const h2 = document.createElement("h2");
        h2.id = "quizQuestion";
        h2.textContent = "挑戰題（K4）";
        Object.assign(h2.style, { margin: "0 0 8px 0", fontSize: "20px" });

        const timerEl = document.createElement("div");
        timerEl.setAttribute("aria-label", "倒數計時");
        Object.assign(timerEl.style, {
          fontWeight: "700", fontVariantNumeric: "tabular-nums",
          background: "#151922", border: "1px solid #2a2a2a",
          borderRadius: "10px", padding: "6px 10px"
        });
        titleRow.append(h2, timerEl);

        const p = document.createElement("p");
        p.id = "quizPrompt";
        p.textContent = q.prompt || "";
        p.style.margin = "0 0 12px 0";

        // ===== 選項（Radiogroup / Radio）=====
        const list = document.createElement("div");
        list.id = "quizChoices";
        list.setAttribute("role", "radiogroup");
        list.setAttribute("aria-labelledby", "quizPrompt");
        list.style.display = "grid";
        list.style.gap = "10px";

        let choices = (q.choices || []).map(c => (typeof c === "string" ? { text: c } : c));
        let map = choices.map((_, i) => i);
        if ((q.randomize ?? true) && randomize) {
          for (let i = choices.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [choices[i], choices[j]] = [choices[j], choices[i]];
            [map[i], map[j]] = [map[j], map[i]];
          }
        }
        let correctIndex = map.indexOf(q.answer_index);
        if (correctIndex < 0) correctIndex = 0; // 防呆

        const btns = choices.map((opt, i) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = `${i + 1}. ${opt.text}`;
          b.setAttribute("role", "radio");
          b.setAttribute("aria-checked", "false");
          b.setAttribute("aria-posinset", String(i + 1));
          b.setAttribute("aria-setsize", String(choices.length));
          b.setAttribute("tabindex", i === 0 ? "0" : "-1"); // roving tabindex
          Object.assign(b.style, {
            textAlign: "left", padding: "12px 14px", borderRadius: "12px",
            border: "1px solid #2a2a2a", background: "#151922", color: "#fff",
            cursor: "pointer"
          });
          b.addEventListener("click", () => select(i, true));
          list.appendChild(b);
          return b;
        });

        // ===== 操作列 =====
        const row = document.createElement("div");
        Object.assign(row.style, { display: "flex", gap: "10px", marginTop: "12px", alignItems: "center", flexWrap: "wrap" });

        const hint = document.createElement("div");
        hint.id = "quizHint";
        hint.textContent = "鍵盤：1–9 選項、↑/↓ 或 ←/→ 移動、Enter 送出、Esc 放棄、C 朗讀選項";
        hint.style.opacity = "0.7";
        hint.style.fontSize = "12px";

        const ok = document.createElement("button");
        ok.type = "button";
        ok.textContent = "送出答案（Enter）";
        Object.assign(ok.style, { padding: "10px 14px", borderRadius: "10px", border: "0", background: "#22c55e", color: "#0b1117", fontWeight: "700", cursor: "pointer" });
        ok.disabled = true; ok.setAttribute("aria-disabled", "true");

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "放棄（Esc）";
        Object.assign(cancel.style, { padding: "10px 14px", borderRadius: "10px", border: "1px solid #2a2a2a", background: "#151922", color: "#fff", cursor: "pointer" });

        // 朗讀選項按鈕（C）
        const readBtn = document.createElement("button");
        readBtn.type = "button";
        readBtn.textContent = "🔊 朗讀選項（C）";
        Object.assign(readBtn.style, { padding: "8px 12px", borderRadius: "10px", border: "1px solid #2a2a2a", background: "#151922", color: "#fff", cursor: "pointer" });

        row.append(ok, cancel, readBtn, hint);
        panel.append(srLive, titleRow, p, list, row);
        overlay.append(panel);
        container.append(overlay);

        // 先聚焦面板讓 SR 讀整段，再移到第一個選項
        panel.tabIndex = -1;
        panel.focus({ preventScroll: true });
        setTimeout(() => { btns[0]?.focus(); }, 30);

        // ===== 建立「朗讀選項用」的文本 =====
        const choicesText = () =>
          choices.map((c, i) => `第 ${i + 1} 項，${c.text}`).join("；");
        const speakChoices = () => {
          const t = `選項：${choicesText()}`;
          this._speak(t);
        };
        readBtn.addEventListener("click", speakChoices);

        // ★ 先念題目，題目「念完」再念選項（用 onend 串接，避免重疊）
        const ttsPrompt = q.prompt_tts || q.prompt || "";
        (async () => {
          if (ttsPrompt) await this._speakAsync(ttsPrompt);
          if (this.readChoicesOnOpen) await this._speakAsync(`選項：${choicesText()}`);
        })();

        // ===== 選擇狀態（roving tabindex + aria-checked）=====
        let selected = -1;
        let speakDebounce = 0;
        function redrawHighlight() {
          btns.forEach((b, i) => {
            const on = i === selected;
            b.style.outline = on ? "2px solid #3b82f6" : "none";
            b.setAttribute("aria-checked", on ? "true" : "false");
            b.setAttribute("tabindex", on ? "0" : "-1");
          });
          ok.disabled = selected < 0;
          ok.setAttribute("aria-disabled", ok.disabled ? "true" : "false");
        }
        const speakSelected = (i) => {
          if (!this.enableTTS || !this.speakOnSelect) return;
          clearTimeout(speakDebounce);
          speakDebounce = setTimeout(() => {
            this._speak(`已選擇第 ${i + 1} 項：${choices[i].text}`);
          }, 120);
        };
        const select = (i, moveFocus) => {
          selected = i;
          redrawHighlight();
          if (moveFocus) btns[i]?.focus();
          srLive.textContent = `已選擇第 ${i + 1} 項，共 ${choices.length} 項：${choices[i].text}`;
          speakSelected(i);
        };

        // ===== 倒數 =====
        let remain = Number(q.time_limit_sec || timeLimitSec || 0) | 0;
        let timer = null;
        const renderTime = () => { timerEl.textContent = remain > 0 ? `⏳ ${remain}s` : "不限時"; };
        renderTime();
        if (remain > 0) {
          timer = setInterval(() => {
            remain--;
            renderTime();
            if (remain <= 0) {
              clearInterval(timer);
              resultAndClose(false);
            }
          }, 1000);
        }

        // ===== 鍵盤操控（阻止事件穿透到遊戲）=====
        function onKey(e) {
          const stop = () => { e.preventDefault(); e.stopPropagation(); };
          const code = e.code;
          if (code === "KeyC") { speakChoices(); stop(); return; }
          if (/^Digit[1-9]$/.test(code) || /^Numpad[1-9]$/.test(code)) {
            const n = Number(code.replace(/[^\d]/g, ""));
            if (n >= 1 && n <= btns.length) { select(n - 1, true); stop(); }
          } else if (code === "ArrowDown" || code === "ArrowRight") {
            const next = selected < 0 ? 0 : Math.min(btns.length - 1, selected + 1);
            select(next, true); stop();
          } else if (code === "ArrowUp" || code === "ArrowLeft") {
            const prev = selected < 0 ? 0 : Math.max(0, selected - 1);
            select(prev, true); stop();
          } else if (code === "Enter") {
            if (selected >= 0) { ok.click(); stop(); }
          } else if (code === "Escape") {
            cancel.click(); stop();
          }
        }
        window.addEventListener("keydown", onKey, true);

        // ===== 點擊行為 =====
        ok.onclick = () => resultAndClose(selected === correctIndex);
        cancel.onclick = () => resultAndClose(false);

        // ===== 視覺&語音回饋 + 關閉 =====
        function showFeedback(isCorrect) {
          const fb = document.createElement("div");
          fb.textContent = isCorrect ? "✅ 答對了！" : "❌ 答錯了！";
          Object.assign(fb.style, { marginTop: "12px", fontWeight: "700", color: isCorrect ? "#22c55e" : "#f97316" });
          panel.append(fb);
          srLive.textContent = isCorrect ? "答對了" : "答錯了";
          return fb;
        }
        const speak = (txt) => { try { (window.quiz && window.quiz._speak) ? window.quiz._speak(txt) : null; } catch (_) {} };

        function cleanup(payload) {
          window.removeEventListener("keydown", onKey, true);
          if (timer) clearInterval(timer);
          overlay.remove();
          if (previouslyFocused && previouslyFocused.focus) {
            try { previouslyFocused.focus({ preventScroll: true }); } catch(_) {}
          }
          resolve(payload);
        }

        function resultAndClose(isCorrect) {
          showFeedback(isCorrect);
          speak(isCorrect ? "答對了！" : "答錯了！");
          const points = Number(q.points || 0) || (isCorrect ? 10 : 0);
          const penalty = isCorrect ? { hp: 0, coins: 0 } : (q.penalty_on_wrong || { hp: 0, coins: 0 });
          setTimeout(() => {
            cleanup({
              correct: isCorrect,
              selectedIndex: selected,
              correctIndex: correctIndex,
              points,
              penalty,
              question: q
            });
          }, 700);
        }
      });
    }
  }

  window.QuizEngine = QuizEngine;
})();
// 讓題庫能吃外部派來的題（k4_dialog 會 dispatch）
document.addEventListener('k4:preset-question', (ev) => {
  try {
    if (window.quiz instanceof window.QuizEngine) {
      window.quiz._externalPreset = ev.detail?.question || null;
    }
  } catch (_) {}
});
// 若尚未建立全域 quiz，就自動建立一個（記得把 dataUrl 改成你的題庫路徑）
if (!window.quiz) {
  try {
    window.quiz = new window.QuizEngine({
      dataUrl: 'assets/quiz/k4_bank.json',
      voiceLang: 'zh-TW',
      enableTTS: true
    });
  } catch (_) {}
}
