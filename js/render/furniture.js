// js/render/furniture.js  — 使用 DOM 測量，避免跑位

const furnitureImages = {
  sofa:  "assets/images/obstacles/sofa_3x2.png",
  table: "assets/images/obstacles/table_3x2.png",
  tv:    "assets/images/obstacles/tv_3x1.png",
};

function qTile(area, x, y) {
  return area.querySelector(`.tile[data-x="${x}"][data-y="${y}"]`);
}

window.renderFurniture = function(area, core) {
  if (!area) return;

  // 清掉舊層
  let furnLayer = area.querySelector(".furniture-layer");
  if (furnLayer) furnLayer.remove();

  // 建新層（疊在 tile 上面）
  furnLayer = document.createElement("div");
  furnLayer.className = "furniture-layer";
  furnLayer.style.position = "absolute";
  furnLayer.style.inset = "0";
  furnLayer.style.pointerEvents = "none";
  furnLayer.style.zIndex = "5";

  // 關鍵：量 area 與 tile 的實際像素位置
  const areaRect = area.getBoundingClientRect();
  const obs = core.cfg?.obstacles || [];

  for (const o of obs) {
    const imgPath = o.label && furnitureImages[o.label];
    if (!imgPath) continue;

    const tl = qTile(area, o.x1, o.y1);               // top-left tile element
    const br = qTile(area, o.x2, o.y2);               // bottom-right tile element
    if (!tl || !br) continue;                         // 關卡還沒生成完，就先跳過

    const tlRect = tl.getBoundingClientRect();
    const brRect = br.getBoundingClientRect();

    // 以 area 為參考座標，算出覆蓋框
    const left   = Math.round(tlRect.left   - areaRect.left);
    const top    = Math.round(tlRect.top    - areaRect.top);
    const right  = Math.round(brRect.right  - areaRect.left);
    const bottom = Math.round(brRect.bottom - areaRect.top);

    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);

    const img = document.createElement("img");
    img.src = imgPath;
    img.alt = o.label;
    img.style.position = "absolute";
    img.style.left = left + "px";
    img.style.top = top + "px";
    img.style.width = w + "px";
    img.style.height = h + "px";
    img.style.objectFit = "cover";    // 填滿矩形
    // 如果你想更銳利：img.style.imageRendering = "crisp-edges";

    furnLayer.appendChild(img);
  }

  // area 必須是定位容器
  const cs = getComputedStyle(area);
  if (cs.position === "static") area.style.position = "relative";

  area.appendChild(furnLayer);
};
