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

  const TYPE_WORDS = new Set([
    "smg", "rifle", "pistol", "shotgun", "lmg", "sniper", "launcher", "cannon",
    "helmet", "arms", "core", "legs", "undersuit", "backpack", "armour", "armor",
    "module", "component", "generator", "cooler", "shield", "drive", "quantum", "weapon",
  ]);

  const stripVariantDecoration = title => String(title || "")
    .replace(/\s*[“\"][^”\"]+[”\"]\s*/g, " ")
    .replace(/\s*\([^)]*(?:variant|edition|paint|skin|colour|color)?[^)]*\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const itemTypeFromTitle = title => {
    const words = normalise(title).split(" ");
    return words.findLast?.(word => TYPE_WORDS.has(word)) || [...words].reverse().find(word => TYPE_WORDS.has(word)) || "";
  };

  const candidateBaseTitles = (query, cards) => {
    const candidates = new Set();
    const cleanQuery = String(query || "").trim();
    const queryNorm = normalise(cleanQuery);

    for (const card of cards) {
      const title = card.querySelector("strong")?.textContent?.trim() || "";
      if (!title) continue;
      const stripped = stripVariantDecoration(title);
      if (stripped && normalise(stripped) !== normalise(title)) candidates.add(stripped);

      const type = itemTypeFromTitle(title);
      if (type && queryNorm && !queryNorm.split(" ").includes(type)) {
        candidates.add(`${cleanQuery} ${type.toUpperCase()}`.replace(/\s+/g, " ").trim());
      }
    }

    return [...candidates].filter(Boolean);
  };

  const verifyBaseCandidate = async title => {
    const slug = slugify(title);
    if (!slug) return null;
    try {
      const payload = await fetchItem(slug);
      const root = payload?.data ?? payload?.result ?? payload;
      const actualName = findText(root, ["name", "display_name", "title"]);
      if (!actualName) return null;
      const requested = normalise(title);
      const actual = normalise(actualName);
      if (actual !== requested && !actual.startsWith(requested) && !requested.startsWith(actual)) return null;
      return { title: actualName, slug, payload: root };
    } catch {
      try {
        const payload = await wikiRequest({ redirects: "1", prop: "info", titles: title });
        const page = Object.values(payload?.query?.pages || {})[0];
        if (!page || page.missing != null || page.invalid != null) return null;
        return { title: page.title || title, slug: slugify(page.title || title), payload: null };
      } catch {
        return null;
      }
    }
  };

  const selectExactBase = async (record, button) => {
    button.disabled = true;
    try {
      const root = record.payload || (await fetchItem(record.slug))?.data || await fetchItem(record.slug);
      const name = findText(root, ["name", "display_name", "title"]) || record.title;
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
      if (status) status.textContent = `STAR CITIZEN WIKI: ${name.toUpperCase()}`;
      const source = $("sourceReadout");
      if (source) source.textContent = "SOURCE: Star Citizen Wiki API // VERIFIED BASE ITEM";
    } catch (error) {
      console.warn(`Unable to load verified base item ${record.title}`, error);
      button.disabled = false;
    }
  };

  const baseDiscoveryState = { generation: 0, signatures: new Set() };

  const discoverBaseResults = async () => {
    const list = $("searchResults");
    const query = $("itemSearch")?.value?.trim() || "";
    if (!list || !query) return;

    const cards = [...list.querySelectorAll(".result-card:not([data-verified-base])")];
    const candidates = candidateBaseTitles(query, cards);
    if (!candidates.length) return;

    const generation = ++baseDiscoveryState.generation;
    const existingTitles = new Set([...list.querySelectorAll(".result-card strong")].map(node => normalise(node.textContent)));
    const records = (await Promise.all(candidates.map(verifyBaseCandidate))).filter(Boolean);
    if (generation !== baseDiscoveryState.generation || normalise($("itemSearch")?.value) !== normalise(query)) return;

    for (const record of records) {
      const signature = `${normalise(query)}|${normalise(record.title)}`;
      if (existingTitles.has(normalise(record.title)) || baseDiscoveryState.signatures.has(signature)) continue;
      baseDiscoveryState.signatures.add(signature);

      const card = document.createElement("button");
      card.type = "button";
      card.className = "result-card";
      card.dataset.verifiedBase = record.slug;
      const name = document.createElement("strong");
      name.textContent = record.title;
      const meta = document.createElement("span");
      meta.textContent = "VERIFIED EXACT BASE ITEM";
      const tag = document.createElement("b");
      tag.textContent = "BASE ITEM";
      card.append(name, meta, tag);
      card.addEventListener("click", () => selectExactBase(record, card));
      list.prepend(card);
      existingTitles.add(normalise(record.title));
    }
  };

  const setupSearchBase = () => {
    const form = $("searchForm");
    const list = $("searchResults");
    const queue = () => setTimeout(discoverBaseResults, 40);
    form?.addEventListener("submit", queue);
    $("itemSearch")?.addEventListener("input", () => {
      baseDiscoveryState.generation += 1;
      queue();
    });
    if (list) new MutationObserver(queue).observe(list, { childList: true, subtree: true });
    queue();
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