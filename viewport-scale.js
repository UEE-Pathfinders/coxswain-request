(() => {
  const NATIVE_WIDTH = 1280;
  const VIEWPORT_GUTTER = 12;

  const style = document.createElement("style");
  style.id = "coxswain-native-scale";
  style.textContent = `
    html {
      min-width: 0 !important;
      overflow-x: hidden !important;
    }
    body {
      display: block !important;
      position: relative !important;
      min-width: 0 !important;
      padding: 0 !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
    }
    .terminal-wrap {
      position: absolute !important;
      top: 6px !important;
      left: 50% !important;
      width: ${NATIVE_WIDTH}px !important;
      max-width: none !important;
      margin: 0 !important;
      transform-origin: top center !important;
    }
    .monitor-screen {
      height: 720px !important;
      min-height: 720px !important;
    }

    /* Freeze viewport-relative text until the whole chassis scales. */
    .terminal-header {
      font-size: 15.36px !important;
    }
    .export-console h1 {
      font-size: 35.84px !important;
    }

    /* Preserve the native desktop geometry even when viewport media queries fire. */
    .step-nav { grid-template-columns: repeat(4, 1fr) !important; }
    .configure-grid { grid-template-columns: minmax(0, 1.08fr) minmax(330px, .92fr) !important; }
    .request-parameters-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    .review-grid { grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr) !important; }
    .manifest-row { grid-template-columns: 48px minmax(0,1fr) auto !important; }
    .manifest-actions { grid-column: auto !important; }
    .manifest-thumb { width: 48px !important; height: 38px !important; }
  `;
  document.head.appendChild(style);

  const wrap = document.querySelector(".terminal-wrap");
  if (!wrap) return;

  let frame = 0;
  const applyScale = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      wrap.style.transform = "translateX(-50%) scale(1)";
      const nativeHeight = Math.max(1, wrap.offsetHeight);
      const widthScale = (window.innerWidth - VIEWPORT_GUTTER) / NATIVE_WIDTH;
      const heightScale = (window.innerHeight - VIEWPORT_GUTTER) / nativeHeight;
      const scale = Math.min(1, widthScale, heightScale);
      const safeScale = Math.max(.2, scale);

      wrap.style.transform = `translateX(-50%) scale(${safeScale})`;
      document.body.style.minHeight = `${Math.ceil(nativeHeight * safeScale + 12)}px`;
      document.documentElement.style.setProperty("--terminal-scale", String(scale));
    });
  };

  const observer = new ResizeObserver(applyScale);
  observer.observe(wrap);
  window.addEventListener("resize", applyScale, { passive: true });
  window.addEventListener("orientationchange", applyScale, { passive: true });
  applyScale();
})();