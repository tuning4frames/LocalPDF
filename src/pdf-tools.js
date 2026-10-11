import { degrees, PDFDocument, StandardFonts, rgb } from "pdf-lib";

export function parsePages(value, count) {
  const pages = [];
  for (const token of value.split(",").map((part) => part.trim()).filter(Boolean)) {
    if (/^\d+$/.test(token)) {
      pages.push(Number(token));
      continue;
    }

    const match = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) throw new Error(`Invalid page entry: ${token}`);
    const start = Number(match[1]);
    const end = Number(match[2]);
    const step = start <= end ? 1 : -1;
    for (let page = start; page !== end + step; page += step) pages.push(page);
  }

  if (!pages.length) throw new Error("Enter at least one page.");
  if (pages.some((page) => page < 1 || page > count)) {
    throw new Error(`Page numbers must be between 1 and ${count}.`);
  }
  return pages.map((page) => page - 1);
}

export async function mergePdfs(pdfBuffers) {
  const output = await PDFDocument.create();
  for (const bytes of pdfBuffers) {
    const source = await PDFDocument.load(bytes);
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }
  return output;
}

export async function selectPdfPages(pdfBuffer, indices) {
  const source = await PDFDocument.load(pdfBuffer);
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, indices);
  pages.forEach((page) => output.addPage(page));
  return output;
}

export async function imagesToPdf(images) {
  const output = await PDFDocument.create();
  for (const imageFile of images) {
    const image = imageFile.type === "image/png"
      ? await output.embedPng(imageFile.bytes)
      : await output.embedJpg(imageFile.bytes);
    const page = output.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return output;
}

export async function optimizePdf(pdfBuffer) {
  return PDFDocument.load(pdfBuffer);
}

export async function rotatePdfPages(pdfBuffer, indices, angle) {
  const pdf = await PDFDocument.load(pdfBuffer);
  indices.forEach((index) => {
    const page = pdf.getPage(index);
    const current = page.getRotation().angle || 0;
    page.setRotation(degrees((current + angle) % 360));
  });
  return pdf;
}

export async function addPdfPageNumbers(pdfBuffer, options = {}) {
  const pdf = await PDFDocument.load(pdfBuffer);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const indices = options.indices ?? pdf.getPageIndices();
  const start = options.start ?? 1;
  const position = options.position ?? "bottom-center";
  const fontSize = 10;

  indices.forEach((pageIndex, sequence) => {
    const page = pdf.getPage(pageIndex);
    const label = String(start + sequence);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const left = 28;
    const center = (width - textWidth) / 2;
    const right = width - textWidth - 28;
    const x = position.endsWith("left") ? left : position.endsWith("right") ? right : center;
    const y = position.startsWith("top") ? height - 32 : 24;
    page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.15, 0.15, 0.13) });
  });
  return pdf;
}

export async function addPdfWatermark(pdfBuffer, { text, indices, opacity = 0.2 } = {}) {
  if (!text?.trim()) throw new Error("Enter watermark text.");
  const pdf = await PDFDocument.load(pdfBuffer);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const index of indices ?? pdf.getPageIndices()) {
    const page = pdf.getPage(index), { width, height } = page.getSize(), size = 42;
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - textWidth) / 2, y: height / 2, size, font, opacity, rotate: degrees(-35), color: rgb(.2,.2,.18) });
  }
  return pdf;
}

export function stampPosition(position, pageWidth, pageHeight, boxWidth, boxHeight, margin = 28) {
  const x = position.endsWith("left") ? margin : position.endsWith("right") ? pageWidth - boxWidth - margin : (pageWidth - boxWidth) / 2;
  const y = position.startsWith("top") ? pageHeight - boxHeight - margin : position.startsWith("middle") ? (pageHeight - boxHeight) / 2 : margin;
  return { x, y };
}

export async function addPdfText(pdfBuffer, { text, indices, position = "bottom-center", size = 20, opacity = 1, color = "ink", fontName = "Helvetica", margin = 28 } = {}) {
  if (!text?.trim()) throw new Error("Enter the text to add.");
  const pdf = await PDFDocument.load(pdfBuffer);
  const font = await pdf.embedFont(StandardFonts[fontName] ?? StandardFonts.Helvetica);
  const palette = { ink: rgb(0.09, 0.09, 0.07), white: rgb(1, 1, 1), red: rgb(0.8, 0.1, 0.1), blue: rgb(0.1, 0.2, 0.7), gray: rgb(0.45, 0.45, 0.42) };
  const fill = palette[color] ?? palette.ink;
  const lines = String(text).split(/\r?\n/);
  const lineHeight = size * 1.25;
  for (const index of indices ?? pdf.getPageIndices()) {
    const page = pdf.getPage(index);
    const { width, height } = page.getSize();
    const boxWidth = Math.max(...lines.map((line) => font.widthOfTextAtSize(line, size)));
    const boxHeight = lineHeight * lines.length;
    const { x, y } = stampPosition(position, width, height, boxWidth, boxHeight, margin);
    lines.forEach((line, order) => page.drawText(line, {
      x, y: y + boxHeight - lineHeight * (order + 1) + (lineHeight - size) / 3,
      size, font, opacity, color: fill
    }));
  }
  return pdf;
}

