import {
  addPdfPageNumbers,
  addPdfWatermark,
  cropPdfPages,
  imagesToPdf,
  mergePdfs,
  optimizePdf,
  parsePages,
  repairPdf,
  rotatePdfPages,
  savePdf,
  selectPdfPages
} from "./pdf-tools.js";
import { downloadBlob, excelToPdf, pdfToExcel, pdfToPowerPoint, pdfToWord, powerPointToPdf, wordToPdf } from "./office-tools.js";
import { protectPdf, unlockPdf } from "./security-tools.js";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, createIcons, Crop, Download, Eye, EyeOff, FileText, FileType2, Images, ListOrdered, ListRestart, LockKeyhole, LockKeyholeOpen, Minimize2, Plus, Presentation, RotateCw, Sheet, SquareSplitHorizontal, SquaresUnite, Stamp, Upload, Wrench, X } from "lucide";

const iconSet = { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crop, Download, Eye, EyeOff, FileText, FileType2, Images, ListOrdered, ListRestart, LockKeyhole, LockKeyholeOpen, Minimize2, Plus, Presentation, RotateCw, Sheet, SquareSplitHorizontal, SquaresUnite, Stamp, Upload, Wrench, X };
createIcons({ icons: iconSet });

const tools = {
  merge: { number: "01", title: "Merge PDF", description: "Add two or more PDF files and arrange them in the order you want.", accept: "application/pdf", multiple: true, drop: "Drop PDFs here", hint: "or click to choose files", action: "Merge and download" },
  split: { number: "02", title: "Split PDF", description: "Choose the pages you want to extract into a new PDF.", accept: "application/pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Extract and download" },
  organize: { number: "03", title: "Organize PDF", description: "Enter a new page order, leaving out pages you do not want.", accept: "application/pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Organize and download" },
  images: { number: "04", title: "Images to PDF", description: "Turn JPG or PNG images into a single PDF in the order shown.", accept: "image/jpeg,image/png", multiple: true, drop: "Drop images here", hint: "JPG or PNG · click to choose", action: "Create and download" },
  compress: { number: "05", title: "Optimize PDF", description: "Rewrite and clean a PDF's structure without lowering visual quality.", accept: "application/pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Optimize and download" }
  ,protect: { title: "Protect PDF", description: "Add an opening password to a PDF. The password and file remain entirely on this device.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Protect and download" }
  ,unlock: { title: "Unlock PDF", description: "Remove a PDF opening password when you know the current password.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a protected PDF here", hint: "or click to choose a file", action: "Unlock and download" }
  ,rotate: { title: "Rotate PDF", description: "Rotate every page or a selected page range by 90, 180, or 270 degrees.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Rotate and download" }
  ,"page-numbers": { title: "Add Page Numbers", description: "Add page numbers with a custom starting number, page range, and position.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Number and download" }
  ,watermark: { title: "Watermark PDF", description: "Add a customizable text watermark to every page or a selected page range.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Watermark and download" }
  ,crop: { title: "Crop PDF", description: "Trim margins from every page or a selected page range. Measurements use PDF points.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Crop and download" }
  ,repair: { title: "Repair PDF", description: "Rewrite the document structure and copy readable pages into a clean new PDF.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Repair and download" }
  ,"pdf-word": { title: "PDF to Word", description: "Extract text from each PDF page into an editable Word document. Complex layout and images are not preserved in this basic converter.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Convert to Word" }
  ,"word-pdf": { title: "Word to PDF", description: "Convert the readable text in a DOCX document into a clean PDF. Complex Word layout and images may change.", accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document", multiple: false, drop: "Drop a Word file here", hint: "DOCX - click to choose", action: "Convert to PDF" }
  ,"pdf-powerpoint": { title: "PDF to PowerPoint", description: "Create an editable PowerPoint with one text-based slide for every PDF page.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Convert to PowerPoint" }
  ,"powerpoint-pdf": { title: "PowerPoint to PDF", description: "Extract slide text from a PPTX presentation into a readable PDF. Visual slide design is not preserved.", accept: ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation", multiple: false, drop: "Drop a PowerPoint here", hint: "PPTX - click to choose", action: "Convert to PDF" }
  ,"pdf-excel": { title: "PDF to Excel", description: "Extract PDF text and simple table-like rows into one Excel worksheet per page.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Convert to Excel" }
  ,"excel-pdf": { title: "Excel to PDF", description: "Convert worksheet values from XLSX or XLS into a readable PDF. Spreadsheet styling may change.", accept: ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel", multiple: false, drop: "Drop an Excel file here", hint: "XLSX or XLS - click to choose", action: "Convert to PDF" }
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
    options.innerHTML = `<div class="range-card"><label for="page-range"><span>${label}</span><small>Use page numbers, ranges, or a custom order.</small></label><input id="page-range" type="text" inputmode="numeric" autocomplete="off" placeholder="Example: 1-3, 6, 9" /></div>`;
  } else if (activeTool === "compress" && files.length) {
    options.innerHTML = `<div class="notice"><strong>Lossless optimization</strong><p>This cleans and rewrites the document. It may reduce bloated files, but it will not degrade or recompress embedded images.</p></div>`;
  } else if ((activeTool === "protect" || activeTool === "unlock") && files.length) {
    const confirmation = activeTool === "protect" ? `<label><span>Confirm password</span><div class="password-input"><input id="confirm-password" type="password" autocomplete="new-password" /><button type="button" data-toggle-password="confirm-password" aria-label="Show password"><i data-lucide="eye"></i></button></div></label>` : "";
    options.innerHTML = `<div class="password-card"><label><span>${activeTool === "protect" ? "New password" : "Current password"}</span><div class="password-input"><input id="pdf-password" type="password" autocomplete="${activeTool === "protect" ? "new-password" : "current-password"}" /><button type="button" data-toggle-password="pdf-password" aria-label="Show password"><i data-lucide="eye"></i></button></div></label>${confirmation}<small>Passwords are used only in memory and are never saved.</small></div>`;
    createIcons({ icons: iconSet });
  } else if (activeTool === "rotate" && files.length) {
    options.innerHTML = `<div class="settings-card"><label><span>Pages</span><input id="rotate-pages" type="text" placeholder="All pages or 1-3, 6" /></label><label><span>Rotation</span><select id="rotate-angle"><option value="90">90 degrees clockwise</option><option value="180">180 degrees</option><option value="270">270 degrees clockwise</option></select></label></div>`;
  } else if (activeTool === "page-numbers" && files.length) {
    options.innerHTML = `<div class="settings-card page-number-settings"><label><span>Pages</span><input id="number-pages" type="text" placeholder="All pages or 1-3, 6" /></label><label><span>Start at</span><input id="number-start" type="number" min="0" value="1" /></label><label><span>Position</span><select id="number-position"><option value="bottom-center">Bottom center</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option><option value="top-center">Top center</option><option value="top-left">Top left</option><option value="top-right">Top right</option></select></label></div>`;
  } else if (activeTool === "watermark" && files.length) {
    options.innerHTML = `<div class="settings-card watermark-settings"><label><span>Text</span><input id="watermark-text" type="text" placeholder="CONFIDENTIAL" /></label><label><span>Pages</span><input id="watermark-pages" type="text" placeholder="All pages or 1-3, 6" /></label><label><span>Opacity</span><select id="watermark-opacity"><option value="0.12">Light</option><option value="0.2" selected>Medium</option><option value="0.32">Strong</option></select></label></div>`;
  } else if (activeTool === "crop" && files.length) {
    options.innerHTML = `<div class="settings-card crop-settings"><label><span>Pages</span><input id="crop-pages" type="text" placeholder="All pages or 1-3, 6" /></label><label><span>Top</span><input id="crop-top" type="number" min="0" value="18" /></label><label><span>Right</span><input id="crop-right" type="number" min="0" value="18" /></label><label><span>Bottom</span><input id="crop-bottom" type="number" min="0" value="18" /></label><label><span>Left</span><input id="crop-left" type="number" min="0" value="18" /></label></div>`;
  } else if (activeTool === "repair" && files.length) {
    options.innerHTML = `<div class="notice"><strong>Structural repair</strong><p>Readable pages will be copied into a clean PDF. Severely damaged files may still be unrecoverable.</p></div>`;
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
    const extensions = config.accept.split(",").filter((entry) => entry.startsWith("."));
    if (extensions.some((extension) => file.name.toLowerCase().endsWith(extension))) return true;
    if (config.accept.includes("application/pdf")) return /\.pdf$/i.test(file.name);
    return config.accept.includes("image/") && /\.(jpe?g|png)$/i.test(file.name);
  });
  files = config.multiple ? [...files, ...valid] : valid.slice(0, 1);
  message.textContent = valid.length ? "" : "That file type is not supported by this tool.";
  renderFiles();
}

function selectTool(name) {
  activeTool = name; files = []; message.textContent = "";
  const config = tools[name];
  $("#tool-title").textContent = config.title;
  $("#tool-description").textContent = config.description;
  $("#drop-title").textContent = config.drop;
  $("#drop-hint").textContent = config.hint;
  $("#process-label").textContent = config.action;
  input.accept = config.accept; input.multiple = config.multiple; input.value = "";
  dropzone.hidden = false; renderFiles();
  switchPage($("#tools-page"), $("#tool-page"));
  window.scrollTo({ top: 0, behavior: "instant" });
}

function switchPage(from, to) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { from.hidden = true; to.hidden = false; return; }
  from.classList.add("page-leaving");
  setTimeout(() => {
    from.hidden = true;
    from.classList.remove("page-leaving");
    to.hidden = false;
    if (to.id === "tools-page") {
      const hero = to.querySelector(".hero");
      const toolsGrid = to.querySelector(".tools");
      hero?.animate(
        [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 120, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }
      );
      toolsGrid?.animate(
        [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 120, delay: 70, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }
      );
      return;
    }
    const targets = [...to.children];
    targets.filter(Boolean).forEach((target, index) => target.animate(
      [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 120, delay: index * 8, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }
    ));
  }, 60);
}

