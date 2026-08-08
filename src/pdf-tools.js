import { PDFDocument } from "pdf-lib";

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

export function savePdf(pdf) {
  return pdf.save({ useObjectStreams: true, addDefaultPage: false });
}
