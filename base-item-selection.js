(() => {
  const ITEM_API = "https://api.star-citizen.wiki/items/";
  const $ = id => document.getElementById(id);

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
      if ($("itemName")?.value.trim() !== expectedTitle) return;
      if (name) dispatchValue($("itemName"), name);
      if (description) dispatchValue($("detailsText"), description);
    } catch (error) {
      console.warn(`Verified base item enrichment failed for ${expectedTitle}`, error);
    }
  };

  document.addEventListener("click", event => {
    const card = event.target.closest?.(".result-card[data-verified-base]");
    if (!card) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const title = card.querySelector("strong")?.textContent?.trim();
    const slug = card.dataset.verifiedBase || "";
    if (!title) return;

    showConfigure();
    dispatchValue($("itemName"), title);
    dispatchValue($("requestQuantity"), 1);

    const source = $("sourceReadout");
    if (source) source.textContent = "SOURCE: Star Citizen Wiki API // VERIFIED BASE ITEM";
    const status = $("imageStatus");
    if (status) status.textContent = `RESOLVING ITEM VISUAL: ${title.toUpperCase()}`;

    enrich(slug, title);
  }, true);
})();