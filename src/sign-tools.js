import { PDFDocument } from "pdf-lib";

export function blankCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 300;
  return canvas;
}

export function attachDrawEvents(canvas, onDirty) {
  const context = canvas.getContext("2d");
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 7;
  context.strokeStyle = "#171713";
  let drawing = false;
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  };
  const start = (event) => {
    drawing = true;
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y);
    context.stroke();
  };
  const move = (event) => {
    if (!drawing) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
    if (event.cancelable) event.preventDefault();
  };
  const end = () => { drawing = false; onDirty?.(); };
  canvas.addEventListener("pointerdown", (event) => { canvas.setPointerCapture(event.pointerId); start(event); });
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointerleave", end);
  return () => context;
}

export function clearCanvas(canvas) {
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}

export function canvasHasInk(canvas) {
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.length; index += 40) if (data[index] !== 0) return true;
  return false;
}

export function renderTypedSignature(text, color = "#171713") {
  const canvas = blankCanvas();
  const context = canvas.getContext("2d");
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  let size = 150;
  do {
    context.font = `500 ${size}px Poppins, cursive, sans-serif`;
    size -= 10;
  } while (context.measureText(text).width > canvas.width - 60 && size > 20);
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  return canvas;
}

export function canvasToPngBytes(canvas) {
  const dataUrl = canvas.toDataURL("image/png");
  return Uint8Array.from(atob(dataUrl.split(",")[1]), (character) => character.charCodeAt(0));
}

export async function stampSignature(pdfBuffer, { pngBytes, page = 1, position = "bottom-right", widthPercent = 25, margin = 28 }) {
  const pdf = await PDFDocument.load(pdfBuffer);
  const pageCount = pdf.getPageCount();
  if (!Number.isInteger(page) || page < 1 || page > pageCount) throw new Error(`Page must be between 1 and ${pageCount}.`);
  const png = await pdf.embedPng(pngBytes);
  const target = pdf.getPage(page - 1);
  const { width, height } = target.getSize();
  const drawWidth = (width * widthPercent) / 100;
  const drawHeight = (png.height / png.width) * drawWidth;
  const x = position.endsWith("left") ? margin : position.endsWith("right") ? width - drawWidth - margin : (width - drawWidth) / 2;
  const y = position.startsWith("top") ? height - drawHeight - margin : margin;
  target.drawImage(png, { x, y, width: drawWidth, height: drawHeight });
  return pdf;
}

export async function renderPdfToViewer(pdfBytes, canvas, { scale = 1.4 } = {}) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const render = async (pageNumber) => {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
  };
  return { pdf, render, pageCount: pdf.numPages, destroy: () => pdf.destroy?.() };
}
