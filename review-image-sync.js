(() => {
  const $ = id => document.getElementById(id);

  const currentVisual = () => {
    const image = $("configureImage");
    if (!image) return "";
    return image.currentSrc || image.src || image.dataset.exactItemImage || "";
  };

  const syncSingleReviewImage = () => {
    const reviewView = document.querySelector('.terminal-view[data-view="review"]');
    if (!reviewView?.classList.contains("active")) return;

    const output = $("outputImage");
    const source = currentVisual();
    if (!output || !source) return;

    if (output.src !== source) output.src = source;
    const status = $("outputImageStatus");
    const sourceStatus = $("imageStatus")?.textContent?.trim();
    if (status && sourceStatus) status.textContent = sourceStatus;
  };

  const queueSync = () => {
    requestAnimationFrame(() => requestAnimationFrame(syncSingleReviewImage));
    setTimeout(syncSingleReviewImage, 80);
    setTimeout(syncSingleReviewImage, 250);
  };

  const setup = () => {
    $("reviewButton")?.addEventListener("click", queueSync);
    document.querySelector('[data-step="review"]')?.addEventListener("click", queueSync);
    $("manifestReview")?.addEventListener("click", queueSync);

    const reviewView = document.querySelector('.terminal-view[data-view="review"]');
    if (reviewView) {
      new MutationObserver(() => {
        if (reviewView.classList.contains("active")) queueSync();
      }).observe(reviewView, { attributes: true, attributeFilter: ["class"] });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();