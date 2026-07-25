export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const patch = `
<style id="calendar-anchor-fix-v5">
  .sc-date-field {
    position: relative !important;
  }

  #requestDateCalendar.sc-calendar {
    position: absolute !important;
    right: 0 !important;
    left: auto !important;
    top: auto !important;
    bottom: calc(100% + 6px) !important;
    inset: auto 0 calc(100% + 6px) auto !important;
    transform: none !important;
    z-index: 1000 !important;
    width: min(286px, calc(100vw - 24px)) !important;
    max-height: none !important;
    overflow: visible !important;
  }
</style>`;

  const patched = html.includes("</head>")
    ? html.replace("</head>", `${patch}</head>`)
    : html + patch;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store, max-age=0");
  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
