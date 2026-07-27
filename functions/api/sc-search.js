const API_ORIGIN = "https://api.star-citizen.wiki";
const WIKI_API = "https://starcitizen.tools/api.php";
const ALLOWED_IMAGE_HOSTS = ["starcitizen.tools", "star-citizen.wiki", "static.wikia.nocookie.net", "wikia.nocookie.net"];
// Served back under our own origin, so the proxy must only ever emit a real
// raster image. SVG is excluded deliberately — it can carry script.
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const mode = url.searchParams.get("mode") || "search";
  try {
    if (mode === "image") return await proxyImage(url);
    if (mode === "detail") return await getDetail(url);
    return await search(url);
  } catch (error) {
    return json({ error: error.message || "Lookup failed" }, 502);
  }
}

async function search(requestUrl) {
  const query = (requestUrl.searchParams.get("q") || "").trim();
  if (query.length < 2 || query.length > 64) return json({ error: "Query must contain 2–64 characters." }, 400);

  const [apiResults, baseItemResults, wikiResults] = await Promise.allSettled([
    searchGameData(query),
    searchBaseItems(query),
    searchWikiPages(query)
  ]);
  const combined = [
    ...(baseItemResults.status === "fulfilled" ? baseItemResults.value : []),
    ...(apiResults.status === "fulfilled" ? apiResults.value : []),
    ...(wikiResults.status === "fulfilled" ? wikiResults.value : [])
  ];
  const seen = new Set();
  const results = combined.filter(result => {
    const key = normalize(result.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return json({ results });
}

async function searchGameData(query) {
  const upstream = new URL("/api/search", API_ORIGIN);
  upstream.searchParams.set("filter[query]", query);
  upstream.searchParams.set("page[size]", "100");
  const payload = await fetchJson(upstream, 900);
  return (Array.isArray(payload.data) ? payload.data : [])
    .filter(group => ["items", "blueprints"].includes(group.type))
    .flatMap(group => (group.results || []).map(result => ({
      name: result.name,
      itemName: result.name,
      type: group.type,
      label: group.label,
      meta: [result.item_type_label, result.classification_label, result.extra_label].filter(Boolean).join(" // "),
      apiUrl: result.api_url,
      webUrl: result.web_url
    })));
}

async function searchBaseItems(query) {
  const upstream = new URL("/api/items", API_ORIGIN);
  upstream.searchParams.set("filter[name]", query);
  upstream.searchParams.set("page[size]", "100");
  const payload = await fetchJson(upstream, 900);
  const needle = normalize(query);
  return (Array.isArray(payload.data) ? payload.data : [])
    .filter(item => item.is_base_variant && normalize(item.name).includes(needle))
    .map(item => ({
      name: item.name,
      itemName: item.name,
      type: "items",
      label: "Items",
      meta: [item.type_label, item.classification_label, "Standard item"].filter(Boolean).join(" // "),
      apiUrl: item.link || `${API_ORIGIN}/api/items/${encodeURIComponent(item.slug)}`,
      webUrl: item.web_url
    }));
}
async function searchWikiPages(query) {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srnamespace", "0");
  url.searchParams.set("srlimit", "8");
  const payload = await fetchJson(url, 1800);
  return (payload.query?.search || [])
    .filter(page => /\([^)]*\)/.test(page.title) || /power plant|cooler|shield|quantum|weapon|component|generator/i.test(page.snippet || ""))
    .map(page => ({
      name: page.title,
      itemName: page.title.replace(/\s*\([^)]*\)\s*$/, ""),
      type: "wiki",
      label: "Star Citizen Tools page",
      meta: "WIKI PAGE // MAY SUPPLEMENT ITEM DATA",
      apiUrl: "",
      wikiTitle: page.title,
      webUrl: `https://starcitizen.tools/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`
    }));
}

async function getDetail(requestUrl) {
  const rawUrl = requestUrl.searchParams.get("url") || "";
  const expectedName = (requestUrl.searchParams.get("name") || "").trim();
  const wikiTitle = (requestUrl.searchParams.get("wikiTitle") || "").trim();
  const typeHint = (requestUrl.searchParams.get("type") || "").trim();

  let data = {};
  let payload = {};
  if (rawUrl) {
    const upstream = validateApiUrl(rawUrl);
    upstream.searchParams.set("include", mergeIncludes(upstream.searchParams.get("include"), "blueprints"));
    payload = await fetchJson(upstream, 1800);
    data = payload.data || payload;
  } else if (expectedName) {
    const resolved = await resolveItem(expectedName, typeHint);
    if (resolved) {
      payload = await fetchJson(validateApiUrl(resolved.apiUrl), 1800);
      data = payload.data || payload;
    }
  }

  let blueprint = pickBlueprint(data);
  if (!blueprint && expectedName) blueprint = await findBlueprint(expectedName);
  if (blueprint?.link && !blueprint.ingredients?.length) {
    try {
      const blueprintPayload = await fetchJson(validateApiUrl(blueprint.link), 1800);
      blueprint = blueprintPayload.data || blueprintPayload;
    } catch { /* retain link-level blueprint */ }
  }

  const name = data.name || data.output_name || blueprint?.output_name || expectedName || wikiTitle.replace(/\s*\([^)]*\)\s*$/, "");
  const itemType = data.type_label || data.classification_label || blueprint?.output?.type_label || typeHint;
  const wiki = await getBestWikiSummary(wikiTitle, name, itemType);
  const description = normalizeText(data.description) || wiki.description;
  const apiImage = findImageUrl(data);
  const imageUrl = isUsableWikiImage(apiImage) ? apiImage : isUsableWikiImage(wiki.imageUrl) ? wiki.imageUrl : "";

  return json({
    name,
    description,
    manufacturer: data.manufacturer?.name || data.manufacturer_description || "",
    size: data.size ?? null,
    grade: data.grade || blueprint?.output?.grade || "",
    class: data.class || data.sub_type_label || blueprint?.output?.sub_type || "",
    type: itemType || "",
    imageUrl,
    imageOrigin: imageUrl ? (apiImage ? "Star Citizen Wiki item image" : `starcitizen.tools: ${wiki.title}`) : "",
    sourceUrl: data.web_url || blueprint?.output_item_web_url || wiki.sourceUrl || blueprint?.web_url || "",
    sourceName: "Star Citizen Wiki API + starcitizen.tools",
    gameVersion: data.game_version || blueprint?.game_version || payload.meta?.game_version || "",
    blueprintName: blueprint?.output_name ? `${blueprint.output_name} blueprint` : blueprint?.key || "",
    materials: extractIngredients(blueprint).map(ingredient => ({
      name: ingredient.name || "Material",
      perUnit: number(ingredient.quantity_scu ?? ingredient.quantity),
      unit: ingredient.quantity_scu != null ? "SCU" : "units"
    }))
  }, 200, 1800);
}

