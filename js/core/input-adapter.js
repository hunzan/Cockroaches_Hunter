// js/core/input-adapter.js
export function bindInputs(core, opts={}){
  const grid = opts.grid ?? 1;

  const api = {
    move:(dx,dy)=> core.moveBy(dx*grid, dy*grid),
    attack:()=> core.attack?.()
  };

  // --- 鍵盤（桌機/外接鍵盤）
  const onKey = (e)=>{
    const k = e.key;
    if (k==='ArrowUp')         { api.move(0,+1); e.preventDefault(); }
    else if (k==='ArrowDown')  { api.move(0,-1); e.preventDefault(); }
    else if (k==='ArrowLeft')  { api.move(-1,0); e.preventDefault(); }
    else if (k==='ArrowRight') { api.move(+1,0); e.preventDefault(); }
    else if (k===' ' || k==='a' || k==='A') { api.attack(); e.preventDefault(); }
    // input-adapter.js 的 onKey 內補上：
    else if (k==='1') { api.selectWeapon ? api.selectWeapon('fire')    : core.selectWeapon?.('fire'); }
    else if (k==='2') { api.selectWeapon ? api.selectWeapon('spray')   : core.selectWeapon?.('spray'); }
    else if (k==='3') { api.selectWeapon ? api.selectWeapon('slipper') : core.selectWeapon?.('slipper'); }
    // 若要支援 L4/L5：
    else if (k==='4') { core.selectWeapon?.('bait'); }
    else if (k==='5') { core.selectWeapon?.('cat'); }
    else if (k==='6' || k==='7') { core.selectWeapon?.('vote'); }
  };
  window.addEventListener('keydown', onKey);

  // --- 手勢（手機）
  import('./input-mobile.js').then(({MobileInput})=>{
    const layer = document.getElementById('gestureLayer');
    if (!layer) return;
    new MobileInput(layer, api, { swipeThreshold: 30, doubleTapWindow: 240, maxTapTravel: 14 });
  });

  // --- A11Y 巨型按鈕（SR 開啟時用）
  const bindBtn = (id, fn)=>{ const el=document.getElementById(id); el&&el.addEventListener('click', fn); };
  bindBtn('btnUp',    ()=>api.move(0,+1));
  bindBtn('btnDown',  ()=>api.move(0,-1));
  bindBtn('btnLeft',  ()=>api.move(-1,0));
  bindBtn('btnRight', ()=>api.move(+1,0));
  bindBtn('btnAttack', api.attack);

  // 提供解除綁定
  return ()=> window.removeEventListener('keydown', onKey);
}
