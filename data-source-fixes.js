(() => {
  const nativeFetch = window.fetch.bind(window);
  const ITEM_API = "https://api.star-citizen.wiki/items/";
  const WIKI_API = "https://starcitizen.tools/api.php";
  const $ = id => document.getElementById(id);

  const normalise = value => String(value || "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const slugify = value => String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”'\"]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const dispatchValue = (element, value) => {
    if (!element) return;
    element.value = value ?? "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const collectStrings = (value, output = [], seen = new Set()) => {
    if (typeof value === "string") {
      output.push(value);
      return output;
    }
    if (!value || typeof value !== "object" || seen.has(value)) return output;
    seen.add(value);
    if (Array.isArray(value)) value.forEach(entry => collectStrings(entry, output, seen));
    else Object.values(value).forEach(entry => collectStrings(entry, output, seen));
    return output;
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

  const fetchItem = async slug => {
    const response = await nativeFetch(`${ITEM_API}${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Item lookup failed (${response.status})`);
    return response.json();
  };

  const titleTokens = title => normalise(title).split(" ").filter(token => token.length > 2);
  const imageScore = (source, title) => {
    const text = normalise(decodeURIComponent(String(source || "")));
    const tokens = titleTokens(title);
    let score = 0;
    tokens.forEach(token => { if (text.includes(token)) score += 5; });
    if (/helmet/.test(normalise(title))) {
      if (text.includes("helmet")) score += 30;
      if (/\b(arms|core|legs|set|undersuit)\b/.test(text)) score -= 60;
    }
    if (/arms/.test(normalise(title)) && text.includes("arms")) score += 30;
    if (/core/.test(normalise(title)) && text.includes("core")) score += 30;
    if (/legs/.test(normalise(title)) && text.includes("legs")) score += 30;
    if (/thumb|icon|logo|manufacturer/.test(text)) score -= 15;
    return score;
  };

  const bestImageFromPayload = (payload, title) => collectStrings(payload)
    .filter(value => /^https?:/i.test(value) && /\.(?:png|jpe?g|webp)(?:\?|$)/i.test(value))
    .map(source => ({ source, score: imageScore(source, title) }))
    .sort((a, b) => b.score - a.score)[0]?.source || "";

  const wikiRequest = async params => {
    const url = new URL(WIKI_API);
    url.search = new URLSearchParams({ action: "query", format: "json", origin: "*", ...params });
    const response = await nativeFetch(url.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error(`Wiki lookup failed (${response.status})`);
    return response.json();
  };

  const getScoredWikiImage = async title => {
    const parseUrl = new URL(WIKI_API);
    parseUrl.search = new URLSearchParams({
      action: "parse",
      format: "json",
      origin: "*",
      redirects: "1",
      prop: "images",
      page: title,
    });
    const parseResponse = await nativeFetch(parseUrl.toString(), { cache: "no-store" });
    if (!parseResponse.ok) return "";
    const parsePayload = await parseResponse.json();
    const filenames = Array.isArray(parsePayload?.parse?.images) ? parsePayload.parse.images : [];
    const selected = filenames
      .map(filename => ({ filename, score: imageScore(filename, title) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!selected || selected.score < 1) return "";

    const payload = await wikiRequest({
      prop: "imageinfo",
      iiprop: "url",
      titles: `File:${selected.filename}`,
    });
    const page = Object.values(payload?.query?.pages || {})[0];
    return page?.imageinfo?.[0]?.url || "";
  };

  const getExactItemImage = async title => {
    const slug = slugify(title);
    if (!slug) return "";
    try {
      const payload = await fetchItem(slug);
      const source = bestImageFromPayload(payload, title);
      if (source) return source;
    } catch {}
    try {
      return await getScoredWikiImage(title);
    } catch {
      return "";
    }
  };

  const showConfigure = () => {
    document.querySelectorAll(".terminal-view").forEach(view => view.classList.toggle("active", view.dataset.view === "configure"));
    document.querySelectorAll('.step-nav button[data-step]').forEach(button => button.classList.toggle("active", button.dataset.step === "configure"));
    const breadcrumb = $("breadcrumb");
    if (breadcrumb) breadcrumb.textContent = "FORUMS > CRAFTING TERMINAL > REQUEST > BASICS";
  };

  const selectP8Base = async button => {
    button.disabled = true;
    try {
      const payload = await fetchItem("p8-sc-smg");
      const root = payload?.data ?? payload?.result ?? payload;
      const name = findText(root, ["name", "display_name", "title"]) || "P8-SC SMG";
      const description = findText(root, ["description", "short_description"]);
      const image = bestImageFromPayload(root, name) || await getExactItemImage(name);
      showConfigure();
      dispatchValue($("itemName"), name);
      dispatchValue($("requestQuantity"), 1);
      if (description) dispatchValue($("detailsText"), description);
      if (image && $("configureImage")) {
        $("configureImage").src = image;
        $("configureImage").dataset.exactItemImage = image;
      }
      const status = $("imageStatus");
      if (status) status.textContent = "STAR CITIZEN WIKI: P8-SC SMG";
      const source = $("sourceReadout");
      if (source) source.textContent = "SOURCE: Star Citizen Wiki API // EXACT BASE VARIANT";
    } catch (error) {
      console.warn("Unable to load exact P8-SC base item", error);
      button.disabled = false;
    }
  };

  const ensureP8BaseResult = () => {
    const query = normalise($("itemSearch")?.value);
    const list = $("searchResults");
    if (!list || !/^p8 sc(?: smg)?$/.test(query)) return;
    const existing = [...list.querySelectorAll(".result-card")].some(card => normalise(card.textContent).includes("p8 sc smg") && !/["“](warhawk|midnight|nightstalker|red alert|epoque|desert shadow|stormfall|boneyard)/i.test(card.textContent));
    if (existing || list.querySelector('[data-exact-base="p8-sc-smg"]')) return;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.dataset.exactBase = "p8-sc-smg";
    const name = document.createElement("strong");
    name.textContent = "P8-SC SMG";
    const meta = document.createElement("span");
    meta.textContent = "Behring Applied Technology // BASE VARIANT";
    const tag = document.createElement("b");
    tag.textContent = "EXACT ITEM";
    card.append(name, meta, tag);
    card.addEventListener("click", () => selectP8Base(card));
    list.prepend(card);
  };

  const setupSearchBase = () => {
    const form = $("searchForm");
    const list = $("searchResults");
    form?.addEventListener("submit", () => setTimeout(ensureP8BaseResult, 0));
    $("itemSearch")?.addEventListener("input", () => setTimeout(ensureP8BaseResult, 0));
    if (list) new MutationObserver(ensureP8BaseResult).observe(list, { childList: true, subtree: true });
    ensureP8BaseResult();
  };

  const setupExactImageResolver = () => {
    const itemName = $("itemName");
    const image = $("configureImage");
    const status = $("imageStatus");
    const configureView = document.querySelector('.terminal-view[data-view="configure"]');
    if (!itemName || !image) return;

    let timer = 0;
    let token = 0;
    let resolvedTitle = "";
    let resolvedSource = "";
    let applying = false;

    const resolve = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const title = itemName.value.trim();
        if (!title) return;
        const request = ++token;
        const source = await getExactItemImage(title);
        if (!source || request !== token || normalise(itemName.value) !== normalise(title)) return;
        resolvedTitle = normalise(title);
        resolvedSource = source;
        applying = true;
        image.src = source;
        image.dataset.exactItemImage = source;
        applying = false;
        if (status) status.textContent = `STAR CITIZEN WIKI: ${title.toUpperCase()}`;
      }, 220);
    };

    itemName.addEventListener("input", resolve);
    itemName.addEventListener("change", resolve);
    if (configureView) new MutationObserver(() => {
      if (configureView.classList.contains("active")) resolve();
    }).observe(configureView, { attributes: true, attributeFilter: ["class"] });

    new MutationObserver(() => {
      if (applying || !resolvedSource || normalise(itemName.value) !== resolvedTitle) return;
      if (image.src !== resolvedSource) {
        applying = true;
        image.src = resolvedSource;
        applying = false;
      }
    }).observe(image, { attributes: true, attributeFilter: ["src"] });

    if (configureView?.classList.contains("active")) resolve();
  };

  const setup = () => {
    setupSearchBase();
    setupExactImageResolver();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();