async function resolveItem(name, typeHint) {
  const url = new URL("/api/search", API_ORIGIN);
  url.searchParams.set("filter[query]", name);
  const payload = await fetchJson(url, 900);
  const items = (payload.data || []).find(group => group.type === "items")?.results || [];
  const hint = normalize(typeHint);
  const preferred = items.find(item => hint && normalize([item.item_type_label, item.classification_label, item.extra_label].filter(Boolean).join(" ")).includes(hint)) || items[0];
  return preferred ? { apiUrl: preferred.api_url, webUrl: preferred.web_url } : null;
}

async function findBlueprint(name) {
  const url = new URL("/api/blueprints", API_ORIGIN);
  url.searchParams.set("filter[output_name]", name);
  url.searchParams.set("page[size]", "5");
  try {
    const payload = await fetchJson(url, 1800);
    const entries = Array.isArray(payload.data) ? payload.data : [];
    return entries.find(entry => normalize(entry.output_name) === normalize(name)) || entries[0] || null;
  } catch { return null; }
}

async function getBestWikiSummary(explicitTitle, name, type) {
  const candidates = [...new Set([
    explicitTitle,
    type ? `${name} (${String(type).toLowerCase()})` : "",
    /power plant/i.test(type || "") ? `${name} (power plant)` : "",
    /power plant/i.test(type || "") ? `${name} (Generator)` : "",
    name
  ].filter(Boolean))];

  for (const title of candidates) {
    const summary = await getWikiSummary(title);
    if (summary.description || summary.imageUrl) return summary;
  }
  return { title: "", description: "", imageUrl: "", sourceUrl: "" };
}

