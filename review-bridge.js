(() => {
  const setup = () => {
    const original = document.getElementById("reviewButton");
    if (!original || original.dataset.manifestReviewBridge === "true") return;

    const button = original.cloneNode(true);
    button.dataset.manifestReviewBridge = "true";
    original.replaceWith(button);

    button.addEventListener("click", () => {
      const manifest = window.coxswainManifest;
      if (manifest?.isEnabled?.() && !manifest.commitCurrentForReview?.()) return;
      document.querySelector('[data-step="review"]')?.click();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(setup, 0));
  } else {
    setTimeout(setup, 0);
  }
})();