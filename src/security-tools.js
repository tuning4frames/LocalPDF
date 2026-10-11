import { decryptPDF, isEncrypted } from "@pdfsmaller/pdf-decrypt";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt-lite";
import { PDFDocument, PDFName } from "pdf-lib";

export async function protectPdf(bytes, password) {
  if (!password) throw new Error("Enter a password.");
  if (password.length < 4) throw new Error("Use a password with at least 4 characters.");
  return encryptPDF(new Uint8Array(bytes), password);
}

export async function unlockPdf(bytes, password) {
  if (!password) throw new Error("Enter the PDF password.");
  const source = new Uint8Array(bytes);
  const info = await isEncrypted(source);
  if (!info.encrypted) throw new Error("This PDF is not password-protected.");
  return decryptPDF(source, password);
}

export async function flattenPdf(bytes) {
  const pdf = await PDFDocument.load(bytes);
  pdf.getPages().forEach((page) => {
    const node = page.node;
    if (node.Annots()) node.delete(PDFName.of("Annots"));
  });
  return pdf;
}

export async function getPdfMetadata(bytes) {
  const pdf = await PDFDocument.load(bytes, { throwOnInvalidObject: false });
  const safe = (value) => value ?? "";
  const title = safe(await pdf.getTitle());
  const author = safe(await pdf.getAuthor());
  const subject = safe(await pdf.getSubject());
  const keywords = await pdf.getKeywords();
  const creator = safe(await pdf.getCreator());
  const producer = safe(await pdf.getProducer());
  return {
    pageCount: pdf.getPageCount(),
    title,
    author,
    subject,
    keywords: (Array.isArray(keywords) ? keywords : String(safe(keywords)).split(/,\s*|\s+/)).filter(Boolean).join(", "),
    creator,
    producer
  };
}

export async function setPdfMetadata(bytes, { title, author, subject, keywords, creator }) {
  const pdf = await PDFDocument.load(bytes);
  if (title !== undefined) pdf.setTitle(String(title ?? ""));
  if (author !== undefined) pdf.setAuthor(String(author ?? ""));
  if (subject !== undefined) pdf.setSubject(String(subject ?? ""));
  if (keywords !== undefined) pdf.setKeywords(String(keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean));
  if (creator !== undefined) pdf.setCreator(String(creator ?? ""));
  pdf.setModificationDate(new Date());
  return pdf;
}
