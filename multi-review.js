(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const formatNumber = (value) => {
    const rounded = Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
  };

  const FALLBACK_THUMB = "assets/fallbacks/component.png";
  const setThumb = (image, source) => {
    image.src = source || FALLBACK_THUMB;
    image.addEventListener("error", () => {
      if (!image.src.endsWith(FALLBACK_THUMB)) image.src = FALLBACK_THUMB;
    });
  };

  const style = document.createElement("style");
  style.textContent = `
    .multi-request-output { min-height: 430px; }
    .multi-review-header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; border-bottom:1px solid var(--green-soft); padding:2px 2px 10px; margin-bottom:10px; }
    .multi-review-header h2 { margin:2px 0 0; font-size:clamp(20px,2vw,30px); line-height:1.05; overflow-wrap:anywhere; }
    .multi-review-kicker { margin:0; color:var(--green-soft); font-size:9px; letter-spacing:1.4px; }
    .multi-review-count { border:1px solid var(--green-soft); padding:7px 9px; font-size:9px; white-space:nowrap; }
    .multi-shared { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; margin-bottom:10px; }
    .multi-shared div { border:1px solid var(--green-faint); padding:7px; min-width:0; }
    .multi-shared dt { color:var(--green-soft); font-size:8px; }
    .multi-shared dd { margin:3px 0 0; font-size:11px; overflow-wrap:anywhere; }
    .multi-review-grid { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(250px,.75fr); gap:10px; }
    .multi-review-section { border:1px solid var(--green-soft); background:rgba(0,18,5,.28); padding:9px; min-width:0; }
    .multi-review-heading { display:flex; justify-content:space-between; gap:10px; align-items:center; border-bottom:1px solid var(--green-faint); padding-bottom:7px; margin-bottom:8px; }
    .multi-review-heading h3 { margin:0; font-size:13px; }
    .multi-review-heading span { color:var(--green-soft); font-size:8px; }
    .multi-item-cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
    .multi-item-card { display:grid; grid-template-columns:78px minmax(0,1fr); gap:8px; border:1px solid var(--green-faint); padding:7px; min-height:82px; background:rgba(0,15,4,.32); }
    .multi-item-card img { width:78px; height:66px; object-fit:contain; border:1px solid var(--green-faint); background:rgba(0,0,0,.22); }
    .multi-item-card strong { display:block; font-size:11px; line-height:1.15; overflow-wrap:anywhere; }
    .multi-item-card b { display:block; margin-bottom:4px; font-size:15px; }
    .multi-item-card small { display:block; margin-top:5px; color:var(--green-soft); font-size:8px; }
    .multi-item-rows { display:grid; gap:5px; }
    .multi-item-row { display:grid; grid-template-columns:54px 48px minmax(0,1fr) auto; gap:8px; align-items:center; border:1px solid var(--green-faint); padding:5px 7px; background:rgba(0,15,4,.32); }
    .multi-item-row img { width:54px; height:40px; object-fit:contain; border:1px solid var(--green-faint); background:rgba(0,0,0,.22); }
    .multi-item-row b { font-size:14px; text-align:center; }
    .multi-item-row strong { min-width:0; font-size:10px; line-height:1.15; overflow-wrap:anywhere; }
    .multi-item-row small { color:var(--green-soft); font-size:8px; white-space:nowrap; }
    .multi-material-list { display:grid; gap:5px; max-height:330px; overflow:auto; padding-right:3px; }
    .multi-material-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:3px 8px; border-bottom:1px solid var(--green-faint); padding:5px 2px; }
    .multi-material-row strong { font-size:10px; overflow-wrap:anywhere; }
    .multi-material-row b { font-size:11px; white-space:nowrap; }
    .multi-material-row small { grid-column:1 / -1; color:var(--green-soft); font-size:8px; }
    .multi-review-empty { color:var(--green-soft); font-size:9px; padding:10px 2px; }
    .multi-review-footer { border-top:1px solid var(--green-soft); margin-top:9px; padding-top:7px; text-align:center; color:var(--green-soft); font-size:8px; }
    @media (max-width:900px) {
      .multi-review-grid { grid-template-columns:1fr; }
      .multi-material-list { max-height:none; }
    }
    @media (max-width:650px) {
      .multi-shared { grid-template-columns:1fr; }
      .multi-item-cards { grid-template-columns:1fr; }
      .multi-item-row { grid-template-columns:46px 38px minmax(0,1fr); }
      .multi-item-row img { width:46px; }
      .multi-item-row small { grid-column:2 / -1; }
    }
  `;
  document.head.appendChild(style);

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const renderShared = (container, shared = {}) => {
    const values = [
      ["REQUESTOR", shared.requestor || "UNSPECIFIED"],
      ["REQUEST DATE", shared.requestDate || "UNSPECIFIED"],
      ["PICKUP / DELIVERY", shared.contact || "UNSPECIFIED"],
    ];
    for (const [label, value] of values) {
      const wrap = document.createElement("div");
      wrap.append(make("dt", "", label), make("dd", "", value));
      container.appendChild(wrap);
    }
  };

  const itemMeta = (item) => `${item.quality || "NO QUALITY"} // ${(item.materials || []).length} MATERIAL LINES`;

  const renderCards = (container, items) => {
    const list = make("div", "multi-item-cards");
    for (const item of items) {
      const card = make("article", "multi-item-card");
      const image = make("img");
      image.alt = "";
      setThumb(image, item.image);
      const copy = document.createElement("div");
      copy.append(
        make("b", "", `${item.quantity} ×`),
        make("strong", "", item.name || "UNTITLED ITEM"),
        make("small", "", itemMeta(item))
      );
      card.append(image, copy);
      list.appendChild(card);
    }
    container.appendChild(list);
  };

  const renderRows = (container, items) => {
    const list = make("div", "multi-item-rows");
    for (const item of items) {
      const row = make("article", "multi-item-row");
      const image = make("img");
      image.alt = "";
      setThumb(image, item.image);
      row.append(
        image,
        make("b", "", `${item.quantity}×`),
        make("strong", "", item.name || "UNTITLED ITEM"),
        make("small", "", itemMeta(item))
      );
      list.appendChild(row);
    }
    container.appendChild(list);
  };

  const renderMaterials = (container, materials) => {
    if (!materials.length) {
      container.appendChild(make("div", "multi-review-empty", "NO MATERIAL DATA AVAILABLE"));
      return;
    }
    const list = make("div", "multi-material-list");
    for (const material of materials) {
      const row = make("div", "multi-material-row");
      row.append(
        make("strong", "", material.name || "UNNAMED MATERIAL"),
        make("b", "", `${formatNumber(material.total)} ${material.unit || ""}`.trim()),
        make("small", "", `QUALITY // ${material.quality || "UNSPECIFIED"}`)
      );
      list.appendChild(row);
    }
    container.appendChild(list);
  };

  const renderMultiReview = () => {
    const api = window.coxswainManifest;
    const output = document.getElementById("requestOutput");
    if (!api || !output) return;
    const items = api.getItems();
    if (items.length < 2) return;
    const materials = api.getAggregatedMaterials();
    const shared = items[0]?.shared || {};

    output.className = "request-output multi-request-output";
    output.replaceChildren();

    const header = make("header", "multi-review-header");
    const headerCopy = document.createElement("div");
    headerCopy.append(
      make("p", "multi-review-kicker", "COXSWAIN ACQUISITION MANIFEST // PRE-TRANSMISSION"),
      make("h2", "", "MULTI-ITEM CRAFTING REQUEST")
    );
    header.append(headerCopy, make("div", "multi-review-count", `${items.length} ITEM TYPES // ${items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} TOTAL ITEMS`));

    const sharedList = make("dl", "multi-shared");
    renderShared(sharedList, shared);

    const grid = make("div", "multi-review-grid");
    const itemsSection = make("section", "multi-review-section");
    const itemsHeading = make("div", "multi-review-heading");
    itemsHeading.append(make("h3", "", "REQUESTED ITEMS"), make("span", "", items.length <= 4 ? "VISUAL CARD MODE" : "COMPACT MANIFEST MODE"));
    itemsSection.appendChild(itemsHeading);
    if (items.length <= 4) renderCards(itemsSection, items);
    else renderRows(itemsSection, items);

    const materialSection = make("section", "multi-review-section");
    const materialHeading = make("div", "multi-review-heading");
    materialHeading.append(make("h3", "", "CONSOLIDATED MATERIALS"), make("span", "", `${materials.length} UNIQUE LINES`));
    materialSection.appendChild(materialHeading);
    renderMaterials(materialSection, materials);

    grid.append(itemsSection, materialSection);
    const footer = make("footer", "multi-review-footer", shared.footer || "UEE PATHFINDERS // COXSWAIN CRAFTING REQUEST");
    output.append(header, sharedList, grid, footer);
  };

  const setup = () => {
    const reviewButton = document.getElementById("reviewButton");
    if (!reviewButton) return;
    reviewButton.addEventListener("click", () => {
      const count = window.coxswainManifest?.getItems?.().length || 0;
      if (count < 2) return;
      requestAnimationFrame(() => requestAnimationFrame(renderMultiReview));
      setTimeout(renderMultiReview, 80);
    });

    document.querySelector('[data-step="review"]')?.addEventListener("click", () => {
      const count = window.coxswainManifest?.getItems?.().length || 0;
      if (count < 2) return;
      requestAnimationFrame(() => requestAnimationFrame(renderMultiReview));
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
