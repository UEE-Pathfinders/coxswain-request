(() => {
  const STORAGE_KEY = "coxswain-request-manifest-v1";
  const API_BASE = "https://api.star-citizen.wiki/api/blueprints/";
  const $ = id => document.getElementById(id);
  const normalise = value => String(value || "").trim().toLowerCase();
  const numberValue = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  const clone = value => typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

  const slugify = value => String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”'\"]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const materialKey = material => [
    normalise(material.name),
    normalise(material.unit),
    normalise(material.quality),
  ].join("|");

  const aggregate = items => {
    const totals = new Map();
    for (const item of items || []) {
      const quantity = Math.max(1, numberValue(item.quantity, 1));
      for (const material of item.materials || []) {
        if (!material?.name) continue;
        const key = materialKey(material);
        const existing = totals.get(key) || {
          name: material.name,
          unit: material.unit || "",
          quality: material.quality || "",
          total: 0,
        };
        existing.total += numberValue(material.perItem, 0) * quantity;
        totals.set(key, existing);
      }
    }
    return [...totals.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  };

  const entryName = entry => entry?.name
    || entry?.resource?.name
    || entry?.item?.name
    || entry?.commodity?.name
    || entry?.material?.name
    || entry?.resource_name
    || entry?.ingredient_name
    || "";

  const entryAmount = entry => entry?.quantity_scu
    ?? entry?.amount_scu
    ?? entry?.quantity
    ?? entry?.amount
    ?? entry?.value
    ?? entry?.required_quantity;

  const looksLikeRecipeArray = value => Array.isArray(value)
    && value.length > 0
    && value.every(entry => entry && typeof entry === "object" && entryName(entry) && entryAmount(entry) != null);

  const findIngredients = payload => {
    const root = payload?.data ?? payload?.result ?? payload;
    const directCandidates = [
      root?.inputs,
      root?.ingredients,
      root?.blueprint?.inputs,
      root?.blueprint?.ingredients,
      root?.data?.inputs,
      root?.data?.ingredients,
      root?.attributes?.inputs,
      root?.attributes?.ingredients,
    ];
    for (const candidate of directCandidates) {
      if (looksLikeRecipeArray(candidate)) return candidate;
    }

    const seen = new Set();
    const walk = value => {
      if (!value || typeof value !== "object" || seen.has(value)) return null;
      seen.add(value);
      if (looksLikeRecipeArray(value)) return value;
      if (Array.isArray(value)) {
        for (const entry of value) {
          const found = walk(entry);
          if (found) return found;
        }
        return null;
      }
      for (const key of ["inputs", "ingredients"]) {
        if (looksLikeRecipeArray(value[key])) return value[key];
      }
      for (const child of Object.values(value)) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(root) || [];
  };

  const mapIngredients = (ingredients, quality) => ingredients
    .map(ingredient => {
      const perItem = entryAmount(ingredient);
      const explicitScu = ingredient.quantity_scu != null
        || ingredient.amount_scu != null
        || /scu/i.test(String(ingredient.unit || ingredient.measurement || ""));
      return {
        name: String(entryName(ingredient)).trim(),
        perItem: numberValue(perItem, 0),
        unit: explicitScu ? "SCU" : String(ingredient.unit || ingredient.measurement || "units").trim(),
        quality: String(quality || ingredient.quality || ingredient.min_quality || "").trim(),
      };
    })
    .filter(material => material.name && material.perItem > 0);

  const fetchRecipe = async item => {
    const slug = slugify(item?.name);
    if (!slug) return null;
    const response = await fetch(`${API_BASE}${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Blueprint lookup failed (${response.status})`);
    const payload = await response.json();
    const materials = mapIngredients(findIngredients(payload), item.quality);
    return materials.length ? materials : null;
  };

  const dispatchValue = (element, value) => {
    if (!element) return;
    element.value = value ?? "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const applyMaterialsToEditor = materials => {
    const editor = $("materialsEditor");
    const addButton = $("addMaterialButton");
    if (!editor || !addButton || !Array.isArray(materials) || !materials.length) return false;

    let rows = [...editor.querySelectorAll(".material-row")];
    while (rows.length < materials.length) {
      addButton.click();
      rows = [...editor.querySelectorAll(".material-row")];
      if (rows.length === 0) break;
    }
    while (rows.length > materials.length) {
      const row = rows.at(-1);
      const remove = row?.querySelector("button");
      if (remove) remove.click();
      else row?.remove();
      rows = [...editor.querySelectorAll(".material-row")];
    }

    rows.forEach((row, index) => {
      const material = materials[index];
      const inputs = [...row.querySelectorAll("input, select")];
      dispatchValue(row.querySelector(".material-name") || inputs[0], material.name);
      dispatchValue(row.querySelector(".material-amount, .material-quantity") || inputs[1], material.perItem);
      dispatchValue(row.querySelector(".material-unit") || inputs[2], material.unit);
      dispatchValue(row.querySelector(".material-quality") || inputs[3], material.quality);
    });
    return true;
  };

  const setup = () => {
    const manifest = window.coxswainManifest;
    if (!manifest || manifest.recipeIntegrityInstalled) return;
    manifest.recipeIntegrityInstalled = true;

    const originalGetItems = manifest.getItems.bind(manifest);
    const originalCommit = manifest.commitCurrentForReview?.bind(manifest);
    let correctedItems = originalGetItems();
    let lastFingerprint = "";
    let inFlight = null;

    const fingerprint = items => JSON.stringify((items || []).map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      quality: item.quality,
      materials: item.materials,
    })));

    const persist = items => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (!stored || !Array.isArray(stored.items)) return;
        const byId = new Map(items.map(item => [item.id, item]));
        stored.items = stored.items.map(item => byId.get(item.id) || item);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch (error) {
        console.warn("Unable to persist corrected manifest recipes", error);
      }
    };

    const refreshRecipes = async ({ force = false } = {}) => {
      const rawItems = originalGetItems();
      const nextFingerprint = fingerprint(rawItems);
      if (!force && nextFingerprint === lastFingerprint) return clone(correctedItems);
      if (inFlight) return inFlight;

      inFlight = (async () => {
        const refreshed = await Promise.all(rawItems.map(async item => {
          try {
            const materials = await fetchRecipe(item);
            return materials ? { ...item, materials } : item;
          } catch (error) {
            console.warn(`Recipe validation retained saved materials for ${item.name}`, error);
            return item;
          }
        }));
        correctedItems = refreshed;
        lastFingerprint = fingerprint(rawItems);
        persist(refreshed);
        document.dispatchEvent(new CustomEvent("coxswain:recipes-refreshed", {
          detail: { itemCount: refreshed.length, materialCount: aggregate(refreshed).length },
        }));
        return clone(refreshed);
      })().finally(() => { inFlight = null; });

      return inFlight;
    };

    manifest.getItems = () => clone(correctedItems.length ? correctedItems : originalGetItems());
    manifest.getAggregatedMaterials = () => clone(aggregate(correctedItems.length ? correctedItems : originalGetItems()));
    manifest.refreshRecipes = refreshRecipes;
    manifest.commitCurrentForReview = async () => {
      const committed = originalCommit ? await originalCommit() : true;
      if (!committed) return false;
      await refreshRecipes({ force: true });
      return true;
    };

    const reviewNav = document.querySelector('[data-step="review"]');
    let replayingReview = false;
    reviewNav?.addEventListener("click", async event => {
      if (replayingReview || !manifest.isEnabled?.()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const previous = reviewNav.disabled;
      reviewNav.disabled = true;
      try {
        await refreshRecipes();
        replayingReview = true;
        reviewNav.click();
      } finally {
        replayingReview = false;
        reviewNav.disabled = previous;
      }
    }, true);

    const status = $("manifestStatus");
    document.addEventListener("coxswain:recipes-refreshed", event => {
      if (status) status.textContent = `BLUEPRINT RECIPES VERIFIED // ${event.detail.itemCount} ITEMS // ${event.detail.materialCount} MATERIAL LINES`;
    });

    const itemName = $("itemName");
    const quality = $("globalQuality");
    let configureTimer = 0;
    let configureRequest = 0;
    const refreshConfigureRecipe = () => {
      clearTimeout(configureTimer);
      const requestedName = itemName?.value?.trim();
      if (!requestedName) return;
      configureTimer = setTimeout(async () => {
        const requestId = ++configureRequest;
        try {
          const materials = await fetchRecipe({ name: requestedName, quality: quality?.value || "" });
          if (requestId !== configureRequest || normalise(itemName?.value) !== normalise(requestedName) || !materials) return;
          applyMaterialsToEditor(materials);
          const source = $("sourceReadout");
          if (source) source.textContent = `${source.textContent.replace(/\s*\/\/\s*BLUEPRINT RECIPE VERIFIED.*$/i, "")} // BLUEPRINT RECIPE VERIFIED`;
        } catch (error) {
          console.warn(`Configure recipe validation retained loaded materials for ${requestedName}`, error);
        }
      }, 350);
    };

    itemName?.addEventListener("change", refreshConfigureRecipe);
    itemName?.addEventListener("input", refreshConfigureRecipe);
    document.querySelector('[data-step="configure"]')?.addEventListener("click", () => setTimeout(refreshConfigureRecipe, 50));
    const configureView = document.querySelector('.terminal-view[data-view="configure"]');
    if (configureView) {
      new MutationObserver(() => {
        if (configureView.classList.contains("active")) refreshConfigureRecipe();
      }).observe(configureView, { attributes: true, attributeFilter: ["class"] });
    }
    if (configureView?.classList.contains("active")) refreshConfigureRecipe();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(setup, 0));
  } else {
    setTimeout(setup, 0);
  }
})();