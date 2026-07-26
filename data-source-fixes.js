(() => {
  const nativeFetch = window.fetch.bind(window);
  const WIKI_API = "https://starcitizen.tools/api.php";

  const normalise = value => String(value || "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const baseTitleFromVariant = title => String(title || "")
    .replace(/\s*[“\"][^”\"]+[”\"]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const patchSearchPayload = payload => {
    const results = payload?.query?.search;
    if (!Array.isArray(results) || !results.length) return payload;

    const existing = new Set(results.map(entry => normalise(entry.title)));
    const promoted = [];

    for (const entry of results) {
      const baseTitle = baseTitleFromVariant(entry.title);
      if (!baseTitle || baseTitle === entry.title || existing.has(normalise(baseTitle))) continue;
      promoted.push({
        ...entry,
        title: baseTitle,
        snippet: "Exact base item",
        pageid: undefined,
      });
      existing.add(normalise(baseTitle));
    }

    if (promoted.length) payload.query.search = [...promoted, ...results];
    return payload;
  };

  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    try {
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      const isWikiSearch = /starcitizen\.tools$/i.test(url.hostname)
        && url.searchParams.get("action") === "query"
        && url.searchParams.get("list") === "search";
      if (!isWikiSearch || !response.ok) return response;

      const payload = patchSearchPayload(await response.clone().json());
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch {
      return response;
    }
  };

  const getPrimaryImage = async title => {
    const url = new URL(WIKI_API);
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      redirects: "1",
      prop: "pageimages",
      piprop: "original|thumbnail",
      pithumbsize: "1200",
      titles: title,
    });
    const response = await nativeFetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return "";
    const payload = await response.json();
    const page = Object.values(payload?.query?.pages || {})[0];
    return page?.original?.source || page?.thumbnail?.source || "";
  };

  const setupPrimaryImageResolver = () => {
    const itemName = document.getElementById("itemName");
    const image = document.getElementById("configureImage");
    const status = document.getElementById("imageStatus");
    if (!itemName || !image) return;

    let requestToken = 0;
    let timer = 0;
    const resolve = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const title = itemName.value.trim();
        if (!title) return;
        const token = ++requestToken;
        try {
          const source = await getPrimaryImage(title);
          if (!source || token !== requestToken || itemName.value.trim() !== title) return;
          image.src = source;
          image.dataset.primaryItemImage = "true";
          if (status) status.textContent = `STAR CITIZEN WIKI: ${title.toUpperCase()}`;
        } catch (error) {
          console.warn("Primary item image lookup failed", error);
        }
      }, 180);
    };

    itemName.addEventListener("input", resolve);
    itemName.addEventListener("change", resolve);
    new MutationObserver(resolve).observe(itemName, { attributes: true, attributeFilter: ["value"] });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupPrimaryImageResolver);
  } else {
    setupPrimaryImageResolver();
  }
})();