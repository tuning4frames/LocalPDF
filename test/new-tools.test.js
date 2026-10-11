import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { addPdfImage, addPdfText, intervalGroups, nUpPdf, parseSplitRanges, splitPdf } from "../src/pdf-tools.js";
import { diffLines } from "../src/diff-tools.js";
import { getPdfMetadata, setPdfMetadata } from "../src/security-tools.js";
import { flattenPdf } from "../src/security-tools.js";

async function fixture(pageCount, width = 200) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([width + index, 300]);
    page.drawText(`Page ${index + 1}`, { x: 10, y: 150, size: 12, font, color: rgb(0, 0, 0) });
  }
  return pdf.save({ useObjectStreams: false });
}

const onePixelPng = () => Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+AvzZAAAAAElFTkSuQmCC", "base64"));

test("addPdfText stamps text at requested position without breaking pages", async () => {
  const input = await fixture(2);
  const output = await addPdfText(input, { text: "APPROVED", indices: [0, 1], position: "top-left", size: 20 });
  const loaded = await PDFDocument.load(await save(output));
  assert.equal(loaded.getPageCount(), 2);
});

test("addPdfText rejects empty text", async () => {
  const input = await fixture(1);
  await assert.rejects(() => addPdfText(input, { text: "   " }), /enter the text/i);
});

test("addPdfImage stamps an image on selected pages", async () => {
  const input = await fixture(2);
  const output = await addPdfImage(input, { bytes: onePixelPng(), type: "image/png", indices: [1], widthPercent: 25 });
  const loaded = await PDFDocument.load(await save(output));
  assert.equal(loaded.getPageCount(), 2);
});

async function save(pdf) {
  return pdf.save({ useObjectStreams: true, addDefaultPage: false });
}

test("parseSplitRanges supports ranges, singles, and mixed groups", () => {
  assert.deepEqual(parseSplitRanges("1-3, 5, 8-7", 9), [[0, 1, 2], [4], [6, 7]]);
  assert.throws(() => parseSplitRanges("1-4", 3), /between 1 and 3/);
  assert.throws(() => parseSplitRanges("", 3), /at least one/);
  assert.throws(() => parseSplitRanges("x", 3), /Invalid page entry/);
});

test("intervalGroups chunks pages into fixed-size groups", () => {
  assert.deepEqual(intervalGroups(5, 2), [[0, 1], [2, 3], [4]]);
  assert.deepEqual(intervalGroups(4, 4), [[0, 1, 2, 3]]);
  assert.throws(() => intervalGroups(4, 0), /1 or more/);
  assert.throws(() => intervalGroups(4, "x"), /1 or more/);
});

test("splitPdf produces one document per group", async () => {
  const input = await fixture(5);
  const parts = await splitPdf(input, [[0, 1], [2], [3, 4]]);
  assert.equal(parts.length, 3);
  const sizes = [];
  for (const part of parts) {
    const loaded = await PDFDocument.load(await save(part));
    sizes.push(loaded.getPageCount());
  }
  assert.deepEqual(sizes, [2, 1, 2]);
});

test("diffLines finds additions, removals, and unchanged lines", () => {
  const diff = diffLines(["alpha", "beta", "gamma"], ["alpha", "delta", "gamma"]);
  assert.deepEqual(diff, [
    { type: "same", text: "alpha" },
    { type: "removed", text: "beta" },
    { type: "added", text: "delta" },
    { type: "same", text: "gamma" }
  ]);
  assert.deepEqual(diffLines([], ["new"]), [{ type: "added", text: "new" }]);
  assert.deepEqual(diffLines(["old"], []), [{ type: "removed", text: "old" }]);
  assert.deepEqual(diffLines([], []), []);
});

test("metadata round-trips through set and get", async () => {
  const input = await fixture(1);
  const updated = await setPdfMetadata(input, { title: "Report", author: "Ada", keywords: "one, two", subject: "Testing" });
  const meta = await getPdfMetadata(await save(updated));
  assert.equal(meta.title, "Report");
  assert.equal(meta.author, "Ada");
  assert.equal(meta.keywords, "one, two");
  assert.equal(meta.subject, "Testing");
  assert.equal(meta.pageCount, 1);
});

test("nUpPdf packs pages onto fewer A4 sheets with valid layouts", async () => {
  const input = await fixture(7);
  const output = await nUpPdf(input, { perSheet: 4 });
  const bytes = await save(output);
  const loaded = await PDFDocument.load(bytes);
  assert.equal(loaded.getPageCount(), 2);
  assert.deepEqual(loaded.getPage(0).getSize(), { width: 595.28, height: 841.89 });
});

test("nUpPdf 2-up uses landscape sheets and validates perSheet", async () => {
  const input = await fixture(3);
  const landscape = await nUpPdf(input, { perSheet: 2 });
  const loaded = await PDFDocument.load(await save(landscape));
  assert.equal(loaded.getPageCount(), 2);
  assert.ok(loaded.getPage(0).getWidth() > loaded.getPage(0).getHeight());
  await assert.rejects(() => nUpPdf(input, { perSheet: 5 }), /2, 4, 6, or 9/);
});

test("flattenPdf keeps all pages and drops annotation arrays", async () => {
  const pdf = await PDFDocument.load(await fixture(2));
  const annotArray = pdf.context.obj([pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "Text", Rect: [0, 0, 10, 10] }))]);
  pdf.getPage(0).node.setAnnots?.(annotArray);
  const bytes = await save(pdf);
  const flattened = await flattenPdf(bytes);
  const loaded = await PDFDocument.load(await save(flattened));
  assert.equal(loaded.getPageCount(), 2);
  assert.equal(loaded.getPage(0).node.Annots(), undefined);
});
