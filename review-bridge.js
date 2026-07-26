(() => {
  const setup = () => {
    const original = document.getElementById("reviewButton");
    if (!original || original.dataset.manifestReviewBridge === "true") return;

    const button = original.cloneNode(true);
    button.dataset.manifestReviewBridge = "true";
    original.replaceWith(button);

    button.addEventListener("click", async () => {
      const manifest = window.coxswainManifest;
      const previous = button.disabled;
      button.disabled = true;
      try {
        if (manifest?.isEnabled?.()) {
          const committed = await manifest.commitCurrentForReview?.();
          if (!committed) return;
        }
        document.querySelector('[data-step="review"]')?.click();
      } finally {
        button.disabled = previous;
      }
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(setup, 0));
  } else {
    setTimeout(setup, 0);
  }
})();