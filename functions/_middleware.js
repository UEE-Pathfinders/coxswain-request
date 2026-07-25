export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const patch = `
<style id="calendar-viewport-fix">
  #requestDateCalendar.sc-calendar {
    position: fixed !important;
    inset: auto !important;
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
    if (!button || !calendar || calendar.dataset.viewportFixed === 'true') return;

    calendar.dataset.viewportFixed = 'true';
    document.body.appendChild(calendar);

    const positionCalendar = () => {
      if (calendar.hidden) return;
      const margin = 12;
      const gap = 6;
      const rect = button.getBoundingClientRect();
      const width = Math.min(286, window.innerWidth - margin * 2);

      calendar.style.width = width + 'px';
      calendar.style.left = Math.min(
        Math.max(margin, rect.right - width),
        window.innerWidth - width - margin
      ) + 'px';

      calendar.style.top = margin + 'px';
      const height = Math.min(calendar.scrollHeight, window.innerHeight - margin * 2);
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openAbove = spaceAbove > spaceBelow;
      const top = openAbove
        ? Math.max(margin, rect.top - height - gap)
        : Math.min(rect.bottom + gap, window.innerHeight - height - margin);

      calendar.style.top = Math.max(margin, top) + 'px';
    };

    const observer = new MutationObserver(() => {
      if (!calendar.hidden) requestAnimationFrame(positionCalendar);
    });
    observer.observe(calendar, { attributes: true, attributeFilter: ['hidden'] });

    button.addEventListener('click', () => requestAnimationFrame(positionCalendar));
    window.addEventListener('resize', positionCalendar);
    document.querySelector('.terminal-view[data-view="configure"]')?.addEventListener('scroll', positionCalendar);
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
  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
