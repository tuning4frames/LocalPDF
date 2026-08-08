import { Document, Packer, Paragraph, PageBreak } from "docx";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export async function extractPdfPages(bytes) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const lines = new Map();
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y).push({ x: item.transform[4], text: item.str });
    }
    const text = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ").trim())
      .filter(Boolean);
    pages.push(text);
  }
  return pages;
}

export async function pdfToWord(bytes) {
  const pages = await extractPdfPages(bytes);
  const children = [];
  pages.forEach((lines, pageIndex) => {
    lines.forEach((line) => children.push(new Paragraph(line)));
    if (pageIndex < pages.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
  });
  const document = new Document({ sections: [{ children }] });
  return Packer.toBlob(document);
}

export async function pdfToPowerPoint(bytes) {
  const pages = await extractPdfPages(bytes);
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_WIDE";
  pages.forEach((lines) => {
    const slide = presentation.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addText(lines.join("\n") || " ", { x: 0.65, y: 0.55, w: 12.05, h: 6.35, fontFace: "Arial", fontSize: 15, color: "171713", margin: 0.08, breakLine: false, valign: "top", fit: "shrink" });
  });
  return presentation.write({ outputType: "blob" });
}

export async function pdfToExcel(bytes) {
  const pages = await extractPdfPages(bytes);
  const workbook = XLSX.utils.book_new();
  pages.forEach((lines, index) => {
    const rows = lines.map((line) => line.split(/\s{2,}|\t/).filter(Boolean));
    const sheet = XLSX.utils.aoa_to_sheet(rows.length ? rows : [[""]]);
    XLSX.utils.book_append_sheet(workbook, sheet, `Page ${index + 1}`);
  });
  return new Blob([XLSX.write(workbook, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function textToPdf(lines, title) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  let y = 54;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(String(line ?? ""), width - 72);
    for (const row of wrapped.length ? wrapped : [""]) {
      if (y > height - 45) { pdf.addPage(); y = 54; }
      pdf.text(row, 36, y); y += 14;
    }
  }
  pdf.setProperties({ title });
  return pdf.output("blob");
}

export async function wordToPdf(bytes, name) {
  const result = await mammoth.extractRawText({ arrayBuffer: bytes });
  return textToPdf(result.value.split(/\r?\n/), name);
}

export async function excelToPdf(bytes, name) {
  const workbook = XLSX.read(bytes, { type: "array" });
  const lines = [];
  workbook.SheetNames.forEach((sheetName) => {
    lines.push(sheetName);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false });
    rows.forEach((row) => lines.push(row.join("    ")));
    lines.push("");
  });
  return textToPdf(lines, name);
}

export async function powerPointToPdf(bytes, name) {
  const zip = await JSZip.loadAsync(bytes);
  const slides = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const lines = [];
  for (const [index, path] of slides.entries()) {
    const xml = await zip.file(path).async("text");
    const document = new DOMParser().parseFromString(xml, "application/xml");
    lines.push(`Slide ${index + 1}`);
    lines.push(...[...document.getElementsByTagNameNS("*", "t")].map((node) => node.textContent));
    lines.push("");
  }
  return textToPdf(lines, name);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
