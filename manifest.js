(() => {
  const STORAGE_KEY = "coxswain-request-manifest-v1";
  const LIMIT = 10;
  const FALLBACK_THUMB = "assets/fallbacks/component.png";

  const $ = (id) => document.getElementById(id);
  const normalise = (value) => String(value || "").trim().toLowerCase();
  const numberValue = (value, fallback = 1) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const readStored = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || !Array.isArray(parsed.items)) return { items: [], editingId: null, enabled: false };
      const items = parsed.items.slice(0, LIMIT);
      return {
        items,
        editingId: parsed.editingId || null,
        enabled: Boolean(parsed.enabled || items.length > 1),
      };
    } catch {
      return { items: [], editingId: null, enabled: false };
    }
  };

  const state = readStored();
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const dispatchValue = (element, value) => {
    if (!element) return;
    element.value = value ?? "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const getShared = () => ({
    requestor: $("requestor")?.value || "",
    requestDate: $("requestDate")?.value || "",
    contact: $("contact")?.value || "",
    footer: $("footer")?.value || "",
    requestType: $("requestType")?.value || "",
  });

  const restoreShared = (shared) => {
    if (!shared) return;
    dispatchValue($("requestor"), shared.requestor);
    dispatchValue($("requestDate"), shared.requestDate);
    dispatchValue($("contact"), shared.contact);
    dispatchValue($("footer"), shared.footer);
    dispatchValue($("requestType"), shared.requestType);
  };

  const readMaterials = () => [...document.querySelectorAll("#materialsEditor .material-row")]
    .map((row) => {
      const inputs = [...row.querySelectorAll("input, select")];
      const byClass = (name) => row.querySelector(`.${name}`)?.value;
      return {
        name: byClass("material-name") ?? inputs[0]?.value ?? "",
        perItem: numberValue(byClass("material-amount") ?? byClass("material-quantity") ?? inputs[1]?.value, 0),
        unit: byClass("material-unit") ?? inputs[2]?.value ?? "",
        quality: byClass("material-quality") ?? inputs[3]?.value ?? "",
      };
    })
    .filter((material) => material.name);

  const readDraft = () => ({
    id: state.editingId || (globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    name: $("itemName")?.value.trim() || "",
    quantity: Math.max(1, Math.round(numberValue($("requestQuantity")?.value, 1))),
    quality: $("globalQuality")?.value || "",
    image: $("configureImage")?.currentSrc || $("configureImage")?.src || "",
    imageStatus: $("imageStatus")?.textContent?.trim() || "ITEM VISUAL",
    details: $("detailsText")?.value || "",
    materials: readMaterials(),
    shared: getShared(),
    addedAt: new Date().toISOString(),
  });

  const materialKey = (material) => [normalise(material.name), normalise(material.unit), normalise(material.quality)].join("|");
  const aggregateMaterials = () => {
    const totals = new Map();
    for (const item of state.items) {
      for (const material of item.materials || []) {
        const key = materialKey(material);
        const existing = totals.get(key) || { name: material.name, unit: material.unit, quality: material.quality, total: 0 };
        existing.total += numberValue(material.perItem, 0) * numberValue(item.quantity, 1);
        totals.set(key, existing);
      }
    }
    return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
  };

  const formatNumber = (value) => {
    const rounded = Math.round((value + Number.EPSILON) * 10000) / 10000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
  };

  const style = document.createElement("style");
  style.textContent = `
    .manifest-launch { margin-left: auto; }
    .manifest-view .screen-title-row { margin-bottom: 10px; }
    .manifest-workspace { display: grid; gap: 10px; }
    .manifest-panel { min-height: 0; }
    .manifest-count { color: var(--green-soft); font-size: 10px; }
    .manifest-list { display: grid; gap: 7px; max-height: min(49vh, 430px); overflow-y: auto; padding-right: 3px; }
    .manifest-empty { border: 1px dashed var(--green-faint); padding: 28px 12px; color: var(--green-soft); font-size: 10px; text-align: center; }
    .manifest-row { display: grid; grid-template-columns: 72px minmax(0,1fr) auto; gap: 11px; align-items: center; border: 1px solid var(--green-faint); padding: 8px; background: rgba(0,18,5,.32); }
    .manifest-row.is-editing { border-color: var(--green); box-shadow: inset 0 0 0 1px var(--green-faint); }
    .manifest-thumb { width: 72px; height: 52px; object-fit: contain; background: rgba(0,0,0,.24); border: 1px solid var(--green-faint); }
    .manifest-copy { min-width: 0; }
    .manifest-copy strong { display: block; overflow-wrap: anywhere; font-size: 13px; }
    .manifest-copy span { display: block; margin-top: 4px; color: var(--green-soft); font-size: 9px; }
    .manifest-actions { display: flex; gap: 6px; }
    .manifest-actions button, .manifest-command-row button { border: 1px solid var(--green-soft); background: transparent; color: var(--green); cursor: pointer; font: 800 9px "Courier New", monospace; padding: 7px 9px; }
    .manifest-actions button:hover, .manifest-command-row button:hover { background: var(--green); color: #001b06; border-color: var(--green); }
    .manifest-summary { border: 1px solid var(--green-faint); padding: 9px 11px; color: var(--green-soft); font-size: 9px; }
    .manifest-summary strong { color: var(--green); }
    .manifest-status { min-height: 14px; color: var(--green-soft); font-size: 9px; text-align: right; }
    .manifest-command-row { display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--green-faint); padding-top: 9px; }
    .manifest-command-row .manifest-primary { margin-left: auto; background: var(--green); color: #001b06; border-color: var(--green); }
    .step-nav.manifest-enabled { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    @media (max-width: 700px) {
      .manifest-row { grid-template-columns: 50px minmax(0,1fr); }
      .manifest-actions { grid-column: 1 / -1; justify-content: flex-end; }
      .manifest-thumb { width: 50px; height: 40px; }
      .manifest-command-row { flex-wrap: wrap; }
      .manifest-command-row .manifest-primary { margin-left: 0; }
    }
  `;
  document.head.appendChild(style);

  const nav = document.querySelector(".step-nav");
  const reviewNav = nav?.querySelector('[data-step="review"]');
  const exportNav = nav?.querySelector('[data-step="export"]');
  if (!nav || !reviewNav || !exportNav) return;

  const manifestNav = document.createElement("button");
  manifestNav.type = "button";
  manifestNav.dataset.step = "manifest";
  manifestNav.hidden = !state.enabled;
  manifestNav.innerHTML = "<span>03</span> MANIFEST";
  nav.insertBefore(manifestNav, reviewNav);

  const reviewNumber = reviewNav.querySelector("span");
  const exportNumber = exportNav.querySelector("span");
  if (reviewNumber) reviewNumber.textContent = state.enabled ? "04" : "03";
  if (exportNumber) exportNumber.textContent = state.enabled ? "05" : "04";
  nav.classList.toggle("manifest-enabled", state.enabled);

  const manifestView = document.createElement("section");
  manifestView.className = "terminal-view manifest-view";
  manifestView.dataset.view = "manifest";
  manifestView.innerHTML = `
    <div class="screen-title-row compact-title">
      <div>
        <p class="terminal-kicker">REQUEST ASSEMBLY // MULTI-ITEM MANIFEST</p>
        <h1>Manage request manifest</h1>
      </div>
      <button type="button" class="terminal-button quiet" id="manifestBackToItem">&lt; CURRENT ITEM</button>
    </div>
    <div class="manifest-workspace">
      <section class="terminal-panel manifest-panel">
        <div class="panel-heading">
          <h2>REQUEST MANIFEST</h2>
          <span class="manifest-count" id="manifestCount">0 / ${LIMIT} ITEM TYPES</span>
        </div>
        <div class="manifest-list" id="manifestList"></div>
      </section>
      <div class="manifest-summary" id="manifestMaterialSummary"></div>
      <div class="manifest-status" id="manifestStatus" role="status"></div>
      <div class="manifest-command-row">
        <button type="button" id="manifestClear">CLEAR MANIFEST</button>
        <button type="button" id="manifestAnother">+ ADD ANOTHER ITEM</button>
        <button type="button" id="manifestReview" class="manifest-primary">REVIEW REQUEST &gt;</button>
      </div>
    </div>
  `;

  const reviewView = document.querySelector('.terminal-view[data-view="review"]');
  reviewView?.parentNode?.insertBefore(manifestView, reviewView);

  const requestCommandRow = $("reviewButton")?.closest(".terminal-command-row");
  const addAnotherButton = document.createElement("button");
  addAnotherButton.type = "button";
  addAnotherButton.id = "initiateManifestButton";
  addAnotherButton.className = "terminal-button manifest-launch";
  addAnotherButton.textContent = state.enabled ? "ADD / UPDATE MANIFEST ITEM" : "+ ADD ANOTHER ITEM";
  requestCommandRow?.insertBefore(addAnotherButton, $("reviewButton"));

  const list = $("manifestList");
  const count = $("manifestCount");
  const status = $("manifestStatus");
  const materialSummary = $("manifestMaterialSummary");

  const setStatus = (message) => { status.textContent = message; };

  const activateManifestMode = () => {
    state.enabled = true;
    manifestNav.hidden = false;
    nav.classList.add("manifest-enabled");
    if (reviewNumber) reviewNumber.textContent = "04";
    if (exportNumber) exportNumber.textContent = "05";
    addAnotherButton.textContent = "ADD / UPDATE MANIFEST ITEM";
    save();
  };

  const showView = (name) => {
    document.querySelectorAll(".terminal-view").forEach((view) => view.classList.toggle("active", view.dataset.view === name));
    nav.querySelectorAll("button[data-step]").forEach((button) => button.classList.toggle("active", button.dataset.step === name));
    const breadcrumb = $("breadcrumb");
    if (breadcrumb && name === "manifest") breadcrumb.textContent = "FORUMS > CRAFTING TERMINAL > REQUEST > MANIFEST";
  };

  const render = () => {
    count.textContent = `${state.items.length} / ${LIMIT} ITEM TYPES`;
    list.replaceChildren();

    if (!state.items.length) {
      const empty = document.createElement("div");
      empty.className = "manifest-empty";
      empty.textContent = "NO ITEMS ADDED // RETURN TO REQUEST AND ADD THE CURRENT ITEM";
      list.appendChild(empty);
    }

    for (const item of state.items) {
      const row = document.createElement("div");
      row.className = `manifest-row${state.editingId === item.id ? " is-editing" : ""}`;

      const image = document.createElement("img");
      image.className = "manifest-thumb";
      image.alt = "";
      image.src = item.image || FALLBACK_THUMB;
      image.addEventListener("error", () => {
        if (!image.src.endsWith(FALLBACK_THUMB)) image.src = FALLBACK_THUMB;
      });

      const copy = document.createElement("div");
      copy.className = "manifest-copy";
      const title = document.createElement("strong");
      title.textContent = `${item.quantity} × ${item.name}`;
      const meta = document.createElement("span");
      meta.textContent = `${item.quality || "NO QUALITY"} // ${(item.materials || []).length} MATERIAL LINES`;
      copy.append(title, meta);

      const actions = document.createElement("div");
      actions.className = "manifest-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "EDIT";
      edit.addEventListener("click", () => editItem(item.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "REMOVE";
      remove.addEventListener("click", () => removeItem(item.id));
      actions.append(edit, remove);
      row.append(image, copy, actions);
      list.appendChild(row);
    }

    const totals = aggregateMaterials();
    if (!totals.length) materialSummary.textContent = "CONSOLIDATED MATERIALS // NONE AVAILABLE";
    else {
      const totalUnits = totals.reduce((sum, material) => sum + material.total, 0);
      materialSummary.innerHTML = `<strong>CONSOLIDATED MATERIALS</strong> // ${totals.length} UNIQUE LINES // ${formatNumber(totalUnits)} TOTAL UNITS`;
    }
  };

  const addOrUpdate = () => {
    const draft = readDraft();
    if (!draft.name) {
      $("itemName")?.focus();
      return false;
    }

    const editIndex = state.items.findIndex((item) => item.id === state.editingId);
    if (editIndex >= 0) {
      state.items[editIndex] = draft;
      state.editingId = null;
      save();
      render();
      setStatus("ITEM UPDATED");
      return true;
    }

    const duplicateIndex = state.items.findIndex((item) => normalise(item.name) === normalise(draft.name));
    if (duplicateIndex >= 0) {
      const existing = state.items[duplicateIndex];
      existing.quantity += draft.quantity;
      existing.quality = draft.quality;
      existing.materials = draft.materials;
      existing.image = draft.image;
      existing.details = draft.details;
      existing.shared = draft.shared;
      save();
      render();
      setStatus("MATCHING ITEM FOUND // QUANTITIES MERGED");
      return true;
    }

    if (state.items.length >= LIMIT) {
      setStatus(`MANIFEST LIMIT REACHED // ${LIMIT} ITEM TYPES`);
      return false;
    }

    state.items.push(draft);
    save();
    render();
    setStatus("ITEM ADDED TO REQUEST");
    return true;
  };

  const editItem = (id) => {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;
    state.editingId = id;
    dispatchValue($("itemName"), item.name);
    dispatchValue($("requestQuantity"), item.quantity);
    dispatchValue($("globalQuality"), item.quality);
    dispatchValue($("detailsText"), item.details);
    restoreShared(item.shared);
    if (item.image && $("configureImage")) $("configureImage").src = item.image;
    save();
    render();
    showView("configure");
  };

  const removeItem = (id) => {
    const index = state.items.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    state.items.splice(index, 1);
    if (state.editingId === id) state.editingId = null;
    save();
    render();
    setStatus("ITEM REMOVED // MATERIAL TOTALS RECALCULATED");
  };

  addAnotherButton.addEventListener("click", () => {
    activateManifestMode();
    if (!addOrUpdate()) return;
    showView("manifest");
  });

  manifestNav.addEventListener("click", () => showView("manifest"));
  $("manifestBackToItem").addEventListener("click", () => showView("configure"));

  $("manifestAnother").addEventListener("click", () => {
    if (state.items.length >= LIMIT) {
      setStatus(`MANIFEST LIMIT REACHED // ${LIMIT} ITEM TYPES`);
      return;
    }
    const shared = state.items.at(-1)?.shared || getShared();
    state.editingId = null;
    save();
    $("newSearchButton")?.click();
    setTimeout(() => restoreShared(shared), 0);
    setTimeout(() => restoreShared(shared), 250);
  });

  $("manifestReview").addEventListener("click", () => {
    document.querySelector('[data-step="review"]')?.click();
  });

  $("manifestClear").addEventListener("click", () => {
    if (!state.items.length || !confirm("CLEAR ALL ITEMS FROM THIS REQUEST MANIFEST?")) return;
    state.items = [];
    state.editingId = null;
    state.enabled = false;
    save();
    render();
    manifestNav.hidden = true;
    nav.classList.remove("manifest-enabled");
    if (reviewNumber) reviewNumber.textContent = "03";
    if (exportNumber) exportNumber.textContent = "04";
    addAnotherButton.textContent = "+ ADD ANOTHER ITEM";
    showView("configure");
  });

  window.coxswainManifest = {
    getItems: () => structuredClone(state.items),
    getAggregatedMaterials: () => structuredClone(aggregateMaterials()),
    isEnabled: () => state.enabled,
    commitCurrentForReview: () => !state.enabled || addOrUpdate(),
    show: () => showView("manifest"),
    clear: () => {
      state.items = [];
      state.editingId = null;
      state.enabled = false;
      save();
      render();
    },
  };

  render();
})();