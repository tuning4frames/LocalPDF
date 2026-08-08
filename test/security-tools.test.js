import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { protectPdf, unlockPdf } from "../src/security-tools.js";

test("protect and unlock PDF round trip", async () => {
  const source = await PDFDocument.create();
  source.addPage([300, 400]);
  source.addPage([500, 600]);
  const original = await source.save();

  const protectedBytes = await protectPdf(original, "test-secret");
  assert.ok(protectedBytes.length > 0);
  assert.notDeepEqual(protectedBytes, original);
  await assert.rejects(() => unlockPdf(protectedBytes, "wrong-password"), /Incorrect password/i);

  const unlockedBytes = await unlockPdf(protectedBytes, "test-secret");
  const unlocked = await PDFDocument.load(unlockedBytes);
  assert.equal(unlocked.getPageCount(), 2);
  assert.deepEqual(unlocked.getPages().map((page) => page.getSize()), [
    { width: 300, height: 400 },
    { width: 500, height: 600 }
  ]);
});

test("protect requires a useful password", async () => {
  await assert.rejects(() => protectPdf(new Uint8Array(), ""), /Enter a password/);
  await assert.rejects(() => protectPdf(new Uint8Array(), "abc"), /at least 4/);
});
