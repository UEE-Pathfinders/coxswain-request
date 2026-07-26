(() => {
  const nativeFetch = window.fetch.bind(window);
  const API_ORIGIN = "https://api.star-citizen.wiki";
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

  const directName = value => {
    if (!value || typeof value !== "object") return "";
    for (const key of ["name", "display_name", "displayName", "title"]) {
      if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
    }
    for (const key of ["data", "item", "result"]) {
      const child = value[key];
      if (!child || typeof child !== "object" || Array.isArray(child)) continue;
      for (const nameKey of ["name", "display_name", "displayName", "title"]) {
        if (typeof child[nameKey] === "string" && child[nameKey].trim()) return child[nameKey].trim();
      }
    }
    return "";
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

  const TYPE_WORDS = new Set([
    "smg", "rifle", "pistol", "shotgun", "lmg", "sniper", "launcher", "cannon",
    "helmet", "arms", "core", "legs", "undersuit", "backpack", "armour", "armor",
    "module", "component", "generator", "cooler", "shield", "drive", "weapon", "magazine",
  ]);

  const locateSearchArray = (payload, query) => {
    const queryWords = normalise(query).split(" ").filter(Boolean);
    let best = null;
    const seen = new Set();

    const visit = value => {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        const named = value
          .map((entry, index) => ({ entry, index, name: directName(entry) }))
          .filter(item => item.name);
        if (named.length >= 2) {
          const matching = named.filter(item => {
            const text = normalise(item.name);
            return queryWords.some(word => word.length > 1 && text.includes(word));
          }).length;
          const score = named.length + matching * 5;
          if (matching >= 2 && (!best || score > best.score)) best = { value, score };
        }
        value.forEach(visit);
        return;
      }
      Object.values(value).forEach(visit);
    };

    visit(payload);
    return best?.value || null;
  };

  const exactCandidates = (query, entries) => {
    const cleanQuery = String(query || "").trim();
    const queryWords = new Set(normalise(cleanQuery).split(" ").filter(Boolean));
    const candidates = new Set();

    for (const entry of entries) {
      const name = directName(entry);
      if (!name) continue;
      const words = normalise(name).split(" ");
      const type = [...words].reverse().find(word => TYPE_WORDS.has(word));
      if (type && !queryWords.has(type)) candidates.add(`${cleanQuery} ${type.toUpperCase()}`);

      const stripped = name
        .replace(/\s*[“\"][^”\"]+[”\"]\s*/g, " ")
        .replace(/\s*\([^)]*(?:edition|variant|paint|skin|colour|color)[^)]*\)\s*/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (stripped && normalise(stripped) !== normalise(name)) candidates.add(stripped);
    }

    return [...candidates].filter(Boolean).slice(0, 8);
  };

  const unwrapItem = payload => payload?.data?.data ?? payload?.data ?? payload?.result ?? payload?.item ?? payload;

  const fetchExactItem = async candidate => {
    const slug = slugify(candidate);
    if (!slug) return null;
    const routes = [`${API_ORIGIN}/items/${encodeURIComponent(slug)}`, `${API_ORIGIN}/api/items/${encodeURIComponent(slug)}`];
    for (const route of routes) {
      try {
        const response = await nativeFetch(route, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!response.ok) continue;
        const root = unwrapItem(await response.json());
        const actual = directName(root) || findText(root, ["name", "display_name", "displayName", "title"]);
        if (actual && normalise(actual) === normalise(candidate)) return root;
      } catch {}
    }
    return null;
  };

  const compatibleRecord = (exact, template, candidate) => {
    const record = { ...(template || {}), ...(exact || {}) };
    const exactName = directName(exact) || findText(exact, ["name", "display_name", "displayName", "title"]) || candidate;
    if ("name" in record || !("display_name" in record) && !("displayName" in record) && !("title" in record)) record.name = exactName;
    if ("display_name" in record) record.display_name = exactName;
    if ("displayName" in record) record.displayName = exactName;
    if ("title" in record) record.title = exactName;
    return record;
  };

  const augmentSearchPayload = async (payload, query) => {
    const results = locateSearchArray(payload, query);
    if (!results?.length) return payload;

    const existing = new Set(results.map(entry => normalise(directName(entry))).filter(Boolean));
    const candidates = exactCandidates(query, results).filter(candidate => !existing.has(normalise(candidate)));
    if (!candidates.length) return payload;

    const verified = [];
    for (const candidate of candidates) {
      const exact = await fetchExactItem(candidate);
      if (!exact) continue;
      const name = normalise(directName(exact) || findText(exact, ["name", "display_name", "displayName", "title"]));
      if (!name || existing.has(name)) continue;
      existing.add(name);
      const template = results.find(entry => {
        const item = normalise(directName(entry));
        return normalise(candidate).split(" ").every(word => !word || item.includes(word) || TYPE_WORDS.has(word));
      }) || results[0];
      verified.push(compatibleRecord(exact, template, candidate));
    }

    if (!verified.length) return payload;
    const limit = results.length;
    results.splice(0, results.length, ...verified, ...results);
    results.length = Math.min(limit, results.length);
    return payload;
  };

  const requestQuery = (input, init, url) => {
    for (const key of ["query", "q", "search", "term", "filter[search]"]) {
      const value = url.searchParams.get(key);
      if (value?.trim()) return value.trim();
    }
    const body = init?.body;
    if (typeof body === "string") {
      try {
        const json = JSON.parse(body);
        const value = json.query ?? json.q ?? json.search ?? json.term;
        if (value) return String(value).trim();
      } catch {
        const params = new URLSearchParams(body);
        const value = params.get("query") ?? params.get("q") ?? params.get("search") ?? params.get("term");
        if (value) return value.trim();
      }
    }
    return $("itemSearch")?.value?.trim() || "";
  };

  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    try {
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      if (!response.ok || !/api\.star-citizen\.wiki$/i.test(url.hostname)) return response;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("json")) return response;
      const query = requestQuery(input, init, url);
      if (!query) return response;
      const payload = await response.clone().json();
      if (!locateSearchArray(payload, query)) return response;
      await augmentSearchPayload(payload, query);
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
    } catch (error) {
      console.warn("Exact item search normalisation retained original response", error);
      return response;
    }
  };

  const titleTokens = title => normalise(title).split(" ").filter(token => token.length > 2);
  const imageScore = (source, title) => {
    const text = normalise(decodeURIComponent(String(source || "")));
    const titleText = normalise(title);
    let score = 0;
    titleTokens(title).forEach(token => { if (text.includes(token)) score += 5; });
    if (titleText.includes("helmet")) {
      if (text.includes("helmet")) score += 30;
      if (/\b(arms|core|legs|set|undersuit)\b/.test(text)) score -= 60;
    }
    if (titleText.includes("arms") && text.includes("arms")) score += 30;
    if (titleText.includes("core") && text.includes("core")) score += 30;
    if (titleText.includes("legs") && text.includes("legs")) score += 30;
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
    parseUrl.search = new URLSearchParams({ action: "parse", format: "json", origin: "*", redirects: "1", prop: "images", page: title });
    const response = await nativeFetch(parseUrl.toString(), { cache: "no-store" });
    if (!response.ok) return "";
    const payload = await response.json();
    const filenames = Array.isArray(payload?.parse?.images) ? payload.parse.images : [];
    const selected = filenames.map(filename => ({ filename, score: imageScore(filename, title) })).sort((a, b) => b.score - a.score)[0];
    if (!selected || selected.score < 1) return "";
    const imagePayload = await wikiRequest({ prop: "imageinfo", iiprop: "url", titles: `File:${selected.filename}` });
    const page = Object.values(imagePayload?.query?.pages || {})[0];
    return page?.imageinfo?.[0]?.url || "";
  };

  const getExactItemImage = async title => {
    const exact = await fetchExactItem(title);
    const source = exact ? bestImageFromPayload(exact, title) : "";
    if (source) return source;
    try { return await getScoredWikiImage(title); } catch { return ""; }
  };

  const setupExactImageResolver = () => {
    const itemNameField = $("itemName");
    const image = $("configureImage");
    const status = $("imageStatus");
    const configureView = document.querySelector('.terminal-view[data-view="configure"]');
    if (!itemNameField || !image) return;
    let timer = 0;
    let token = 0;
    let resolvedTitle = "";
    let resolvedSource = "";
    let applying = false;
    const resolve = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const title = itemNameField.value.trim();
        if (!title) return;
        const request = ++token;
        const source = await getExactItemImage(title);
        if (!source || request !== token || normalise(itemNameField.value) !== normalise(title)) return;
        resolvedTitle = normalise(title);
        resolvedSource = source;
        applying = true;
        image.src = source;
        image.dataset.exactItemImage = source;
        applying = false;
        if (status) status.textContent = `STAR CITIZEN WIKI: ${title.toUpperCase()}`;
      }, 220);
    };
    itemNameField.addEventListener("input", resolve);
    itemNameField.addEventListener("change", resolve);
    if (configureView) new MutationObserver(() => { if (configureView.classList.contains("active")) resolve(); }).observe(configureView, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(() => {
      if (applying || !resolvedSource || normalise(itemNameField.value) !== resolvedTitle) return;
      if (image.src !== resolvedSource) {
        applying = true;
        image.src = resolvedSource;
        applying = false;
      }
    }).observe(image, { attributes: true, attributeFilter: ["src"] });
    if (configureView?.classList.contains("active")) resolve();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupExactImageResolver);
  else setupExactImageResolver();
})();