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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupExactImageResolver);
  else setupExactImageResolver();
})();