export async function addPdfImage(pdfBuffer, { bytes, type = "image/png", indices, position = "bottom-right", widthPercent = 25, opacity = 1, margin = 28 } = {}) {
  if (!bytes) throw new Error("Choose an image first.");
  const pdf = await PDFDocument.load(pdfBuffer);
  const image = type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  for (const index of indices ?? pdf.getPageIndices()) {
    const page = pdf.getPage(index);
    const { width, height } = page.getSize();
    const drawWidth = (width * widthPercent) / 100;
    const drawHeight = (image.height / image.width) * drawWidth;
    const { x, y } = stampPosition(position, width, height, drawWidth, drawHeight, margin);
    page.drawImage(image, { x, y, width: drawWidth, height: drawHeight, opacity });
  }
  return pdf;
}

export function parseSplitRanges(value, count) {
  const groups = [];
  for (const token of value.split(",").map((part) => part.trim()).filter(Boolean)) {
    let pages;
    if (/^\d+$/.test(token)) pages = [Number(token)];
    else {
      const match = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!match) throw new Error(`Invalid page entry: ${token}`);
      const start = Math.min(Number(match[1]), Number(match[2]));
      const end = Math.max(Number(match[1]), Number(match[2]));
      pages = [];
      for (let page = start; page <= end; page += 1) pages.push(page);
    }
    if (pages.some((page) => page < 1 || page > count)) throw new Error(`Page numbers must be between 1 and ${count}.`);
    groups.push(pages.map((page) => page - 1));
  }
  if (!groups.length) throw new Error("Enter at least one page or range.");
  return groups;
}

export function intervalGroups(count, size) {
  if (!Number.isInteger(Number(size)) || Number(size) < 1) throw new Error("Enter a number of pages per file (1 or more).");
  const step = Number(size);
  const groups = [];
  for (let start = 0; start < count; start += step) {
    groups.push(Array.from({ length: Math.min(step, count - start) }, (_, offset) => start + offset));
  }
  return groups;
}

export async function splitPdf(pdfBuffer, indexGroups) {
  const outputs = [];
  for (const group of indexGroups) outputs.push(await selectPdfPages(pdfBuffer, group));
  return outputs;
}

export async function nUpPdf(pdfBuffer, { perSheet = 4, margin = 18, orientation = "auto", addBorder = false } = {}) {
  const source = await PDFDocument.load(pdfBuffer);
  const count = source.getPageCount();
  if (!count) throw new Error("This PDF has no pages.");
  const layouts = {
    2: { columns: 1, rows: 2, landscape: true },
    4: { columns: 2, rows: 2, landscape: false },
    6: { columns: 2, rows: 3, landscape: false },
    9: { columns: 3, rows: 3, landscape: false }
  };
  const layout = layouts[Number(perSheet)];
  if (!layout) throw new Error("Pages per sheet must be 2, 4, 6, or 9.");
  const output = await PDFDocument.create();
  const embedAll = await output.embedPdf(source, source.getPageIndices());
  const A4 = [595.28, 841.89];
  const sheetLandscape = orientation === "landscape" || (orientation === "auto" && layout.landscape);
  const sheetWidth = sheetLandscape ? A4[1] : A4[0];
  const sheetHeight = sheetLandscape ? A4[0] : A4[1];
  const cellWidth = (sheetWidth - margin * (layout.columns + 1)) / layout.columns;
  const cellHeight = (sheetHeight - margin * (layout.rows + 1)) / layout.rows;
  for (let first = 0; first < count; first += layout.columns * layout.rows) {
    const sheet = output.addPage([sheetWidth, sheetHeight]);
    for (let slot = 0; slot < layout.columns * layout.rows; slot += 1) {
      const index = first + slot;
      if (index >= count) break;
      const page = source.getPage(index);
      const { width, height } = page.getSize();
      const rotation = page.getRotation().angle % 360;
      const swap = rotation === 90 || rotation === 270;
      const sourceWidth = swap ? height : width;
      const sourceHeight = swap ? width : height;
      const scale = Math.min(cellWidth / sourceWidth, cellHeight / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      const column = slot % layout.columns;
      const row = Math.floor(slot / layout.columns);
      const cellX = margin + column * (cellWidth + margin) + (cellWidth - drawWidth) / 2;
      const cellY = sheetHeight - (margin + (row + 1) * cellHeight + row * margin) + (cellHeight - drawHeight) / 2;
      sheet.drawPage(embedAll[index], { x: cellX, y: cellY, width: drawWidth, height: drawHeight });
      if (addBorder) {
        sheet.drawRectangle({ x: cellX - 2, y: cellY - 2, width: drawWidth + 4, height: drawHeight + 4, borderWidth: 0.75, borderOpacity: 0.5 });
      }
    }
  }
  return output;
}

export async function cropPdfPages(pdfBuffer, indices, margins) {
  const pdf = await PDFDocument.load(pdfBuffer);
  const values = Object.fromEntries(["top","right","bottom","left"].map((key) => [key, Math.max(0, Number(margins[key]) || 0)]));
  for (const index of indices) {
    const page = pdf.getPage(index), { width, height } = page.getSize();
    if (values.left + values.right >= width || values.top + values.bottom >= height) throw new Error("Crop margins are larger than the page.");
    page.setCropBox(values.left, values.bottom, width - values.left - values.right, height - values.top - values.bottom);
  }
  return pdf;
}

export async function repairPdf(pdfBuffer) {
  const source = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, source.getPageIndices());
  pages.forEach((page) => output.addPage(page));
  return output;
}

export function savePdf(pdf) {
  return pdf.save({ useObjectStreams: true, addDefaultPage: false });
}
