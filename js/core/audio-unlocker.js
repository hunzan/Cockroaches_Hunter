// js/core/audio-unlocker.js
;(function(){
  const AudioFX = {
    _armed: false,
    _els: new Set(),
    _onUserGesture: null,

    // 綁定需要被解鎖/播放的 <audio>（建議是你的 BGM）
    register(el) {
      if (!el) return;
      this._els.add(el);
      // 預先靜音嘗試自動播放（有些瀏覽器允許 muted autoplay）
      try { el.muted = true; el.play().catch(()=>{}); } catch(_){}
    },

    // 真的遇到一次「使用者手勢」後，統一解鎖所有 BGM
    _ensurePlay() {
      if (this._armed) return;
      this._armed = true;

      // 解綁這些一次性監聽
      const gestures = ['pointerdown', 'mousedown', 'keydown', 'keyup', 'touchstart', 'wheel'];
      gestures.forEach(type => {
        document.removeEventListener(type, this._onUserGesture, true);
        window.removeEventListener(type, this._onUserGesture, true);
      });

      // 統一解除靜音並播放
      this._els.forEach(el => {
        try {
          el.muted = false;
          el.volume = Math.min(1, el.volume || 0.8);
          el.play().catch(()=>{}); // 某些瀏覽器還是可能丟錯，但大多 OK
        } catch(_) {}
      });
    },

    // 每頁初始化：盡可能早就掛上捕獲階段監聽，抓到更多手勢
    init() {
      if (this._onUserGesture) return;
      this._onUserGesture = this._ensurePlay.bind(this);

      const gestures = ['pointerdown', 'mousedown', 'keydown', 'keyup', 'touchstart', 'wheel'];
      // 用 capture=true，避免被其它 listener 提早 stopPropagation
      gestures.forEach(type => {
        document.addEventListener(type, this._onUserGesture, true);
        window.addEventListener(type, this._onUserGesture, true);
      });

      // 若你的遊戲內部（如切到焦點模式、或按空白掃描）有自定事件，可以主動叫醒：
      window.addEventListener('user-activated', this._onUserGesture, true);
    },

    // 讓你在任何時機手動「保險叫醒」，例如掃描鍵、模式切換後等
    ensure() { this._ensurePlay(); }
  };

  window.AudioFX = AudioFX;
})();
