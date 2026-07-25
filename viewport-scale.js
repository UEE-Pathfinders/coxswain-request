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
    .monitor-shell {
      padding: 20px 20px 44px !important;
    }
    .monitor-screen {
      height: 720px !important;
      min-height: 720px !important;
      padding: 16px 20px 44px !important;
    }
    .terminal-view {
      height: calc(100% - 78px) !important;
    }

    /* Freeze every viewport-relative value at its 1280px native desktop value. */
    .terminal-header { font-size: 15.36px !important; }
    .screen-title-row h1,
    .export-console h1 { font-size: 35.84px !important; }
    .command-input input { font-size: 24.32px !important; }
    .output-summary > h2 { font-size: 19.84px !important; }

    .login-console {
      padding: 20px 89.6px 58px !important;
    }
    .login-emblem {
      width: 560px !important;
      height: 252px !important;
      max-height: none !important;
    }
    .login-rule { width: 670px !important; }
    .login-kicker { font-size: 25.6px !important; }
    .login-subtitle { font-size: 11.52px !important; }
    .login-console h1 { font-size: 16px !important; }
    .callsign-form { width: 430px !important; }
    .login-legal {
      left: 89.6px !important;
      right: 89.6px !important;
    }

    /* Preserve native desktop geometry after responsive media queries fire. */
    .step-nav { grid-template-columns: repeat(4, 1fr) !important; }
    .step-nav button { font-size: inherit !important; }
    .configure-grid { grid-template-columns: .82fr 1.18fr !important; }
    .materials-details-grid { grid-template-columns: 1.22fr .78fr !important; }
    .request-parameters-grid,
    .field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    .review-grid { grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr) !important; }
    .output-grid {
      grid-template-columns: .76fr 1fr 1.22fr !important;
      grid-template-rows: 176px 174px !important;
      grid-template-areas: "image summary materials" "details details materials" !important;
    }
    .output-image img { height: 135px !important; }
    .result-card { grid-template-columns: minmax(180px,1fr) 1.5fr auto !important; }
    .materials-table-head,
    .material-row {
      grid-template-columns: minmax(150px,1.45fr) .55fr .42fr .52fr .65fr 32px !important;
    }
    .materials-table-head { display: grid !important; }
    .material-row .material-name,
    .material-total { grid-column: auto !important; }
    .material-total { text-align: right !important; }
    .screen-title-row {
      align-items: flex-end !important;
      flex-direction: row !important;
    }
    .terminal-command-row {
      align-items: center !important;
      flex-direction: row !important;
    }
    .command-buttons { margin-left: auto !important; }
    .terminal-footer-bar { left: 20px !important; right: 20px !important; }
    .monitor-chin { left: 38px !important; }
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