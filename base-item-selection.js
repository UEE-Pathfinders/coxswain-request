(() => {
  const ITEM_API = "https://api.star-citizen.wiki/items/";
  const $ = id => document.getElementById(id);
  const cache = new Map();
  let restoring = false;

  const normalise = value => String(value || "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const dispatchValue = (element, value) => {
    if (!element) return;
    element.value = value ?? "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const findText = (value, keys, seen = new Set()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);
    for (const key of keys) {
      if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
    }
    for (const child of Object.values(value)) {
      const found = findText(child, keys, seen);
      if (found) return found;
    }
    return "";
  };

  const showConfigure = () => {
    document.querySelectorAll(".terminal-view").forEach(view => {
      view.classList.toggle("active", view.dataset.view === "configure");
    });
    document.querySelectorAll('.step-nav button[data-step]').forEach(button => {
      button.classList.toggle("active", button.dataset.step === "configure");
    });
    const breadcrumb = $("breadcrumb");
    if (breadcrumb) breadcrumb.textContent = "FORUMS > CRAFTING TERMINAL > REQUEST > BASICS";
  };

  const currentQuery = () => normalise($("itemSearch")?.value);

  const recordFromCard = card => ({
    slug: card.dataset.verifiedBase || "",
    title: card.querySelector("strong")?.textContent?.trim() || "",
    meta: card.querySelector("span")?.textContent?.trim() || "VERIFIED EXACT ITEM",
  });

  const normaliseCard = card => {
    if (!card) return;
    card.disabled = false;
    card.removeAttribute("disabled");
    card.dataset.baseSelectable = "true";
    card.setAttribute("aria-label", `Select ${card.querySelector("strong")?.textContent?.trim() || "base item"}`);
    card.style.pointerEvents = "auto";
    card.style.cursor = "pointer";
    let action = card.querySelector("b");
    if (!action) {
      action = document.createElement("b");
      card.appendChild(action);
    }
    action.textContent = "SELECT >";
  };

  const makeCard = record => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.dataset.verifiedBase = record.slug;
    const name = document.createElement("strong");
    name.textContent = record.title;
    const meta = document.createElement("span");
    meta.textContent = record.meta || "VERIFIED EXACT ITEM";
    const action = document.createElement("b");
    action.textContent = "SELECT >";
    card.append(name, meta, action);
    normaliseCard(card);
    return card;
  };

  const cacheVisibleCards = list => {
    const query = currentQuery();
    if (!query) return;
    const records = [...list.querySelectorAll(".result-card[data-verified-base]")]
      .map(card => {
        normaliseCard(card);
        return recordFromCard(card);
      })
      .filter(record => record.slug && record.title);
    if (records.length) cache.set(query, records);
  };

  const restoreCards = list => {
    if (restoring) return;
    const query = currentQuery();
    const records = cache.get(query);
    if (!query || !records?.length) return;
    const existing = new Set([...list.querySelectorAll(".result-card strong")].map(node => normalise(node.textContent)));
    const missing = records.filter(record => !existing.has(normalise(record.title)));
    if (!missing.length) return;
    restoring = true;
    for (const record of [...missing].reverse()) list.prepend(makeCard(record));
    queueMicrotask(() => { restoring = false; });
  };

  const enrich = async (slug, expectedTitle) => {
    if (!slug) return;
    try {
      const response = await fetch(`${ITEM_API}${encodeURIComponent(slug)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json();
      const root = payload?.data ?? payload?.result ?? payload;
      const name = findText(root, ["name", "display_name", "title"]);
      const description = findText(root, ["description", "short_description"]);
      if (normalise($("itemName")?.value) !== normalise(expectedTitle)) return;
      if (name) dispatchValue($("itemName"), name);
      if (description) dispatchValue($("detailsText"), description);
    } catch (error) {
      console.warn(`Verified item enrichment failed for ${expectedTitle}`, error);
    }
  };

  const selectCard = event => {
    const card = event.target.closest?.(".result-card[data-verified-base]");
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    normaliseCard(card);
    const title = card.querySelector("strong")?.textContent?.trim();
    const slug = card.dataset.verifiedBase || "";
    if (!title) return;

    showConfigure();
    dispatchValue($("itemName"), title);
    dispatchValue($("requestQuantity"), 1);
    const source = $("sourceReadout");
    if (source) source.textContent = "SOURCE: Star Citizen Wiki API // VERIFIED EXACT ITEM";
    const status = $("imageStatus");
    if (status) status.textContent = `RESOLVING ITEM VISUAL: ${title.toUpperCase()}`;
    enrich(slug, title);
  };

  const setup = () => {
    const list = $("searchResults");
    if (!list) return;

    const observer = new MutationObserver(() => {
      cacheVisibleCards(list);
      setTimeout(() => restoreCards(list), 0);
    });
    observer.observe(list, { childList: true, subtree: true });

    $("searchForm")?.addEventListener("submit", () => setTimeout(() => restoreCards(list), 80));
    $("itemSearch")?.addEventListener("input", () => setTimeout(() => restoreCards(list), 80));
    cacheVisibleCards(list);
    restoreCards(list);
  };

  document.addEventListener("pointerdown", selectCard, true);
  document.addEventListener("click", selectCard, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();