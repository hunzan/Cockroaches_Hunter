// js/core/weapon-bar.js
// 武器工具列：三顆按鈕（火/噴/拖），支援點擊切換與左右滑動循環
export class WeaponBar {
  /**
   * @param {HTMLElement} mountRoot  你要掛在哪個容器（建議 #gameRoot 或 body）
   * @param {object} opts
   *  - onSelect(weaponId) : 點擊某武器時呼叫（'fire'|'spray'|'slipper'）
   *  - onCycle(dir)       : 在工具列上左右滑動時呼叫（+1/-1）
   *  - initial            : 初始武器 id
   *  - showOnCoarseOnly   : 只在粗指標（多半是手機/平板）顯示，預設 true
   */
  constructor(mountRoot, opts = {}) {
    this.root = mountRoot || document.body;
    this.onSelect = opts.onSelect || (()=>{});
    this.onCycle  = opts.onCycle  || (()=>{});
    this.showOnCoarseOnly = opts.showOnCoarseOnly ?? true;
    this._active = opts.initial || 'fire';

    this._build();
    this._bind();
    this.setActive(this._active);
  }

  _build(){
    // 建立 DOM（若已存在就重用）
    this.el = document.getElementById('weaponBar');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'weaponBar';
      this.el.className = 'weapon-bar';
      this.el.setAttribute('role', 'group');
      this.el.setAttribute('aria-label', '武器切換');
      this.el.innerHTML = `
        <button type="button" class="wbtn" data-w="fire"    aria-label="切換到 噴火槍">🔥 火</button>
        <button type="button" class="wbtn" data-w="spray"   aria-label="切換到 香氛噴霧">🌸 噴</button>
        <button type="button" class="wbtn" data-w="slipper" aria-label="切換到 藍白拖">🩴 拖</button>
      `;
      this.root.appendChild(this.el);
    }

    // 顯示條件：粗指標才顯示（可覆寫）
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const show = this.showOnCoarseOnly ? coarse : true;
    this.el.setAttribute('aria-hidden', show ? 'false' : 'true');
    this.el.style.display = show ? 'flex' : 'none';
  }

  _bind(){
    // 點擊切換
    this.el.addEventListener('click', (e)=>{
      const btn = e.target.closest('.wbtn'); if (!btn) return;
      const w = btn.dataset.w;
      this.setActive(w);
      this.onSelect?.(w);
      // 震動提示（可略）
      try { navigator.vibrate?.(25); } catch {}
    });

    // 左右滑動循環
    let pid = null, sx = 0;
    const TH = 28; // px
    this.el.addEventListener('pointerdown', (e)=>{
      pid = e.pointerId; sx = e.clientX;
      this.el.setPointerCapture?.(pid);
    });
    const finish = (e)=>{
      if (e.pointerId !== pid) return;
      const dx = e.clientX - sx;
      pid = null;
      if (Math.abs(dx) >= TH) {
        this.onCycle?.(dx > 0 ? +1 : -1);
        try { navigator.vibrate?.(15); } catch {}
      }
    };
    this.el.addEventListener('pointerup', finish);
    this.el.addEventListener('pointercancel', finish);
  }

  setActive(w){
    this._active = w;
    // 高亮與 ARIA 現況
    this.el.querySelectorAll('.wbtn').forEach(b=>{
      const on = (b.dataset.w === w);
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-current', on ? 'true' : 'false');
    });
  }
}
