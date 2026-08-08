import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, rgb } from "pdf-lib";
import { imagesToPdf, mergePdfs, optimizePdf, parsePages, savePdf, selectPdfPages } from "../src/pdf-tools.js";

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
