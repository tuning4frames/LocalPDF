import {
  addPdfImage,
  addPdfPageNumbers,
  addPdfText,
  addPdfWatermark,
  cropPdfPages,
  imagesToPdf,
  intervalGroups,
  mergePdfs,
  nUpPdf,
  optimizePdf,
  parsePages,
  parseSplitRanges,
  repairPdf,
  rotatePdfPages,
  savePdf,
  selectPdfPages,
  splitPdf
} from "./pdf-tools.js";
import { downloadBlob, excelToPdf, extractPdfPages, pdfToExcel, pdfToPowerPoint, pdfToWord, powerPointToPdf, wordToPdf } from "./office-tools.js";
import { flattenPdf, getPdfMetadata, protectPdf, setPdfMetadata, unlockPdf } from "./security-tools.js";
import { comparePdfTexts, compressPdfRender, htmlToPdf, pdfToImages, zipFiles } from "./render-tools.js";
import { blankCanvas, attachDrawEvents, canvasHasInk, canvasToPngBytes, clearCanvas, renderTypedSignature, stampSignature } from "./sign-tools.js";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Circle, createIcons, Crop, Download, Eraser, Eye, EyeOff, FileCheck2, FileCode2, FileImage, FileMinus2, FileSearch, FileSignature, FileText, FileType2, Grid2x2, Images, Layers, ListOrdered, ListRestart, LockKeyhole, LockKeyholeOpen, Minimize2, MoveHorizontal, PenLine, Plus, Presentation, RotateCw, Scale, Sheet, SquareSplitHorizontal, SquaresUnite, Stamp, Tag, Type, Upload, Wrench, X } from "lucide";

const iconSet = { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Circle, Crop, Download, Eraser, Eye, EyeOff, FileCheck2, FileCode2, FileImage, FileMinus2, FileSearch, FileSignature, FileText, FileType2, Grid2x2, Images, Layers, ListOrdered, ListRestart, LockKeyhole, LockKeyholeOpen, Minimize2, MoveHorizontal, PenLine, Plus, Presentation, RotateCw, Scale, Sheet, SquareSplitHorizontal, SquaresUnite, Stamp, Tag, Type, Upload, Wrench, X };
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
  ,"pdf-images": { title: "PDF to Images", description: "Render every page as a PNG or JPG image and download them together in a ZIP.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Convert and download" }
  ,"split-modes": { title: "Split PDF (multi-file)", description: "Split a PDF into several files by page ranges, fixed intervals, or one file per page.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Split and download" }
  ,"compress-real": { title: "Compress PDF", description: "Shrink PDFs by re-rendering pages as compressed images. Quality presets trade file size for fidelity.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Compress and download" }
  ,sign: { title: "Sign PDF", description: "Draw your signature with mouse or finger, or type your name, then stamp it on the page.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Sign and download" }
  ,stamp: { title: "Add Text & Image", description: "Stamp custom text or a PNG/JPG image onto pages, with position and size controls.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Add and download" }
  ,compare: { title: "Compare PDFs", description: "Compare the text of two PDFs page by page and highlight added and removed lines.", accept: "application/pdf,.pdf", multiple: true, drop: "Drop two PDFs here", hint: "exactly two files - click to choose", action: "Compare PDFs" }
  ,view: { title: "View PDF", description: "Open and read a PDF right here. Nothing is uploaded because there is nothing to upload to.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Open viewer" }
  ,"html-pdf": { title: "HTML to PDF", description: "Paste HTML or open an HTML file and convert its readable text into a PDF.", accept: ".html,.htm,text/html", multiple: false, drop: "Drop an HTML file here", hint: "or paste HTML below", action: "Convert to PDF" }
  ,flatten: { title: "Flatten PDF", description: "Remove form fields and annotations so their appearance is baked into page content.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Flatten and download" }
  ,metadata: { title: "Edit Metadata", description: "Read and rewrite a PDF's title, author, subject, and keywords.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Save and download" }
  ,"extract-text": { title: "PDF to Text", description: "Extract all text into a plain .txt file, one line per page, page markers included.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Extract and download" }
  ,nup: { title: "N-up PDF", description: "Place 2, 4, 6, or 9 pages on one sheet for handouts and print-friendly layouts.", accept: "application/pdf,.pdf", multiple: false, drop: "Drop a PDF here", hint: "or click to choose a file", action: "Rearrange and download" }
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

