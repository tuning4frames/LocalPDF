import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, rgb } from "pdf-lib";
import { addPdfPageNumbers, addPdfWatermark, cropPdfPages, imagesToPdf, mergePdfs, optimizePdf, parsePages, repairPdf, rotatePdfPages, savePdf, selectPdfPages } from "../src/pdf-tools.js";

async function fixture(pageCount, width = 200) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([width + index, 300]);
    page.drawRectangle({ x: 10, y: 10, width: 20, height: 20, color: rgb(index / pageCount, 0, 0) });
  }
  return pdf.save({ useObjectStreams: false });
}

test("page ranges support ranges, custom order, duplicates, and descending ranges", () => {
  assert.deepEqual(parsePages("1-3, 5, 3, 7-6", 7), [0, 1, 2, 4, 2, 6, 5]);
  assert.throws(() => parsePages("", 3), /at least one page/);
  assert.throws(() => parsePages("4", 3), /between 1 and 3/);
  assert.throws(() => parsePages("one", 3), /Invalid page entry/);
});

test("merge combines every page in source order", async () => {
  const output = await mergePdfs([await fixture(2, 200), await fixture(3, 400)]);
  const loaded = await PDFDocument.load(await savePdf(output));
  assert.equal(loaded.getPageCount(), 5);
  assert.deepEqual(loaded.getPages().map((page) => page.getWidth()), [200, 201, 400, 401, 402]);
});

test("split extracts only selected pages", async () => {
  const output = await selectPdfPages(await fixture(5, 200), parsePages("2-3", 5));
  const loaded = await PDFDocument.load(await savePdf(output));
  assert.equal(loaded.getPageCount(), 2);
  assert.deepEqual(loaded.getPages().map((page) => page.getWidth()), [201, 202]);
});

test("organize reorders, duplicates, and removes pages", async () => {
  const output = await selectPdfPages(await fixture(4, 200), parsePages("4, 2, 2", 4));
  const loaded = await PDFDocument.load(await savePdf(output));
  assert.deepEqual(loaded.getPages().map((page) => page.getWidth()), [203, 201, 201]);
});

test("images to PDF creates one correctly-sized page per PNG", async () => {
  const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+AvzZAAAAAElFTkSuQmCC", "base64");
  const output = await imagesToPdf([{ type: "image/png", bytes: pngBytes }, { type: "image/png", bytes: pngBytes }]);
  const loaded = await PDFDocument.load(await savePdf(output));
  assert.equal(loaded.getPageCount(), 2);
  assert.equal(loaded.getPage(0).getWidth(), 1);
});

test("optimization produces a readable document with all pages", async () => {
  const input = await fixture(3);
  const output = await optimizePdf(input);
  const bytes = await savePdf(output);
  const loaded = await PDFDocument.load(bytes);
  assert.equal(loaded.getPageCount(), 3);
  assert.ok(bytes.length > 0);
});

test("rotate changes only selected pages and preserves existing rotation", async () => {
  const input = await fixture(3, 200);
  const firstPass = await rotatePdfPages(input, [0, 2], 90);
  const secondPass = await rotatePdfPages(await savePdf(firstPass), [2], 90);
  const loaded = await PDFDocument.load(await savePdf(secondPass));
  assert.deepEqual(loaded.getPages().map((page) => page.getRotation().angle), [90, 0, 180]);
  assert.deepEqual(loaded.getPages().map((page) => page.getSize()), [
    { width: 200, height: 300 }, { width: 201, height: 300 }, { width: 202, height: 300 }
  ]);
});

test("page numbering preserves all pages and adds page content", async () => {
  const input = await fixture(3, 200);
  const output = await addPdfPageNumbers(input, { indices: [1, 2], start: 7, position: "top-right" });
  const bytes = await savePdf(output);
  const loaded = await PDFDocument.load(bytes);
  assert.equal(loaded.getPageCount(), 3);
  assert.ok(bytes.length > 0);
  assert.notDeepEqual(bytes, input);
  assert.ok(loaded.getPage(1).node.Contents());
  assert.ok(loaded.getPage(2).node.Contents());
});

test("watermark adds content while preserving pages", async () => {
  const input = await fixture(2, 300);
  const output = await addPdfWatermark(input, { text: "PRIVATE", indices: [0], opacity: 0.2 });
  const loaded = await PDFDocument.load(await savePdf(output));
  assert.equal(loaded.getPageCount(), 2);
  assert.ok(loaded.getPage(0).node.Contents());
  await assert.rejects(() => addPdfWatermark(input, { text: "" }), /watermark text/i);
});

test("crop applies selected page crop boxes", async () => {
  const input = await fixture(2, 300);
  const output = await cropPdfPages(input, [1], { top: 10, right: 20, bottom: 30, left: 40 });
  const loaded = await PDFDocument.load(await savePdf(output));
  assert.deepEqual(loaded.getPage(1).getCropBox(), { x: 40, y: 30, width: 241, height: 260 });
  await assert.rejects(() => cropPdfPages(input, [0], { left: 200, right: 200 }), /larger than the page/i);
});

test("repair rewrites all readable pages into a new PDF", async () => {
  const input = await fixture(3, 240);
  const output = await repairPdf(input);
  const loaded = await PDFDocument.load(await savePdf(output));
  assert.equal(loaded.getPageCount(), 3);
  assert.deepEqual(loaded.getPages().map((page) => page.getWidth()), [240, 241, 242]);
});
