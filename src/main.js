import {
  imagesToPdf,
  mergePdfs,
  optimizePdf,
  parsePages,
  savePdf,
  selectPdfPages
} from "./pdf-tools.js";
import { ArrowDown, ArrowUp, createIcons, Download, Images, ListRestart, Minimize2, Plus, SquareSplitHorizontal, SquaresUnite, Upload, X } from "lucide";

const iconSet = { ArrowDown, ArrowUp, Download, Images, ListRestart, Minimize2, Plus, SquareSplitHorizontal, SquaresUnite, Upload, X };
createIcons({ icons: iconSet });

const tools = {
  merge: { number: "01", title: "Merge PDF", description: "Add two or more PDF files and arrange them in the order you want.", accept: "application/pdf", multiple: true, drop: "Drop PDFs here", hint: "or click to choose files", action: "Merge and download" },
  split: { number: "02", title: "Split PDF", description: "Choose the pages you want to extract into a new PDF.", accept: "application/pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Extract and download" },
  organize: { number: "03", title: "Organize PDF", description: "Enter a new page order, leaving out pages you do not want.", accept: "application/pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Organize and download" },
  images: { number: "04", title: "Images to PDF", description: "Turn JPG or PNG images into a single PDF in the order shown.", accept: "image/jpeg,image/png", multiple: true, drop: "Drop images here", hint: "JPG or PNG · click to choose", action: "Create and download" },
  compress: { number: "05", title: "Optimize PDF", description: "Rewrite and clean a PDF's structure without lowering visual quality.", accept: "application/pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Optimize and download" }
};

let activeTool = "merge";
let files = [];
const $ = (selector) => document.querySelector(selector);
const input = $("#file-input");
const dropzone = $("#dropzone");
const list = $("#file-list");
const message = $("#message");

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderOptions() {
  const options = $("#options");
  if ((activeTool === "split" || activeTool === "organize") && files.length) {
    const label = activeTool === "split" ? "Pages to extract" : "New page order";
    options.innerHTML = `<label><span>${label}</span><input id="page-range" type="text" placeholder="Example: 1-3, 6, 9" /></label><p>Use page numbers, ranges, or a custom order.</p>`;
  } else if (activeTool === "compress" && files.length) {
    options.innerHTML = `<div class="notice"><strong>Lossless optimization</strong><p>This cleans and rewrites the document. It may reduce bloated files, but it will not degrade or recompress embedded images.</p></div>`;
  } else options.innerHTML = "";
}

function renderFiles() {
  list.innerHTML = "";
  files.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "file-item";
    const details = document.createElement("div");
    const name = document.createElement("strong");
    const size = document.createElement("small");
    name.textContent = file.name;
    size.textContent = formatBytes(file.size);
    details.append(name, size);
    const actions = document.createElement("div");
    actions.className = "file-actions";
    if (tools[activeTool].multiple) {
      actions.insertAdjacentHTML("beforeend", `<button data-up="${index}" aria-label="Move up" ${index === 0 ? "disabled" : ""}><i data-lucide="arrow-up"></i></button><button data-down="${index}" aria-label="Move down" ${index === files.length - 1 ? "disabled" : ""}><i data-lucide="arrow-down"></i></button>`);
    }
    actions.insertAdjacentHTML("beforeend", `<button data-remove="${index}" aria-label="Remove"><i data-lucide="x"></i></button>`);
    item.append(details, actions);
    list.append(item);
  });
  createIcons({ icons: iconSet });
  $("#file-area").hidden = !files.length;
  dropzone.hidden = files.length && !tools[activeTool].multiple;
  const ready = files.length >= (activeTool === "merge" ? 2 : 1);
  $("#process-button").disabled = !ready;
  renderOptions();
}

function getFilePositions() {
  return new Map([...list.children].map((item, index) => [files[index], item.getBoundingClientRect()]));
}