async function renderOptions() {
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
  } else if (activeTool === "pdf-images" && files.length) {
    options.innerHTML = `<div class="settings-card"><label><span>Format</span><select id="img-format"><option value="png" selected>PNG (lossless)</option><option value="jpeg">JPG (smaller)</option></select></label><label><span>Resolution</span><select id="img-dpi"><option value="96">96 DPI (screen)</option><option value="150" selected>150 DPI (standard)</option><option value="300">300 DPI (print)</option></select></label></div>`;
  } else if (activeTool === "split-modes" && files.length) {
    options.innerHTML = `<div class="settings-card split-settings"><label><span>Split mode</span><select id="split-mode"><option value="ranges" selected>Page ranges (one file per range)</option><option value="interval">Every N pages</option><option value="all">One file per page</option></select></label><label id="ranges-field"><span>Ranges</span><input id="split-ranges" type="text" placeholder="Example: 1-3, 4-6, 7" /></label><label id="interval-field" hidden><span>Pages per file</span><input id="split-size" type="number" min="1" value="2" /></label></div><p class="split-note">Each range becomes its own PDF; overlapping or missing pages are allowed.</p>`;
    $("#split-mode").addEventListener("change", () => {
      const mode = $("#split-mode").value;
      $("#ranges-field").hidden = mode !== "ranges";
      $("#interval-field").hidden = mode !== "interval";
    });
  } else if (activeTool === "compress-real" && files.length) {
    options.innerHTML = `<div class="settings-card"><label><span>Compression level</span><select id="compress-level"><option value="low">High quality (larger)</option><option value="medium" selected>Balanced</option><option value="high">Strong (smaller)</option></select></label></div><div class="notice"><strong>Rasterized compression</strong><p>Pages become compressed images. Text stops being selectable, and fine detail may soften at stronger levels.</p></div>`;
  } else if (activeTool === "sign" && files.length) {
    options.innerHTML = `<div class="sign-card"><label><span>Signature</span><div class="sign-tabs"><button type="button" class="sign-tab active" data-sign-tab="draw">Draw</button><button type="button" class="sign-tab" data-sign-tab="type">Type</button></div></label><div id="sign-draw" class="sign-draw"><canvas id="sign-canvas"></canvas><button type="button" id="sign-clear" class="add-more">Clear</button></div><div id="sign-type" hidden><label><span>Name</span><input id="sign-name" type="text" placeholder="Your name" /></label></div><div class="settings-card sign-placement"><label><span>Page</span><input id="sign-page" type="number" min="1" value="1" /></label><label><span>Position</span><select id="sign-position"><option value="bottom-right" selected>Bottom right</option><option value="bottom-left">Bottom left</option><option value="top-right">Top right</option><option value="top-left">Top left</option></select></label><label><span>Size</span><select id="sign-size"><option value="18">Small</option><option value="25" selected>Medium</option><option value="35">Large</option></select></label></div></div>`;
    const canvas = blankCanvas();
    canvas.id = "sign-canvas";
    $("#sign-draw").querySelector("#sign-canvas")?.replaceWith(canvas);
    attachDrawEvents(canvas, () => {});
    $("#sign-clear").addEventListener("click", () => clearCanvas(canvas));
    options.querySelectorAll("[data-sign-tab]").forEach((tab) => tab.addEventListener("click", () => {
      options.querySelectorAll("[data-sign-tab]").forEach((other) => other.classList.remove("active"));
      tab.classList.add("active");
      const mode = tab.dataset.signTab;
      $("#sign-draw").hidden = mode !== "draw";
      $("#sign-type").hidden = mode !== "type";
    }));
  } else if (activeTool === "stamp" && files.length) {
    options.innerHTML = `<div class="stamp-card"><div class="stamp-tabs"><button type="button" class="sign-tab active" data-stamp-tab="text">Text</button><button type="button" class="sign-tab" data-stamp-tab="image">Image</button></div><div id="stamp-text"><div class="settings-card stamp-settings"><label><span>Text</span><input id="stamp-text-input" type="text" placeholder="APPROVED" /></label><label><span>Pages</span><input id="stamp-pages" type="text" placeholder="All pages or 1-3, 6" /></label><label><span>Position</span><select id="stamp-position"><option value="bottom-center" selected>Bottom center</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option><option value="top-center">Top center</option><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="middle-center">Middle</option></select></label><label><span>Size</span><select id="stamp-size"><option value="12">12 pt</option><option value="20" selected>20 pt</option><option value="32">32 pt</option></select></label><label><span>Color</span><select id="stamp-color"><option value="ink" selected>Ink</option><option value="red">Red</option><option value="blue">Blue</option><option value="gray">Gray</option><option value="white">White</option></select></label></div></div><div id="stamp-image" hidden><div class="settings-card stamp-settings"><label><span>Image</span><input id="stamp-image-file" type="file" accept="image/png,image/jpeg" /></label><label><span>Pages</span><input id="stamp-image-pages" type="text" placeholder="All pages or 1-3, 6" /></label><label><span>Position</span><select id="stamp-image-position"><option value="bottom-right" selected>Bottom right</option><option value="bottom-left">Bottom left</option><option value="bottom-center">Bottom center</option><option value="top-right">Top right</option><option value="top-left">Top left</option><option value="top-center">Top center</option><option value="middle-center">Middle</option></select></label><label><span>Width</span><select id="stamp-image-width"><option value="15">15%</option><option value="25" selected>25%</option><option value="40">40%</option><option value="60">60%</option></select></label></div></div></div>`;
    options.querySelectorAll("[data-stamp-tab]").forEach((tab) => tab.addEventListener("click", () => {
      options.querySelectorAll("[data-stamp-tab]").forEach((other) => other.classList.remove("active"));
      tab.classList.add("active");
      const mode = tab.dataset.stampTab;
      $("#stamp-text").hidden = mode !== "text";
      $("#stamp-image").hidden = mode !== "image";
    }));
  } else if (activeTool === "compare" && files.length === 2) {
    options.innerHTML = `<div class="notice"><strong>Ready to compare</strong><p>Text will be extracted from both documents and compared page by page. Differences appear below after the run.</p></div>`;
  } else if (activeTool === "html-pdf" && files.length) {
    options.innerHTML = `<div class="html-card"><label for="html-source"><span>HTML source</span><small>Loaded from the file above, or paste your own markup.</small></label><textarea id="html-source" rows="10" placeholder="<h1>Hello</h1>\n<p>Some text</p>"></textarea></div>`;
    const reader = new FileReader();
    reader.onload = () => { $("#html-source").value = reader.result; };
    reader.readAsText(files[0]);
  } else if (activeTool === "view") {
    options.innerHTML = "";
  } else if (activeTool === "flatten" && files.length) {
    options.innerHTML = `<div class="notice"><strong>Flatten forms and annotations</strong><p>Form field values and annotation appearances are merged into page content; fields become non-editable.</p></div>`;
  } else if (activeTool === "metadata" && files.length) {
    options.innerHTML = `<div class="settings-card metadata-card"><label><span>Title</span><input id="meta-title" type="text" /></label><label><span>Author</span><input id="meta-author" type="text" /></label><label><span>Subject</span><input id="meta-subject" type="text" /></label><label><span>Keywords</span><input id="meta-keywords" type="text" placeholder="comma, separated" /></label><label><span>Pages</span><input id="meta-pages" disabled value="" /></label></div>`;
    getPdfMetadata(await files[0].arrayBuffer()).then((meta) => {
      $("#meta-title").value = meta.title;
      $("#meta-author").value = meta.author;
      $("#meta-subject").value = meta.subject;
      $("#meta-keywords").value = meta.keywords;
      $("#meta-pages").value = `${meta.pageCount} pages`;
    }).catch(() => {});
  } else if (activeTool === "nup" && files.length) {
    options.innerHTML = `<div class="settings-card nup-settings"><label><span>Pages per sheet</span><select id="nup-count"><option value="2">2 (two columns)</option><option value="4" selected>4 (2 × 2 grid)</option><option value="6">6 (2 × 3 grid)</option><option value="9">9 (3 × 3 grid)</option></select></label><label><span>Sheet orientation</span><select id="nup-orientation"><option value="auto" selected>Automatic</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><label><span>Cut borders</span><select id="nup-border"><option value="no" selected>No borders</option><option value="yes">Thin borders</option></select></label></div>`;
  } else options.innerHTML = "";
}

