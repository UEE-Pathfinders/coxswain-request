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

  const findIngredients = payload => {
    const root = payload?.data ?? payload?.result ?? payload;
    const directCandidates = [
      root?.ingredients,
      root?.blueprint?.ingredients,
      root?.data?.ingredients,
      root?.attributes?.ingredients,
    ];
    for (const candidate of directCandidates) {
      if (Array.isArray(candidate) && candidate.length) return candidate;
    }

    const seen = new Set();
    const walk = value => {
      if (!value || typeof value !== "object" || seen.has(value)) return null;
      seen.add(value);
      if (Array.isArray(value)) {
        const looksLikeIngredients = value.length > 0 && value.every(entry =>
          entry && typeof entry === "object" && entry.name &&
          (entry.quantity_scu != null || entry.quantity != null || entry.amount != null)
        );
        if (looksLikeIngredients) return value;
        for (const entry of value) {
          const found = walk(entry);
          if (found) return found;
        }
        return null;
      }
      if (Array.isArray(value.ingredients) && value.ingredients.length) return value.ingredients;
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
      const perItem = ingredient.quantity_scu ?? ingredient.amount_scu ?? ingredient.quantity ?? ingredient.amount;
      const unit = ingredient.quantity_scu != null || ingredient.amount_scu != null
        ? "SCU"
        : (ingredient.unit || ingredient.measurement || "units");
      return {
        name: String(ingredient.name || ingredient.ingredient_name || "").trim(),
        perItem: numberValue(perItem, 0),
        unit: String(unit || "").trim(),
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
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(setup, 0));
  } else {
    setTimeout(setup, 0);
  }
})();