function animateFileReorder(previousPositions) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  [...list.children].forEach((item, index) => {
    const previous = previousPositions.get(files[index]);
    if (!previous) return;
    const current = item.getBoundingClientRect();
    const offset = previous.top - current.top;
    if (!offset) return;
    item.animate(
      [{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }],
      { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  });
}

function addFiles(incoming) {
  const config = tools[activeTool];
  const valid = [...incoming].filter((file) => {
    if (config.accept.split(",").includes(file.type)) return true;
    if (config.accept === "application/pdf") return /\.pdf$/i.test(file.name);
    return /\.(jpe?g|png)$/i.test(file.name);
  });
  files = config.multiple ? [...files, ...valid] : valid.slice(0, 1);
  message.textContent = valid.length ? "" : "That file type is not supported by this tool.";
  renderFiles();
}

function selectTool(name) {
  activeTool = name; files = []; message.textContent = "";
  const config = tools[name];
  document.querySelectorAll(".tool").forEach((button) => button.classList.toggle("active", button.dataset.tool === name));
  $("#tool-title").textContent = config.title;
  $("#tool-description").textContent = config.description;
  $("#drop-title").textContent = config.drop;
  $("#drop-hint").textContent = config.hint;
  $("#process-label").textContent = config.action;
  input.accept = config.accept; input.multiple = config.multiple; input.value = "";
  dropzone.hidden = false; renderFiles();
}

async function download(pdf, name) {
  const bytes = await savePdf(pdf);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return bytes.length;
}

async function processFiles() {
  const button = $("#process-button");
  button.disabled = true; button.classList.add("working"); message.textContent = "Working locally…";
  try {
    let output, name;
    if (activeTool === "merge") {
      output = await mergePdfs(await Promise.all(files.map((file) => file.arrayBuffer())));
      name = "merged.pdf";
    } else if (activeTool === "images") {
      output = await imagesToPdf(await Promise.all(files.map(async (file) => ({ type: file.type, bytes: await file.arrayBuffer() }))));
      name = "images.pdf";
    } else {
      const bytes = await files[0].arrayBuffer();
      const source = await optimizePdf(bytes);
      if (activeTool === "compress") { output = source; name = `${files[0].name.replace(/\.pdf$/i, "")}-optimized.pdf`; }
      else { const indices = parsePages($("#page-range").value, source.getPageCount()); output = await selectPdfPages(bytes, indices); name = `${files[0].name.replace(/\.pdf$/i, "")}-${activeTool === "split" ? "extracted" : "organized"}.pdf`; }
    }
    const size = await download(output, name);
    message.textContent = `Done — downloaded ${name} (${formatBytes(size)}).`;
  } catch (error) { message.textContent = `Could not process this file: ${error.message}`; }
  finally { button.disabled = false; button.classList.remove("working"); }
}

document.querySelectorAll(".tool").forEach((button) => button.addEventListener("click", () => selectTool(button.dataset.tool)));
dropzone.addEventListener("click", () => input.click()); dropzone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") input.click(); });
input.addEventListener("change", () => { addFiles(input.files); input.value = ""; }); $("#add-more").addEventListener("click", () => input.click());
for (const type of ["dragenter", "dragover"]) dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.add("dragging"); });
for (const type of ["dragleave", "drop"]) dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.remove("dragging"); });
dropzone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
list.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const key = button.dataset.remove !== undefined ? "remove" : button.dataset.up !== undefined ? "up" : "down";
  const index = Number(button.dataset[key]);
  const previousPositions = getFilePositions();
  let reordered = false;
  if (key === "remove") files.splice(index, 1);
  else {
    const target = key === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < files.length) {
      [files[index], files[target]] = [files[target], files[index]];
      reordered = true;
    }
  }
  renderFiles();
  if (reordered && activeTool === "merge") animateFileReorder(previousPositions);
});
$("#process-button").addEventListener("click", processFiles);
selectTool("merge");
