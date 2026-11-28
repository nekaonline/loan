import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function isAllowedUpload(mimeType: string): boolean {
  return mimeType in EXTENSIONS;
}

export function makeStoredName(mimeType: string, originalName: string): string {
  const extension = EXTENSIONS[mimeType] || path.extname(originalName).slice(0, 10);
  return `${randomUUID()}${extension}`;
}

export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export function safeUploadPath(storedName: string): string {
  // Stored names are generated server-side, but validate anyway.
  if (!/^[a-zA-Z0-9._-]+$/.test(storedName)) {
    throw new Error("نام فایل ناامن است");
  }
  return path.join(UPLOAD_DIR, storedName);
}
