(() => {
  const EXPORT_IDS = new Set(["copyImageButton", "downloadPngButton", "downloadPdfButton"]);
  let replaying = false;
  let syncing = false;

  const hasMultiItems = () => {
    const items = window.coxswainManifest?.getItems?.();
    return Array.isArray(items) && items.length > 1;
  };

  const correctedVisual = () => {
    const review = document.getElementById("outputImage");
    const configure = document.getElementById("configureImage");
    return review?.currentSrc || review?.src || configure?.currentSrc || configure?.src || "";
  };

  const waitForVisual = (image, expected) => new Promise(resolve => {
    if (!image || !expected) return resolve();
    const normalise = value => {
      try { return new URL(value, location.href).href; }
      catch { return String(value || ""); }
    };
    const target = normalise(expected);
    const ready = () => normalise(image.currentSrc || image.src) === target && image.complete;
    if (ready()) return resolve();

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      image.removeEventListener("load", done);
      image.removeEventListener("error", done);
      resolve();
    };
    image.addEventListener("load", done, { once: true });
    image.addEventListener("error", done, { once: true });
    setTimeout(done, 700);
  });

  const syncInternalImage = async source => {
    const urlInput = document.getElementById("imageUrl");
    const loadButton = document.getElementById("useImageUrlButton");
    const configure = document.getElementById("configureImage");
    if (!source || !urlInput || !loadButton) return;

    urlInput.value = source;
    urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    urlInput.dispatchEvent(new Event("change", { bubbles: true }));
    loadButton.click();
    await waitForVisual(configure, source);
  };

  document.addEventListener("click", event => {
    const button = event.target.closest?.("button");
    if (!button || !EXPORT_IDS.has(button.id) || hasMultiItems() || replaying || syncing) return;

    const source = correctedVisual();
    if (!source) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    syncing = true;

    Promise.resolve(syncInternalImage(source)).finally(() => {
      syncing = false;
      replaying = true;
      try { button.click(); }
      finally { queueMicrotask(() => { replaying = false; }); }
    });
  }, true);
})();