async function renderFiles() {
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
  const ready = files.length >= (activeTool === "merge" || activeTool === "compare" ? 2 : 1);
  $("#process-button").disabled = !ready;
  await renderOptions();
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

async function addFiles(incoming) {
  const config = tools[activeTool];
  const valid = [...incoming].filter((file) => {
    if (config.accept.split(",").includes(file.type)) return true;
    const extensions = config.accept.split(",").filter((entry) => entry.startsWith("."));
    if (extensions.some((extension) => file.name.toLowerCase().endsWith(extension))) return true;
    if (config.accept.includes("application/pdf")) return /\.pdf$/i.test(file.name);
    return config.accept.includes("image/") && /\.(jpe?g|png)$/i.test(file.name);
  });
  files = config.multiple ? [...files, ...valid] : valid.slice(0, 1);
  if (activeTool === "compare") files = files.slice(-2);
  message.textContent = valid.length ? "" : "That file type is not supported by this tool.";
  await renderFiles();
}

async function selectTool(name) {
  activeTool = name; files = []; message.textContent = "";
  const config = tools[name];
  $("#tool-title").textContent = config.title;
  $("#tool-description").textContent = config.description;
  $("#drop-title").textContent = config.drop;
  $("#drop-hint").textContent = config.hint;
  $("#process-label").textContent = config.action;
  input.accept = config.accept; input.multiple = config.multiple; input.value = "";
  dropzone.hidden = false; await renderFiles();
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

async function showTools() {
  files = [];
  input.value = "";
  message.textContent = "";
  await renderFiles();
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

let viewerHandle = null;
async function openViewer(bytes) {
  const { renderPdfToViewer } = await import("./sign-tools.js");
  const target = $("#options");
  if (viewerHandle) { viewerHandle.destroy?.(); viewerHandle = null; }
  target.innerHTML = `<div class="viewer-wrap" id="viewer-root"><div class="viewer-bar"><button type="button" id="viewer-prev">‹</button><span id="viewer-label"></span><button type="button" id="viewer-next">›</button></div><canvas id="viewer-canvas"></canvas></div>`;
  const canvas = $("#viewer-canvas");
  let pageNumber = 1;
  viewerHandle = await renderPdfToViewer(bytes, canvas, { scale: 1.4 });
  const label = () => { $("#viewer-label").textContent = `${pageNumber} / ${viewerHandle.pageCount}`; };
  const show = async () => { message.textContent = ""; await viewerHandle.render(pageNumber); label(); };
  $("#viewer-prev").addEventListener("click", () => { if (pageNumber > 1) { pageNumber -= 1; show(); } });
  $("#viewer-next").addEventListener("click", () => { if (pageNumber < viewerHandle.pageCount) { pageNumber += 1; show(); } });
  await show();
}

function renderDiff(diff) {
  const rows = diff.filter((row) => row.type !== "same").slice(0, 400);
  const same = diff.filter((row) => row.type === "same").length;
  const added = diff.filter((row) => row.type === "added").length;
  const removed = diff.filter((row) => row.type === "removed").length;
  const escapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
  const esc = (s) => s.replace(/[&<>]/g, (c) => escapes[c]);
  $("#options").innerHTML = `<div class="diff-card"><div class="diff-stats"><span class="diff-added">+${added} added</span><span class="diff-removed">−${removed} removed</span><span>${same} unchanged</span></div>${rows.length ? `<div class="diff-rows">${rows.map((row) => `<div class="diff-row ${row.type}"><small>${row.type === "added" ? "added" : "removed"}</small><span>${esc(row.text)}</span></div>`).join("")}</div>` : `<p class="diff-empty">No text differences found.</p>`}</div>`;
  message.textContent = "";
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
    } else if (["pdf-images", "split-modes", "compress-real", "sign", "stamp", "compare", "view", "html-pdf", "flatten", "metadata", "extract-text", "nup"].includes(activeTool)) {
      const bytes = activeTool === "html-pdf" ? null : await files[0].arrayBuffer();
      const base = (files[0]?.name || "document").replace(/\.[^.]+$/, "");
      if (activeTool === "pdf-images") {
        const format = $("#img-format").value;
        const images = await pdfToImages(bytes, { format, dpi: Number($("#img-dpi").value), quality: 0.92 });
        const { blob, name: zipName } = await zipFiles(images, `${base}-images.zip`);
        downloadBlob(blob, zipName); message.textContent = `Rendered ${images.length} page${images.length === 1 ? "" : "s"}.`; return;
      }
      if (activeTool === "split-modes") {
        const source = await optimizePdf(bytes);
        const count = source.getPageCount();
        const mode = $("#split-mode").value;
        const groups = mode === "ranges" ? parseSplitRanges($("#split-ranges").value, count)
          : mode === "interval" ? intervalGroups(count, $("#split-size").value)
          : source.getPageIndices().map((index) => [index]);
        const parts = await splitPdf(bytes, groups);
        const entries = [];
        for (const [index, part] of parts.entries()) {
          const first = groups[index][0] + 1, last = groups[index][groups[index].length - 1] + 1;
          const label = first === last ? `page-${first}` : `pages-${first}-${last}`;
          entries.push({ name: `${base}-${label}.pdf`, bytes: await savePdf(part) });
        }
        const { blob, name: zipName } = await zipFiles(entries, `${base}-split.zip`);
        downloadBlob(blob, zipName); message.textContent = `Split into ${entries.length} file${entries.length === 1 ? "" : "s"}.`; return;
      }
      if (activeTool === "compress-real") {
        const levels = { low: { dpi: 200, quality: 0.85 }, medium: { dpi: 150, quality: 0.7 }, high: { dpi: 110, quality: 0.5 } };
        const settings = levels[$("#compress-level").value] ?? levels.medium;
        const compressed = await compressPdfRender(bytes, settings);
        const before = files[0].size, after = compressed.length;
        const blob = new Blob([compressed], { type: "application/pdf" });
        downloadBlob(blob, `${base}-compressed.pdf`);
        message.textContent = after < before ? `${formatBytes(before)} → ${formatBytes(after)} (${Math.round((1 - after / before) * 100)}% smaller)` : `Done. Output is ${formatBytes(after)} (already well optimized).`; return;
      }
      if (activeTool === "sign") {
        const tab = document.querySelector("[data-sign-tab].active")?.dataset.signTab ?? "draw";
        const name2 = $("#sign-name").value.trim();
        if (tab === "type" && !name2) throw new Error("Type your name, or draw a signature instead.");
        const canvas = tab === "draw" ? $("#sign-canvas") : renderTypedSignature(name2 || files[0].name);
        if (tab === "draw" && !canvasHasInk(canvas)) throw new Error("Draw a signature first, or switch to the Type tab.");
        const pngBytes = canvasToPngBytes(canvas);
        output = await stampSignature(bytes, { pngBytes, page: Number($("#sign-page").value), position: $("#sign-position").value, widthPercent: Number($("#sign-size").value) });
        name = `${base}-signed.pdf`;
      } else if (activeTool === "stamp") {
        const mode = document.querySelector("[data-stamp-tab].active")?.dataset.stampTab ?? "text";
        const source = await optimizePdf(bytes);
        const count = source.getPageCount();
        const rangeValue = $("#stamp-pages").value;
        const indices = rangeValue.trim() ? parsePages(rangeValue, count) : source.getPageIndices();
        if (mode === "text") {
          output = await addPdfText(bytes, { text: $("#stamp-text-input").value, indices, position: $("#stamp-position").value, size: Number($("#stamp-size").value), color: $("#stamp-color").value });
        } else {
          const imageFile = $("#stamp-image-file").files[0];
          if (!imageFile) throw new Error("Choose a PNG or JPG image first.");
          const imageRange = $("#stamp-image-pages").value;
          const imageIndices = imageRange.trim() ? parsePages(imageRange, count) : source.getPageIndices();
          output = await addPdfImage(bytes, { bytes: await imageFile.arrayBuffer(), type: imageFile.type, indices: imageIndices, position: $("#stamp-image-position").value, widthPercent: Number($("#stamp-image-width").value) });
        }
        name = `${base}-stamped.pdf`;
      } else if (activeTool === "compare") {
        if (files.length !== 2) throw new Error("Choose exactly two PDF files to compare.");
        const [aBytes, bBytes] = await Promise.all(files.map((file) => file.arrayBuffer()));
        const diff = await comparePdfTexts(aBytes, bBytes);
        renderDiff(diff); return;
      } else if (activeTool === "view") {
        await openViewer(bytes); return;
      } else if (activeTool === "html-pdf") {
        const html = $("#html-source")?.value || "";
        const blob = await htmlToPdf(html, { title: "HTML document" });
        downloadBlob(blob, `${(files[0]?.name || "document").replace(/\.[^.]+$/, "")}.pdf`); message.textContent = ""; return;
      } else if (activeTool === "flatten") {
        output = await flattenPdf(bytes);
        name = `${base}-flattened.pdf`;
      } else if (activeTool === "metadata") {
        output = await setPdfMetadata(bytes, { title: $("#meta-title").value, author: $("#meta-author").value, subject: $("#meta-subject").value, keywords: $("#meta-keywords").value });
        name = `${base}-metadata.pdf`;
      } else if (activeTool === "extract-text") {
        const pages = await extractPdfPages(bytes);
        const text = pages.map((lines, index) => `--- Page ${index + 1} ---\n${lines.join("\n")}`).join("\n\n") + "\n";
        const blob = new Blob([text], { type: "text/plain" });
        downloadBlob(blob, `${base}.txt`); message.textContent = `Extracted ${pages.length} page${pages.length === 1 ? "" : "s"} of text.`; return;
      } else if (activeTool === "nup") {
        output = await nUpPdf(bytes, {
          perSheet: Number($("#nup-count").value),
          orientation: $("#nup-orientation").value,
          addBorder: $("#nup-border").value === "yes"
        });
        name = `${base}-nup.pdf`;
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
list.addEventListener("click", async (event) => {
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
  await renderFiles();
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
