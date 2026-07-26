(() => {
  const nativeFetch = window.fetch.bind(window);
  const API_ORIGIN = "https://api.star-citizen.wiki";
  const ITEM_API = `${API_ORIGIN}/api/items/`;
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

  const fetchItem = async slug => {
    const response = await nativeFetch(`${ITEM_API}${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Item lookup failed (${response.status})`);
    return response.json();
  };

  const TYPE_WORDS = new Set([
    "smg", "rifle", "pistol", "shotgun", "lmg", "sniper", "launcher", "cannon",
    "helmet", "arms", "core", "legs", "undersuit", "backpack", "armour", "armor",
    "module", "component", "generator", "cooler", "shield", "drive", "weapon", "magazine",
  ]);

  const itemName = entry => findText(entry, ["name", "display_name", "displayName", "title"]);

  const resultArray = payload => {
    if (Array.isArray(payload?.data)) return { owner: payload, key: "data", value: payload.data };
    if (Array.isArray(payload?.results)) return { owner: payload, key: "results", value: payload.results };
    if (Array.isArray(payload?.items)) return { owner: payload, key: "items", value: payload.items };
    if (Array.isArray(payload?.data?.data)) return { owner: payload.data, key: "data", value: payload.data.data };
    if (Array.isArray(payload?.data?.results)) return { owner: payload.data, key: "results", value: payload.data.results };
    if (Array.isArray(payload?.meta?.results)) return { owner: payload.meta, key: "results", value: payload.meta.results };
    return null;
  };

  const exactCandidates = (query, entries) => {
    const cleanQuery = String(query || "").trim();
    const queryWords = new Set(normalise(cleanQuery).split(" ").filter(Boolean));
    const candidates = new Set();

    for (const entry of entries) {
      const name = itemName(entry);
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

    return [...candidates].filter(Boolean).slice(0, 6);
  };

  const verifyExactItem = async candidate => {
    try {
      const payload = await fetchItem(slugify(candidate));
      const root = payload?.data ?? payload?.result ?? payload;
      const actual = itemName(root);
      if (!actual || normalise(actual) !== normalise(candidate)) return null;
      return root;
    } catch {
      return null;
    }
  };

  const augmentItemSearchPayload = async (payload, query) => {
    const located = resultArray(payload);
    if (!located || !query || !located.value.length) return payload;

    const existing = new Set(located.value.map(entry => normalise(itemName(entry))).filter(Boolean));
    const candidates = exactCandidates(query, located.value)
      .filter(candidate => !existing.has(normalise(candidate)));
    if (!candidates.length) return payload;

    const exact = (await Promise.all(candidates.map(verifyExactItem))).filter(Boolean);
    if (!exact.length) return payload;

    const uniqueExact = exact.filter(entry => {
      const name = normalise(itemName(entry));
      if (!name || existing.has(name)) return false;
      existing.add(name);
      return true;
    });
    if (!uniqueExact.length) return payload;

    const originalLength = located.value.length;
    located.owner[located.key] = [...uniqueExact, ...located.value].slice(0, originalLength);
    return payload;
  };

  const requestUrl = input => new URL(typeof input === "string" ? input : input.url, location.href);

  const requestQuery = async (input, init, url) => {
    for (const key of ["query", "q", "search", "term", "filter[search]"]) {
      const value = url.searchParams.get(key);
      if (value?.trim()) return value.trim();
    }

    const pathMatch = url.pathname.match(/\/api\/search\/([^/]+)\/?$/i);
    if (pathMatch) return decodeURIComponent(pathMatch[1]).trim();

    const body = init?.body ?? (typeof input !== "string" ? input.body : null);
    if (!body) return $("itemSearch")?.value?.trim() || "";

    try {
      if (typeof body === "string") {
        try {
          const json = JSON.parse(body);
          return String(json.query ?? json.q ?? json.search ?? json.term ?? "").trim();
        } catch {
          const params = new URLSearchParams(body);
          return String(params.get("query") ?? params.get("q") ?? params.get("search") ?? params.get("term") ?? "").trim();
        }
      }
      if (body instanceof URLSearchParams || body instanceof FormData) {
        return String(body.get("query") ?? body.get("q") ?? body.get("search") ?? body.get("term") ?? "").trim();
      }
    } catch {}

    return $("itemSearch")?.value?.trim() || "";
  };

  const isSearchRequest = url => {
    if (!/api\.star-citizen\.wiki$/i.test(url.hostname)) return false;
    return /\/api\/(?:search(?:\/|$)|items\/search\/?$|items\/?$)/i.test(url.pathname)
      || /^\/(?:search(?:\/|$)|items\/search\/?$|items\/?$)/i.test(url.pathname);
  };

  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    try {
      const url = requestUrl(input);
      if (!response.ok || !isSearchRequest(url)) return response;

      const query = await requestQuery(input, init, url);
      if (!query) return response;

      const payload = await augmentItemSearchPayload(await response.clone().json(), query);
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.warn("Exact item search ranking retained original results", error);
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
    parseUrl.search = new URLSearchParams({
      action: "parse",
      format: "json",
      origin: "*",
      redirects: "1",
      prop: "images",
      page: title,
    });
    const response = await nativeFetch(parseUrl.toString(), { cache: "no-store" });
    if (!response.ok) return "";
    const payload = await response.json();
    const filenames = Array.isArray(payload?.parse?.images) ? payload.parse.images : [];
    const selected = filenames
      .map(filename => ({ filename, score: imageScore(filename, title) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!selected || selected.score < 1) return "";

    const imagePayload = await wikiRequest({
      prop: "imageinfo",
      iiprop: "url",
      titles: `File:${selected.filename}`,
    });
    const page = Object.values(imagePayload?.query?.pages || {})[0];
    return page?.imageinfo?.[0]?.url || "";
  };

  const getExactItemImage = async title => {
    const slug = slugify(title);
    if (!slug) return "";
    try {
      const source = bestImageFromPayload(await fetchItem(slug), title);
      if (source) return source;
    } catch {}
    try {
      return await getScoredWikiImage(title);
    } catch {
      return "";
    }
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
    if (configureView) new MutationObserver(() => {
      if (configureView.classList.contains("active")) resolve();
    }).observe(configureView, { attributes: true, attributeFilter: ["class"] });

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