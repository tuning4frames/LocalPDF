import { decryptPDF, isEncrypted } from "@pdfsmaller/pdf-decrypt";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt-lite";

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
