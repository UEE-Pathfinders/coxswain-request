(() => {
  const STORAGE_KEY = "coxswain-request-manifest-v1";
  const LIMIT = 10;

  const $ = (id) => document.getElementById(id);
  const normalise = (value) => String(value || "").trim().toLowerCase();
  const numberValue = (value, fallback = 1) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const readStored = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || !Array.isArray(parsed.items)) return { items: [], editingId: null };
      return {
        items: parsed.items.slice(0, LIMIT),
        editingId: parsed.editingId || null,
      };
    } catch {
      return { items: [], editingId: null };
    }
  };

  const state = readStored();

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

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

  const readMaterials = () => {
    const rows = [...document.querySelectorAll("#materialsEditor .material-row")];
    return rows.map((row) => {
      const inputs = [...row.querySelectorAll("input, select")];
      const byClass = (name) => row.querySelector(`.${name}`)?.value;
      return {
        name: byClass("material-name") ?? inputs[0]?.value ?? "",
        perItem: numberValue(byClass("material-amount") ?? byClass("material-quantity") ?? inputs[1]?.value, 0),
        unit: byClass("material-unit") ?? inputs[2]?.value ?? "",
        quality: byClass("material-quality") ?? inputs[3]?.value ?? "",
      };
    }).filter((material) => material.name);
  };

  const readDraft = () => {
    const name = $("itemName")?.value.trim() || "";
    const image = $("configureImage")?.currentSrc || $("configureImage")?.src || "";
    return {
      id: state.editingId || (globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      name,
      quantity: Math.max(1, Math.round(numberValue($("requestQuantity")?.value, 1))),
      quality: $("globalQuality")?.value || "",
      image,
      imageStatus: $("imageStatus")?.textContent?.trim() || "ITEM VISUAL",
      details: $("detailsText")?.value || "",
      materials: readMaterials(),
      shared: getShared(),
      addedAt: new Date().toISOString(),
    };
  };

  const materialKey = (material) => [
    normalise(material.name),
    normalise(material.unit),
    normalise(material.quality),
  ].join("|");

  const aggregateMaterials = () => {
    const totals = new Map();
    for (const item of state.items) {
      for (const material of item.materials || []) {
        const key = materialKey(material);
        const existing = totals.get(key) || {
          name: material.name,
          unit: material.unit,
          quality: material.quality,
          total: 0,
        };
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
    .manifest-panel { grid-column: 1 / -1; }
    .manifest-panel .panel-heading { margin-bottom: 8px; }
    .manifest-count { color: var(--green-soft); font-size: 10px; }
    .manifest-list { display: grid; gap: 6px; }
    .manifest-empty { border: 1px dashed var(--green-faint); padding: 12px; color: var(--green-soft); font-size: 10px; text-align: center; }
    .manifest-row { display: grid; grid-template-columns: 48px minmax(0,1fr) auto; gap: 9px; align-items: center; border: 1px solid var(--green-faint); padding: 6px; background: rgba(0,18,5,.32); }
    .manifest-row.is-editing { border-color: var(--green); box-shadow: inset 0 0 0 1px var(--green-faint); }
    .manifest-thumb { width: 48px; height: 38px; object-fit: contain; background: rgba(0,0,0,.24); border: 1px solid var(--green-faint); }
    .manifest-copy { min-width: 0; }
    .manifest-copy strong { display: block; overflow-wrap: anywhere; font-size: 12px; }
    .manifest-copy span { display: block; margin-top: 2px; color: var(--green-soft); font-size: 9px; }
    .manifest-actions { display: flex; gap: 5px; }
    .manifest-actions button, .manifest-buttons button { border: 1px solid var(--green-soft); background: transparent; color: var(--green); cursor: pointer; font: 800 9px "Courier New", monospace; padding: 6px 8px; }
    .manifest-actions button:hover, .manifest-buttons button:hover { background: var(--green); color: #001b06; border-color: var(--green); }
    .manifest-buttons { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
    .manifest-buttons .manifest-primary { background: var(--green); color: #001b06; border-color: var(--green); }
    .manifest-status { min-height: 14px; margin-top: 6px; color: var(--green-soft); font-size: 9px; text-align: right; }
    .manifest-material-summary { margin-top: 8px; border-top: 1px solid var(--green-faint); padding-top: 7px; font-size: 9px; color: var(--green-soft); }
    .manifest-material-summary strong { color: var(--green); }
    @media (max-width: 700px) {
      .manifest-row { grid-template-columns: 42px minmax(0,1fr); }
      .manifest-actions { grid-column: 1 / -1; justify-content: flex-end; }
      .manifest-thumb { width: 42px; height: 34px; }
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.className = "terminal-panel manifest-panel";
  panel.innerHTML = `
    <div class="panel-heading">
      <h2>REQUEST MANIFEST</h2>
      <span class="manifest-count" id="manifestCount">0 / ${LIMIT} ITEM TYPES</span>
    </div>
    <div class="manifest-list" id="manifestList"></div>
    <div class="manifest-buttons">
      <button type="button" id="manifestAdd" class="manifest-primary">ADD TO REQUEST</button>
      <button type="button" id="manifestAnother">+ ADD ANOTHER ITEM</button>
      <button type="button" id="manifestClear">CLEAR MANIFEST</button>
    </div>
    <div class="manifest-status" id="manifestStatus" role="status"></div>
    <div class="manifest-material-summary" id="manifestMaterialSummary"></div>
  `;

  const configureGrid = document.querySelector(".configure-grid");
  if (!configureGrid) return;
  configureGrid.appendChild(panel);

  const list = $("manifestList");
  const count = $("manifestCount");
  const status = $("manifestStatus");
  const materialSummary = $("manifestMaterialSummary");
  const addButton = $("manifestAdd");

  const setStatus = (message) => {
    status.textContent = message;
  };

  const render = () => {
    count.textContent = `${state.items.length} / ${LIMIT} ITEM TYPES`;
    addButton.textContent = state.editingId ? "UPDATE ITEM" : "ADD TO REQUEST";
    list.replaceChildren();

    if (!state.items.length) {
      const empty = document.createElement("div");
      empty.className = "manifest-empty";
      empty.textContent = "NO ITEMS ADDED // CONFIGURE AN ITEM AND ADD IT TO THE REQUEST";
      list.appendChild(empty);
    }

    for (const item of state.items) {
      const row = document.createElement("div");
      row.className = `manifest-row${state.editingId === item.id ? " is-editing" : ""}`;
      row.dataset.id = item.id;

      const image = document.createElement("img");
      image.className = "manifest-thumb";
      image.alt = "";
      image.src = item.image || "assets/component-schematic.png";

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
    if (!totals.length) {
      materialSummary.textContent = "CONSOLIDATED MATERIALS // NONE AVAILABLE";
    } else {
      const totalUnits = totals.reduce((sum, material) => sum + material.total, 0);
      materialSummary.innerHTML = `<strong>CONSOLIDATED MATERIALS</strong> // ${totals.length} UNIQUE LINES // ${formatNumber(totalUnits)} TOTAL UNITS`;
    }
  };

  const addOrUpdate = () => {
    const draft = readDraft();
    if (!draft.name) {
      setStatus("ITEM NAME REQUIRED");
      $("itemName")?.focus();
      return;
    }

    const existingEditIndex = state.items.findIndex((item) => item.id === state.editingId);
    if (existingEditIndex >= 0) {
      state.items[existingEditIndex] = draft;
      state.editingId = null;
      setStatus("ITEM UPDATED");
      save();
      render();
      return;
    }

    const duplicateIndex = state.items.findIndex((item) => normalise(item.name) === normalise(draft.name));
    if (duplicateIndex >= 0) {
      state.items[duplicateIndex].quantity += draft.quantity;
      state.items[duplicateIndex].quality = draft.quality;
      state.items[duplicateIndex].materials = draft.materials;
      state.items[duplicateIndex].image = draft.image;
      state.items[duplicateIndex].details = draft.details;
      state.items[duplicateIndex].shared = draft.shared;
      setStatus("MATCHING ITEM FOUND // QUANTITIES MERGED");
      save();
      render();
      return;
    }

    if (state.items.length >= LIMIT) {
      setStatus(`MANIFEST LIMIT REACHED // ${LIMIT} ITEM TYPES`);
      return;
    }

    state.items.push(draft);
    setStatus("ITEM ADDED TO REQUEST");
    save();
    render();
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
    setStatus("EDITING MANIFEST ITEM // UPDATE WHEN COMPLETE");
    $("itemName")?.scrollIntoView({ block: "center", behavior: "smooth" });
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

  $("manifestAdd").addEventListener("click", addOrUpdate);

  $("manifestAnother").addEventListener("click", () => {
    if (state.items.length >= LIMIT) {
      setStatus(`MANIFEST LIMIT REACHED // ${LIMIT} ITEM TYPES`);
      return;
    }
    const shared = getShared();
    state.editingId = null;
    save();
    $("newSearchButton")?.click();
    setTimeout(() => restoreShared(shared), 0);
    setTimeout(() => restoreShared(shared), 250);
  });

  $("manifestClear").addEventListener("click", () => {
    if (!state.items.length) return;
    if (!confirm("CLEAR ALL ITEMS FROM THIS REQUEST MANIFEST?")) return;
    state.items = [];
    state.editingId = null;
    save();
    render();
    setStatus("REQUEST MANIFEST CLEARED");
  });

  const originalReview = $("reviewButton");
  originalReview?.addEventListener("click", (event) => {
    if (state.items.length <= 1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus("MULTI-ITEM REVIEW LAYOUT IS THE NEXT BUILD PHASE // MANIFEST SAVED");
    panel.scrollIntoView({ block: "center", behavior: "smooth" });
  }, true);

  window.coxswainManifest = {
    getItems: () => structuredClone(state.items),
    getAggregatedMaterials: () => structuredClone(aggregateMaterials()),
    clear: () => {
      state.items = [];
      state.editingId = null;
      save();
      render();
    },
  };

  render();
})();
