(() => {
  const $ = id => document.getElementById(id);
  const FRAME = {
    outer: "#111713",
    mid: "#202820",
    dark: "#050806",
    edge: "#343d35",
    green: "#75d987",
    soft: "rgba(117,217,135,.34)",
  };

  const hasMultiItems = () => {
    const items = window.coxswainManifest?.getItems?.();
    return Array.isArray(items) && items.length > 1;
  };

  const roundedRect = (ctx, x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  const drawScrew = (ctx, x, y, r = 13) => {
    const gradient = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, r);
    gradient.addColorStop(0, "#59615b");
    gradient.addColorStop(.45, "#202621");
    gradient.addColorStop(1, "#050705");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#080b08";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 7);
    ctx.lineTo(x + 7, y + 7);
    ctx.stroke();
  };

  const drawPortraitBezel = async () => {
    const report = await window.coxswainMultiExport?.renderCanvas?.();
    if (!report) throw new Error("Multi-item report renderer unavailable");

    const side = 92;
    const top = 92;
    const bottom = 180;
    const canvas = document.createElement("canvas");
    canvas.width = report.width + side * 2;
    canvas.height = report.height + top + bottom;
    const ctx = canvas.getContext("2d");

    const shellGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    shellGradient.addColorStop(0, "#252d27");
    shellGradient.addColorStop(.22, "#0b0f0c");
    shellGradient.addColorStop(.55, "#1a211b");
    shellGradient.addColorStop(1, "#080b09");
    ctx.fillStyle = shellGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#394139";
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.strokeStyle = "#050705";
    ctx.lineWidth = 8;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    drawScrew(ctx, 30, 30);
    drawScrew(ctx, canvas.width - 30, 30);
    drawScrew(ctx, 30, canvas.height - 30);
    drawScrew(ctx, canvas.width - 30, canvas.height - 30);

    const screenX = side - 18;
    const screenY = top - 24;
    const screenW = report.width + 36;
    const screenH = report.height + 48;

    ctx.fillStyle = "#020403";
    roundedRect(ctx, screenX - 18, screenY - 18, screenW + 36, screenH + 36, 34);
    ctx.fill();
    ctx.strokeStyle = "#303930";
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.save();
    roundedRect(ctx, screenX, screenY, screenW, screenH, 24);
    ctx.clip();
    ctx.fillStyle = "#001006";
    ctx.fillRect(screenX, screenY, screenW, screenH);
    ctx.drawImage(report, side, top, report.width, report.height);

    const vignette = ctx.createRadialGradient(
      canvas.width / 2,
      screenY + screenH / 2,
      Math.min(screenW, screenH) * .26,
      canvas.width / 2,
      screenY + screenH / 2,
      Math.max(screenW, screenH) * .62
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.36)");
    ctx.fillStyle = vignette;
    ctx.fillRect(screenX, screenY, screenW, screenH);

    ctx.fillStyle = "rgba(117,217,135,.035)";
    for (let y = screenY; y < screenY + screenH; y += 4) {
      ctx.fillRect(screenX, y, screenW, 1);
    }
    ctx.restore();

    const stripY = canvas.height - 126;
    ctx.fillStyle = "#090d0a";
    ctx.fillRect(70, stripY, canvas.width - 140, 70);
    ctx.strokeStyle = "#242c25";
    ctx.lineWidth = 3;
    ctx.strokeRect(70, stripY, canvas.width - 140, 70);

    const ledX = 115;
    const ledY = stripY + 35;
    const ledGlow = ctx.createRadialGradient(ledX, ledY, 2, ledX, ledY, 22);
    ledGlow.addColorStop(0, "#d8ffda");
    ledGlow.addColorStop(.22, "#65ff79");
    ledGlow.addColorStop(.55, "rgba(80,255,105,.35)");
    ledGlow.addColorStop(1, "rgba(80,255,105,0)");
    ctx.fillStyle = ledGlow;
    ctx.beginPath();
    ctx.arc(ledX, ledY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#63ff77";
    ctx.beginPath();
    ctx.arc(ledX, ledY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#343c35";
    ctx.font = '700 22px "Courier New", monospace';
    ctx.fillText("LED", 146, stripY + 43);

    ctx.textAlign = "right";
    ctx.fillStyle = "#777568";
    ctx.font = '700 28px "Courier New", monospace';
    ctx.fillText("UEE-CRT-90P", canvas.width - 100, stripY + 44);
    ctx.textAlign = "left";

    return canvas;
  };

  const canvasBlob = canvas => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Unable to generate image")), "image/png");
  });

  const setStatus = message => {
    const status = $("exportStatus");
    if (status) status.textContent = message;
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyImage = async () => {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("Clipboard image copying is not supported by this browser");
    setStatus("RENDERING PORTRAIT CRT IMAGE...");
    const canvas = await drawPortraitBezel();
    const blob = await canvasBlob(canvas);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setStatus("PORTRAIT CRT IMAGE COPIED");
  };

  const downloadPng = async () => {
    setStatus("RENDERING PORTRAIT CRT PNG...");
    const canvas = await drawPortraitBezel();
    downloadBlob(await canvasBlob(canvas), "coxswain-multi-item-request-crt.png");
    setStatus("PORTRAIT CRT PNG DOWNLOADED");
  };

  const downloadPdf = async () => {
    setStatus("RENDERING PORTRAIT CRT PDF...");
    const canvas = await drawPortraitBezel();
    const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!JsPDF) throw new Error("PDF renderer unavailable");
    const pdf = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const scale = pageWidth / canvas.width;
    const sourcePageHeight = Math.floor(pageHeight / scale);
    let sourceY = 0;
    let pageIndex = 0;
    while (sourceY < canvas.height) {
      if (pageIndex > 0) pdf.addPage();
      const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeight;
      slice.getContext("2d").drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageWidth, sliceHeight * scale, undefined, "FAST");
      sourceY += sliceHeight;
      pageIndex += 1;
    }
    pdf.save("coxswain-multi-item-request-crt.pdf");
    setStatus(`PORTRAIT CRT PDF DOWNLOADED // ${pageIndex} PAGE${pageIndex === 1 ? "" : "S"}`);
  };

  const intercept = (id, action) => {
    const button = $(id);
    if (!button) return;
    button.addEventListener("click", event => {
      if (!hasMultiItems()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      Promise.resolve(action()).catch(error => setStatus(`EXPORT FAILED // ${error.message || error}`));
    }, true);
  };

  const setup = () => {
    intercept("copyImageButton", copyImage);
    intercept("downloadPngButton", downloadPng);
    intercept("downloadPdfButton", downloadPdf);
    window.coxswainPortraitBezelExport = { renderCanvas: drawPortraitBezel };
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();