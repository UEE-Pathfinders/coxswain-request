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

  /* Static fine scanlines above text, outlines and panels. */
  .monitor-screen > .scanlines {
    position: absolute !important;
    inset: 0 !important;
    z-index: 90 !important;
    pointer-events: none !important;
    overflow: hidden !important;
    opacity: 1 !important;
    background: repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0) 0,
      rgba(0, 0, 0, 0) 2px,
      rgba(0, 0, 0, .13) 2px,
      rgba(0, 0, 0, .13) 3px,
      rgba(117, 217, 135, .02) 3px,
      rgba(117, 217, 135, .02) 4px
    ) !important;
  }

  /* Visible but restrained compositor-driven phosphor lift. */
  .monitor-screen > .scanlines::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    height: 40px;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      rgba(205, 255, 215, 0) 0%,
      rgba(205, 255, 215, .014) 32%,
      rgba(230, 255, 235, .085) 50%,
      rgba(205, 255, 215, .017) 68%,
      rgba(205, 255, 215, 0) 100%
    );
    mix-blend-mode: screen;
    transform: translate3d(0, 0, 0);
    will-change: transform;
    animation: crt-scan-band-rise 7.5s linear infinite;
  }

  @keyframes crt-scan-band-rise {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(0, calc(-100vh - 80px), 0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .monitor-screen > .scanlines::after {
      animation: none !important;
      display: none;
      will-change: auto;
    }
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
<script src="/review-bridge.js" defer></script>
<script src="/portrait-bezel-export.js" defer></script>
<script src="/multi-export.js" defer></script>`;

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
