// js/core/input-mobile.js
export class MobileInput {
  constructor(layer, api, opts = {}) {
    this.layer = layer; this.api = api;
    this.swipeThreshold = opts.swipeThreshold ?? 28;
    this.doubleTapWindow = opts.doubleTapWindow ?? 260;
    this.maxTapTravel = opts.maxTapTravel ?? 12;

    this._pointerId = null;
    this._start = null;
    this._lastTapTime = 0;
    this._lastTapPos = null;

    this._bind();
  }

  _bind(){
    this.layer.addEventListener('pointerdown', this._onDown, {passive:false});
    this.layer.addEventListener('pointermove', this._onMove, {passive:false});
    this.layer.addEventListener('pointerup',   this._onUp,   {passive:false});
    this.layer.addEventListener('pointercancel', this._onCancel, {passive:false});
    this.layer.style.touchAction = 'none';
  }

  _onDown = (e)=>{ if(this._pointerId!==null) return;
    this.layer.setPointerCapture?.(e.pointerId);
    this._pointerId = e.pointerId;
    this._start = {x:e.clientX, y:e.clientY, t:performance.now()};
    e.preventDefault();
  };

  _onMove = (e)=>{ if(e.pointerId!==this._pointerId || !this._start) return; e.preventDefault(); };

  _onUp = (e)=>{
    if(e.pointerId!==this._pointerId || !this._start) return;
    const end = {x:e.clientX, y:e.clientY, t:performance.now()};
    const dx = end.x - this._start.x, dy = end.y - this._start.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const isTap = (adx <= this.maxTapTravel && ady <= this.maxTapTravel);

    // 雙擊＝攻擊
    if (isTap) {
      const isDouble = (end.t - this._lastTapTime) <= this.doubleTapWindow &&
                       this._lastTapPos &&
                       Math.hypot(end.x - this._lastTapPos.x, end.y - this._lastTapPos.y) <= this.maxTapTravel * 2;
      if (isDouble) { this.api.attack?.(); this._lastTapTime = 0; this._lastTapPos = null; return this._reset(e); }
      this._lastTapTime = end.t; this._lastTapPos = {x:end.x, y:end.y};
      return this._reset(e);
    }

    // 滑動＝移動（取主軸）
    if (adx >= this.swipeThreshold || ady >= this.swipeThreshold) {
      if (adx > ady) this.api.move(Math.sign(dx), 0);
      else           this.api.move(0, Math.sign(dy) * -1);
    }
    this._reset(e);
  };

  _onCancel = (e)=>{ if(e.pointerId===this._pointerId) this._reset(e); };

  _reset(e){ try{ this.layer.releasePointerCapture?.(e.pointerId); }catch{} this._pointerId=null; this._start=null; }
}
