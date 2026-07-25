export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const patch = `
<style id="calendar-anchor-fix-v6">
  #requestDateCalendar.sc-calendar {
    position: fixed !important;
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
    const field = button?.closest('.sc-date-field');
    const calendar = document.getElementById('requestDateCalendar');
    if (!button || !field || !calendar || calendar.dataset.anchorFix === 'v6') return;

    calendar.dataset.anchorFix = 'v6';
    document.body.appendChild(calendar);

    const positionCalendar = () => {
      if (calendar.hidden) return;

      const margin = 12;
      const gap = 6;
      const fieldRect = field.getBoundingClientRect();
      const width = Math.min(286, window.innerWidth - margin * 2);

      calendar.style.setProperty('width', width + 'px', 'important');
      calendar.style.setProperty('left', Math.max(
        margin,
        Math.min(fieldRect.right - width, window.innerWidth - width - margin)
      ) + 'px', 'important');

      calendar.style.setProperty('top', '0px', 'important');
      calendar.style.setProperty('visibility', 'hidden', 'important');
      const height = Math.min(calendar.scrollHeight, window.innerHeight - margin * 2);
      calendar.style.setProperty('top', Math.max(margin, fieldRect.top - height - gap) + 'px', 'important');
      calendar.style.setProperty('visibility', 'visible', 'important');
    };

    const queuePosition = () => {
      requestAnimationFrame(() => requestAnimationFrame(positionCalendar));
    };

    new MutationObserver(() => {
      if (!calendar.hidden) queuePosition();
    }).observe(calendar, { attributes: true, attributeFilter: ['hidden'] });

    button.addEventListener('click', queuePosition);
    window.addEventListener('resize', positionCalendar);
    window.addEventListener('scroll', positionCalendar, true);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
</script>
<script src="/manifest.js" defer></script>
<script src="/multi-review.js" defer></script>
<script src="/review-bridge.js" defer></script>`;

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