async function getWikiSummary(title) {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("prop", "extracts|pageimages|info");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("piprop", "thumbnail|name");
  url.searchParams.set("pithumbsize", "1400");
  url.searchParams.set("titles", title);
  try {
    const payload = await fetchJson(url, 3600);
    const page = payload.query?.pages?.[0] || {};
    if (page.missing) return { title, description: "", imageUrl: "", sourceUrl: "" };
    return { title: page.title || title, description: String(page.extract || "").trim(), imageUrl: page.thumbnail?.source || "", sourceUrl: page.fullurl || "" };
  } catch { return { title, description: "", imageUrl: "", sourceUrl: "" }; }
}

async function proxyImage(requestUrl) {
  const rawUrl = requestUrl.searchParams.get("url") || "";
  const imageUrl = new URL(rawUrl);
  if (imageUrl.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.some(host => imageUrl.hostname === host || imageUrl.hostname.endsWith(`.${host}`))) return json({ error: "Image host is not allowed." }, 400);
  const response = await fetch(imageUrl.toString(), { headers: { "User-Agent": "CoxswainRequestTerminal/2.0" }, cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!response.ok) return json({ error: `Image upstream returned ${response.status}` }, 502);
  const contentType = (response.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) return json({ error: "Image upstream did not return an image." }, 502);
  return new Response(response.body, { status: 200, headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}

function pickBlueprint(data) { if (data?.ingredients || data?.requirement_groups) return data; const candidates = Array.isArray(data?.blueprint) ? data.blueprint : data?.blueprint ? [data.blueprint] : []; return candidates[0] || null; }
function extractIngredients(blueprint) { if (!blueprint) return []; if (Array.isArray(blueprint.ingredients) && blueprint.ingredients.length) return blueprint.ingredients; const output=[]; const visit=node=>{if(!node||typeof node!=="object")return;if(["resource","item"].includes(node.kind)&&node.name)output.push({name:node.name,quantity_scu:node.quantity_scu,quantity:node.quantity});if(Array.isArray(node.children))node.children.forEach(visit)};(blueprint.requirement_groups||[]).forEach(visit);(blueprint.tiers||[]).forEach(tier=>visit(tier.requirements));const seen=new Map();output.forEach(entry=>{const key=`${entry.name}:${entry.quantity_scu??entry.quantity??0}`;if(!seen.has(key))seen.set(key,entry)});return [...seen.values()]; }
function findImageUrl(value, depth=0) { if (!value || depth>5) return ""; if (typeof value === "string") return /^https:\/\/.+\.(png|jpe?g|webp)(\?.*)?$/i.test(value) ? value : ""; if (Array.isArray(value)) { for (const item of value) { const found=findImageUrl(item,depth+1); if(found)return found; } return ""; } for(const key of ["thumbnail","image","image_url","thumbnail_url","media","picture","source"]){if(key in value){const found=findImageUrl(value[key],depth+1);if(found)return found}}return ""; }
function isUsableWikiImage(url) { return Boolean(url) && !/WikimediaUI|Site-logo|logo|placeholder|no_image/i.test(url); }
function normalizeText(value) { if (typeof value === "string") return value.trim(); if (Array.isArray(value)) { const english=value.find(entry=>String(entry?.locale||entry?.language||"").startsWith("en")); return normalizeText(english?.translation||english?.text||english?.value||value[0]); } if(value&&typeof value==="object")return normalizeText(value.en||value.en_US||value.text||value.value||value.translation); return ""; }
function mergeIncludes(current, addition) { return [...new Set(String(current||"").split(",").filter(Boolean).concat(addition))].join(","); }
function validateApiUrl(rawUrl) { const url=new URL(rawUrl); if(url.origin!==API_ORIGIN||!url.pathname.startsWith("/api/"))throw new Error("Unsupported API URL."); return url; }
async function fetchJson(url, cacheTtl) { const response=await fetch(url.toString(),{headers:{Accept:"application/json","User-Agent":"CoxswainRequestTerminal/2.0"},cf:{cacheTtl,cacheEverything:true}}); if(!response.ok)throw new Error(`Upstream returned ${response.status}`); return response.json(); }
function number(value) { const parsed=Number(value); return Number.isFinite(parsed)?parsed:0; }
function normalize(value) { return String(value||"").toLowerCase().replace(/\([^)]*\)/g," ").replace(/[^a-z0-9]+/g," ").trim(); }
function json(payload,status=200,maxAge=0){return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":maxAge?`public, max-age=${maxAge}`:"no-store"}})}
