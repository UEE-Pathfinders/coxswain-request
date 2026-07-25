export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const patch = `
<style id="calendar-anchor-fix-v4">
  #requestDateCalendar.sc-calendar {
    position: fixed !important;
    inset: auto !important;
    right: auto !important;
    bottom: auto !important;
    transform: none !important;
    z-index: 2147483000 !important;
    width: min(286px, calc(100vw - 24px)) !important;
    max-height: calc(100vh - 24px) !important;
    overflow-y: auto !important;
  }
</style>
<script>
(() => {
  const setup = () => {
    const button = document.getElementById('requestDateButton');
    const calendar = document.getElementById('requestDateCalendar');
    if (!button || !calendar) return;

    document.body.appendChild(calendar);

    const positionCalendar = () => {
      if (calendar.hidden) return;

      const margin = 12;
      const gap = 6;
      const rect = button.getBoundingClientRect();
      const width = Math.min(286, window.innerWidth - margin * 2);

      calendar.style.width = width + 'px';
      calendar.style.left = Math.max(
        margin,
        Math.min(rect.right - width, window.innerWidth - width - margin)
      ) + 'px';

      calendar.style.top = '0px';
      calendar.style.visibility = 'hidden';
      const height = calendar.getBoundingClientRect().height || calendar.scrollHeight;
      calendar.style.top = Math.max(margin, rect.top - height - gap) + 'px';
      calendar.style.visibility = 'visible';
    };

    const repositionAfterOpen = () => {
      requestAnimationFrame(() => {
        positionCalendar();
        requestAnimationFrame(positionCalendar);
      });
      setTimeout(positionCalendar, 40);
      setTimeout(positionCalendar, 120);
    };

    button.addEventListener('click', repositionAfterOpen, true);
    const observer = new MutationObserver(repositionAfterOpen);
    observer.observe(calendar, { attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('resize', positionCalendar);
    window.addEventListener('scroll', positionCalendar, true);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
</script>`;

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