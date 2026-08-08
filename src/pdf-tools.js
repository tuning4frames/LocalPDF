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