function showTools() {
  files = [];
  input.value = "";
  message.textContent = "";
  renderFiles();
  switchPage($("#tool-page"), $("#tools-page"));
  window.scrollTo({ top: 0, behavior: "instant" });
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
    if (["rotate", "page-numbers", "watermark", "crop", "repair"].includes(activeTool)) {
      const bytes = await files[0].arrayBuffer();
      const source = await optimizePdf(bytes);
      const count = source.getPageCount();
      const rangeFields = { rotate: "#rotate-pages", "page-numbers": "#number-pages", watermark: "#watermark-pages", crop: "#crop-pages" };
      const rangeValue = rangeFields[activeTool] ? $(rangeFields[activeTool]).value : "";
      const indices = rangeValue.trim() ? parsePages(rangeValue, count) : source.getPageIndices();
      const base = files[0].name.replace(/\.pdf$/i, "");
      if (activeTool === "rotate") {
        output = await rotatePdfPages(bytes, indices, Number($("#rotate-angle").value));
        name = `${base}-rotated.pdf`;
      } else if (activeTool === "page-numbers") {
        output = await addPdfPageNumbers(bytes, { indices, start: Number($("#number-start").value), position: $("#number-position").value });
        name = `${base}-numbered.pdf`;
      } else if (activeTool === "watermark") {
        output = await addPdfWatermark(bytes, { indices, text: $("#watermark-text").value, opacity: Number($("#watermark-opacity").value) });
        name = `${base}-watermarked.pdf`;
      } else if (activeTool === "crop") {
        output = await cropPdfPages(bytes, indices, { top: $("#crop-top").value, right: $("#crop-right").value, bottom: $("#crop-bottom").value, left: $("#crop-left").value });
        name = `${base}-cropped.pdf`;
      } else {
        output = await repairPdf(bytes);
        name = `${base}-repaired.pdf`;
      }
    } else if (activeTool === "protect" || activeTool === "unlock") {
      const bytes = await files[0].arrayBuffer();
      const base = files[0].name.replace(/\.pdf$/i, "");
      const password = $("#pdf-password").value;
      if (activeTool === "protect") {
        if (password !== $("#confirm-password").value) throw new Error("The passwords do not match.");
        const protectedBytes = await protectPdf(bytes, password);
        name = `${base}-protected.pdf`;
        const blob = new Blob([protectedBytes], { type: "application/pdf" });
        downloadBlob(blob, name); message.textContent = ""; return;
      }
      const unlockedBytes = await unlockPdf(bytes, password);
      name = `${base}-unlocked.pdf`;
      const blob = new Blob([unlockedBytes], { type: "application/pdf" });
      downloadBlob(blob, name); message.textContent = ""; return;
    } else if (activeTool.includes("-")) {
      const bytes = await files[0].arrayBuffer();
      const base = files[0].name.replace(/\.[^.]+$/, "");
      let blob;
      if (activeTool === "pdf-word") { blob = await pdfToWord(bytes); name = `${base}.docx`; }
      if (activeTool === "word-pdf") { blob = await wordToPdf(bytes, base); name = `${base}.pdf`; }
      if (activeTool === "pdf-powerpoint") { blob = await pdfToPowerPoint(bytes); name = `${base}.pptx`; }
      if (activeTool === "powerpoint-pdf") { blob = await powerPointToPdf(bytes, base); name = `${base}.pdf`; }
      if (activeTool === "pdf-excel") { blob = await pdfToExcel(bytes); name = `${base}.xlsx`; }
      if (activeTool === "excel-pdf") { blob = await excelToPdf(bytes, base); name = `${base}.pdf`; }
      downloadBlob(blob, name);
      message.textContent = "";
      return;
    } else if (activeTool === "merge") {
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
    await download(output, name);
    message.textContent = "";
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
$("#back-button").addEventListener("click", showTools);
$("#options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-toggle-password]");
  if (!button) return;
  const field = document.getElementById(button.dataset.togglePassword);
  field.type = field.type === "password" ? "text" : "password";
  button.innerHTML = `<i data-lucide="${field.type === "password" ? "eye" : "eye-off"}"></i>`;
  button.setAttribute("aria-label", field.type === "password" ? "Show password" : "Hide password");
  createIcons({ icons: iconSet });
});
createIcons({ icons: iconSet });
