import { PDFDocument } from "pdf-lib";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import * as pdfjs from "pdfjs-dist";
import { diffLines } from "./diff-tools.js";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const CANVAS_MAX = 4096;

async function openPdf(bytes) {
  return pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
}

async function renderPageToCanvas(page, scale) {
  const base = page.getViewport({ scale: 1 });
  const capped = Math.min(scale, CANVAS_MAX / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale: capped });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

function canvasToBytes(canvas, format, quality) {
  const dataUrl = canvas.toDataURL(`image/${format}`, quality);
  return { bytes: Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0)), dataUrl };
}

export async function pdfToImages(pdfBytes, { format = "png", dpi = 150, quality = 0.92 } = {}) {
  const pdf = await openPdf(pdfBytes);
  const images = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const canvas = await renderPageToCanvas(page, dpi / 72);
    const { bytes, dataUrl } = canvasToBytes(canvas, format, quality);
    images.push({ name: `page-${String(number).padStart(String(pdf.numPages).length, "0")}.${format === "jpeg" ? "jpg" : "png"}`, bytes, dataUrl });
    canvas.width = 0;
    canvas.height = 0;
  }
  return images;
}

export async function zipFiles(entries, zipName) {
  const zip = new JSZip();
  for (const entry of entries) zip.file(entry.name, entry.bytes);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { blob, name: zipName.endsWith(".zip") ? zipName : `${zipName}.zip` };
}

export async function compressPdfRender(pdfBytes, { dpi = 150, quality = 0.8 } = {}) {
  const images = await pdfToImages(pdfBytes, { format: "jpeg", dpi, quality });
  const output = await PDFDocument.create();
  const inputs = await Promise.all(images.map(async (image) => {
    const jpg = await output.embedJpg(image.bytes);
    return { jpg, w: jpg.width, h: jpg.height };
  }));
  if (!inputs.length) throw new Error("This PDF has no pages to compress.");
  for (const { jpg, w, h } of inputs) {
    const page = output.addPage([w, h]);
    page.drawImage(jpg, { x: 0, y: 0, width: w, height: h });
  }
  return saveOutput(output);
}

async function saveOutput(pdf) {
  return pdf.save({ useObjectStreams: true, addDefaultPage: false });
}

export async function comparePdfTexts(aBytes, bBytes) {
  const [aPdf, bPdf] = await Promise.all([openPdf(aBytes), openPdf(bBytes)]);
  const extract = async (pdf) => {
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim());
    }
    return pages;
  };
  const [aPages, bPages] = await Promise.all([extract(aPdf), extract(bPdf)]);
  const aLines = aPages.flatMap((text, index) => (text ? [`${index + 1}| ${text}`] : []));
  const bLines = bPages.flatMap((text, index) => (text ? [`${index + 1}| ${text}`] : []));
  return diffLines(aLines, bLines);
}

export async function htmlToPdf(html, { title = "Document" } = {}) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const lines = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.replace(/\s+/g, " ").trim();
        if (text) lines.push(text);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (/^(SCRIPT|STYLE)$/.test(child.tagName)) continue;
        const block = /^(P|DIV|H[1-6]|LI|TR|TABLE|BLOCKQUOTE|PRE|BR|SECTION|ARTICLE|HEADER|FOOTER|MAIN)$/.test(child.tagName);
        if (block) lines.push("\n");
        walk(child);
        if (block) lines.push("\n");
      }
    }
  };
  walk(document.body || document);
  const rows = [];
  for (const line of lines.join("").split(/\n/)) {
    const text = line.trim();
    if (text) rows.push(text);
  }
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  let y = 54;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const pending = rows.length ? [...rows] : ["(empty document)"];
  for (const row of pending) {
    const wrapped = pdf.splitTextToSize(row, width - 72);
    for (const part of wrapped) {
      if (y > height - 45) { pdf.addPage(); y = 54; }
      pdf.text(part, 36, y);
      y += 14;
    }
  }
  pdf.setProperties({ title });
  return pdf.output("blob");
}
