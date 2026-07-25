(() => {
  const GREEN = "#75d987";
  const SOFT = "rgba(117,217,135,.62)";
  const FAINT = "rgba(117,217,135,.15)";
  const BG = "#001006";
  const PANEL = "#02180a";
  const FONT = '"Courier New", monospace';

  const $ = id => document.getElementById(id);
  const formatNumber = value => {
    const rounded = Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
  };

  const getData = () => {
    const api = window.coxswainManifest;
    if (!api) return null;
    const items = api.getItems();
    if (!Array.isArray(items) || items.length <= 1) return null;
    return {
      items,
      materials: api.getAggregatedMaterials(),
      requestor: $("requestor")?.value || items[0]?.shared?.requestor || "UNSPECIFIED",
      requestDate: $("requestDate")?.value || items[0]?.shared?.requestDate || "UNSPECIFIED",
      contact: $("contact")?.value || items[0]?.shared?.contact || "UNSPECIFIED",
      footer: $("footer")?.value || items[0]?.shared?.footer || "UEE PATHFINDERS // COXSWAIN REQUEST",
    };
  };

  const loadImage = src => new Promise(resolve => {
    if (!src) return resolve(null);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

  const wrapLines = (ctx, text, maxWidth, maxLines = Infinity) => {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
      } else {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) break;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length === maxLines && words.length && ctx.measureText(lines[lines.length - 1]).width > maxWidth) {
      while (lines[lines.length - 1].length && ctx.measureText(`${lines[lines.length - 1]}…`).width > maxWidth) {
        lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1);
      }
      lines[lines.length - 1] += "…";
    }
    return lines;
  };

  const drawTextLines = (ctx, lines, x, y, lineHeight) => {
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  };

  const panel = (ctx, x, y, w, h, title) => {
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = GREEN;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(title, x + 16, y + 28);
    ctx.strokeStyle = SOFT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 40);
    ctx.lineTo(x + w - 14, y + 40);
    ctx.stroke();
  };

  const drawImageContain = (ctx, image, x, y, w, h) => {
    if (!image) {
      ctx.strokeStyle = FAINT;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = SOFT;
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText("NO VISUAL", x + w / 2, y + h / 2 + 4);
      ctx.textAlign = "left";
      return;
    }
    const scale = Math.min(w / image.width, h / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;
    ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  };

  async function renderCanvas() {
    const data = getData();
    if (!data) throw new Error("Multi-item manifest not available");

    const itemCount = data.items.length;
    const cardMode = itemCount <= 4;
    const width = 1200;
    const margin = 54;
    const headerHeight = 180;
    const sharedHeight = 116;
    const itemSectionHeight = cardMode
      ? Math.ceil(itemCount / 2) * 230 + 70
      : itemCount * 104 + 70;
    const materialRows = Math.max(1, data.materials.length);
    const columns = materialRows > 12 ? 2 : 1;
    const rowsPerColumn = Math.ceil(materialRows / columns);
    const materialsHeight = rowsPerColumn * 46 + 76;
    const footerHeight = 76;
    const height = headerHeight + sharedHeight + itemSectionHeight + materialsHeight + footerHeight + margin * 2;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, width - 44, height - 44);

    ctx.fillStyle = SOFT;
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText("UEE PATHFINDERS // COXSWAIN REQUEST TERMINAL", margin, 68);
    ctx.textAlign = "right";
    ctx.fillText(`REQUEST MANIFEST // ${itemCount} ITEM TYPES`, width - margin, 68);
    ctx.textAlign = "left";
    ctx.fillStyle = GREEN;
    ctx.font = `700 42px ${FONT}`;
    ctx.fillText("MATERIAL ACQUISITION REQUEST", margin, 122);
    ctx.strokeStyle = GREEN;
    ctx.beginPath();
    ctx.moveTo(margin, 145);
    ctx.lineTo(width - margin, 145);
    ctx.stroke();

    let y = headerHeight;
    panel(ctx, margin, y, width - margin * 2, sharedHeight - 18, "REQUEST PARAMETERS");
    const shared = [
      ["REQUESTOR", data.requestor],
      ["REQUEST DATE", data.requestDate],
      ["PICKUP / DELIVERY", data.contact],
    ];
    const sharedWidth = (width - margin * 2 - 32) / 3;
    shared.forEach(([label, value], index) => {
      const x = margin + 16 + index * sharedWidth;
      ctx.fillStyle = SOFT;
      ctx.font = `700 11px ${FONT}`;
      ctx.fillText(label, x, y + 64);
      ctx.fillStyle = GREEN;
      ctx.font = `700 16px ${FONT}`;
      const lines = wrapLines(ctx, value, sharedWidth - 22, 2);
      drawTextLines(ctx, lines, x, y + 88, 18);
    });

    y += sharedHeight;
    panel(ctx, margin, y, width - margin * 2, itemSectionHeight - 18, `REQUESTED ITEMS // ${itemCount} TYPES // ${data.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} TOTAL`);
    const images = await Promise.all(data.items.map(item => loadImage(item.image)));

    if (cardMode) {
      const gap = 18;
      const cardWidth = (width - margin * 2 - 32 - gap) / 2;
      const cardHeight = 204;
      data.items.forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = margin + 16 + col * (cardWidth + gap);
        const cy = y + 52 + row * 230;
        ctx.fillStyle = "rgba(0,25,7,.34)";
        ctx.fillRect(x, cy, cardWidth, cardHeight);
        ctx.strokeStyle = FAINT;
        ctx.strokeRect(x, cy, cardWidth, cardHeight);
        drawImageContain(ctx, images[index], x + 10, cy + 10, 150, 130);
        ctx.fillStyle = GREEN;
        ctx.font = `700 24px ${FONT}`;
        const titleLines = wrapLines(ctx, `${item.quantity} × ${String(item.name || "UNTITLED").toUpperCase()}`, cardWidth - 188, 3);
        let textY = drawTextLines(ctx, titleLines, x + 178, cy + 38, 27);
        ctx.fillStyle = SOFT;
        ctx.font = `700 11px ${FONT}`;
        ctx.fillText(`${item.quality || "NO QUALITY"} // ${(item.materials || []).length} MATERIAL LINES`, x + 178, textY + 8);
        const detailLines = wrapLines(ctx, item.details || "NO ITEM DETAILS", cardWidth - 188, 3);
        ctx.font = `400 11px ${FONT}`;
        drawTextLines(ctx, detailLines, x + 178, textY + 34, 15);
      });
    } else {
      data.items.forEach((item, index) => {
        const x = margin + 16;
        const ry = y + 50 + index * 104;
        ctx.fillStyle = "rgba(0,25,7,.30)";
        ctx.fillRect(x, ry, width - margin * 2 - 32, 88);
        ctx.strokeStyle = FAINT;
        ctx.strokeRect(x, ry, width - margin * 2 - 32, 88);
        drawImageContain(ctx, images[index], x + 8, ry + 7, 94, 74);
        ctx.fillStyle = GREEN;
        ctx.font = `700 21px ${FONT}`;
        const titleLines = wrapLines(ctx, `${item.quantity} × ${String(item.name || "UNTITLED").toUpperCase()}`, 700, 2);
        drawTextLines(ctx, titleLines, x + 120, ry + 33, 24);
        ctx.fillStyle = SOFT;
        ctx.font = `700 11px ${FONT}`;
        ctx.fillText(`${item.quality || "NO QUALITY"} // ${(item.materials || []).length} MATERIAL LINES`, x + 870, ry + 47);
      });
    }

    y += itemSectionHeight;
    panel(ctx, margin, y, width - margin * 2, materialsHeight - 18, `CONSOLIDATED MATERIALS // ${data.materials.length} UNIQUE LINES`);
    if (!data.materials.length) {
      ctx.fillStyle = SOFT;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText("NO MATERIAL DATA AVAILABLE", margin + 18, y + 72);
    } else {
      const innerWidth = width - margin * 2 - 32;
      const columnGap = 30;
      const columnWidth = (innerWidth - columnGap * (columns - 1)) / columns;
      data.materials.forEach((material, index) => {
        const col = Math.floor(index / rowsPerColumn);
        const row = index % rowsPerColumn;
        const x = margin + 16 + col * (columnWidth + columnGap);
        const my = y + 60 + row * 46;
        ctx.fillStyle = GREEN;
        ctx.font = `700 15px ${FONT}`;
        ctx.fillText(String(material.name || "UNKNOWN").toUpperCase(), x, my);
        ctx.textAlign = "right";
        ctx.fillText(`${formatNumber(material.total)} ${material.unit || "UNITS"}`, x + columnWidth, my);
        ctx.textAlign = "left";
        ctx.fillStyle = SOFT;
        ctx.font = `700 10px ${FONT}`;
        ctx.fillText(`QUALITY ${material.quality || "UNSPECIFIED"}`, x, my + 17);
        ctx.strokeStyle = FAINT;
        ctx.beginPath();
        ctx.moveTo(x, my + 27);
        ctx.lineTo(x + columnWidth, my + 27);
        ctx.stroke();
      });
    }

    y += materialsHeight;
    ctx.fillStyle = SOFT;
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(String(data.footer || "UEE PATHFINDERS // COXSWAIN REQUEST"), width / 2, y + 24);
    ctx.fillText("VERIFY GENERATED VALUES BEFORE TRANSMISSION", width / 2, y + 47);
    ctx.textAlign = "left";

    return canvas;
  }

  const canvasBlob = canvas => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Unable to generate image")), "image/png");
  });

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

  const setStatus = message => { const status = $("exportStatus"); if (status) status.textContent = message; };

  async function downloadPng() {
    setStatus("RENDERING MULTI-ITEM PNG...");
    const canvas = await renderCanvas();
    downloadBlob(await canvasBlob(canvas), "coxswain-multi-item-request.png");
    setStatus("MULTI-ITEM PNG DOWNLOADED");
  }

  async function copyImage() {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("Clipboard image copying is not supported by this browser");
    setStatus("RENDERING MULTI-ITEM IMAGE...");
    const canvas = await renderCanvas();
    const blob = await canvasBlob(canvas);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setStatus("MULTI-ITEM IMAGE COPIED");
  }

  async function downloadPdf() {
    setStatus("RENDERING MULTI-ITEM PDF...");
    const canvas = await renderCanvas();
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
    pdf.save("coxswain-multi-item-request.pdf");
    setStatus(`MULTI-ITEM PDF DOWNLOADED // ${pageIndex} PAGE${pageIndex === 1 ? "" : "S"}`);
  }

  const intercept = (id, action) => {
    const button = $(id);
    if (!button) return;
    button.addEventListener("click", event => {
      if (!getData()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      Promise.resolve(action()).catch(error => setStatus(`EXPORT FAILED // ${error.message || error}`));
    }, true);
  };

  const setup = () => {
    intercept("copyImageButton", copyImage);
    intercept("downloadPngButton", downloadPng);
    intercept("downloadPdfButton", downloadPdf);
    window.coxswainMultiExport = { renderCanvas };
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
