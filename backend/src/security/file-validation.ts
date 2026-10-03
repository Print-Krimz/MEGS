import { inflateRawSync } from "node:zlib";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
export const MAX_EXTRACTED_TEXT = 200_000;

export type ValidatedDocument = { mimeType: string; extension: string };

function checkDimensions(width: number, height: number): void {
  if (!width || !height || width * height > 40_000_000) throw new Error("Image dimensions exceed supported limits");
}

function validatePng(buffer: Buffer): void {
  if (buffer.length < 45 || buffer.readUInt32BE(8) !== 13) throw new Error("Truncated PNG image");
  checkDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
  let offset = 8; let imageData = false; let complete = false;
  while (offset + 12 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (offset + size + 12 > buffer.length) throw new Error("Truncated PNG chunk");
    if (type === "IDAT" && size) imageData = true;
    offset += size + 12;
    if (type === "IEND") { complete = size === 0 && offset === buffer.length; break; }
  }
  if (!complete || !imageData) throw new Error("Incomplete PNG image");
}

function validateJpeg(buffer: Buffer): void {
  let offset = 2; let dimensions = false; let scan = false;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error("Invalid JPEG marker");
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++]!;
    if (marker === 0xd9) break;
    if (marker >= 0xd0 && marker <= 0xd7 || marker === 0x01) continue;
    if (offset + 2 > buffer.length) throw new Error("Truncated JPEG image");
    const size = buffer.readUInt16BE(offset);
    if (size < 2 || offset + size > buffer.length) throw new Error("Truncated JPEG segment");
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      if (size < 8) throw new Error("Invalid JPEG frame");
      checkDimensions(buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3)); dimensions = true;
    }
    if (marker === 0xda) { scan = offset + size < buffer.length - 2; break; }
    offset += size;
  }
  if (!dimensions || !scan) throw new Error("Incomplete JPEG image");
}

function validateWebp(buffer: Buffer, allowAnimation = true): void {
  let offset = 12; let image = false; let frames = 0;
  while (offset + 8 <= buffer.length) {
    const kind = buffer.subarray(offset, offset + 4).toString("ascii");
    const size = buffer.readUInt32LE(offset + 4); const data = offset + 8;
    if (data + size + (size % 2) > buffer.length) throw new Error("Truncated WEBP image");
    if (kind === "VP8L") {
      if (size < 5 || buffer[data] !== 0x2f) throw new Error("Invalid WEBP lossless image");
      const bits = buffer.readUInt32LE(data + 1); checkDimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); image = true;
    } else if (kind === "VP8 ") {
      if (size < 10 || !buffer.subarray(data + 3, data + 6).equals(Buffer.from([0x9d,0x01,0x2a]))) throw new Error("Invalid WEBP image");
      checkDimensions(buffer.readUInt16LE(data + 6) & 0x3fff, buffer.readUInt16LE(data + 8) & 0x3fff); image = true;
    } else if (kind === "VP8X") {
      if (size !== 10) throw new Error("Invalid WEBP extended header");
      checkDimensions(buffer.readUIntLE(data + 4, 3) + 1, buffer.readUIntLE(data + 7, 3) + 1);
    } else if (kind === "ANMF") {
      if (!allowAnimation || size < 24 || ++frames > 100) throw new Error("WEBP animation exceeds supported limits");
      checkDimensions(buffer.readUIntLE(data + 6, 3) + 1, buffer.readUIntLE(data + 9, 3) + 1);
      validateWebp(Buffer.concat([Buffer.alloc(12), buffer.subarray(data + 16, data + size)]), false);
      image = true;
    }
    offset = data + size + (size % 2);
  }
  if (offset !== buffer.length || !image) throw new Error("Incomplete WEBP image");
}

// Inspect and actually inflate each entry within a bound before a Word parser sees it.
// ZIP64, encryption and uncommon compression are unnecessary for supported DOCX files.
export function validateDocxArchive(buffer: Buffer): void {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) {
      end = i; break;
    }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error("Invalid DOCX archive");
  const entries = buffer.readUInt16LE(end + 10);
  const centralSize = buffer.readUInt32LE(end + 12);
  let offset = buffer.readUInt32LE(end + 16);
  const centralEnd = offset + centralSize;
  if (!entries || entries > 512 || centralEnd !== end || buffer.readUInt16LE(end + 8) !== entries) throw new Error("DOCX archive exceeds supported limits");
  let expanded = 0;
  const names = new Set<string>();
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > centralEnd || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid DOCX archive directory");
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameSize = buffer.readUInt16LE(offset + 28);
    const extraSize = buffer.readUInt16LE(offset + 30);
    const commentSize = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    if (offset + 46 + nameSize + extraSize + commentSize > centralEnd || flags & 1 || ![0, 8].includes(method) || uncompressedSize > 8 * 1024 * 1024) throw new Error("Unsupported or oversized DOCX entry");
    const name = buffer.subarray(offset + 46, offset + 46 + nameSize).toString("utf8");
    if (!name || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..") || name.includes("\0") || names.has(name)) throw new Error("Invalid DOCX entry path");
    names.add(name);
    if (local + 30 > offset || buffer.readUInt32LE(local) !== 0x04034b50 || buffer.readUInt16LE(local + 8) !== method || buffer.readUInt16LE(local + 6) !== flags) throw new Error("Invalid DOCX entry header");
    const localNameSize = buffer.readUInt16LE(local + 26);
    const dataStart = local + 30 + localNameSize + buffer.readUInt16LE(local + 28);
    if (dataStart + compressedSize > buffer.readUInt32LE(end + 16) || buffer.subarray(local + 30, local + 30 + localNameSize).toString("utf8") !== name) throw new Error("Invalid DOCX entry bounds");
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const actual = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.min(8 * 1024 * 1024, MAX_ARCHIVE_BYTES - expanded) });
    if (actual.length !== uncompressedSize || actual.length > 8 * 1024 * 1024) throw new Error("Invalid DOCX expanded size");
    expanded += actual.length;
    if (expanded >= MAX_ARCHIVE_BYTES) throw new Error("DOCX archive expansion limit exceeded");
    offset += 46 + nameSize + extraSize + commentSize;
  }
  if (offset !== centralEnd || !names.has("[Content_Types].xml") || !names.has("word/document.xml")) throw new Error("ZIP file is not a Word document");
}

export function validateDocumentBytes(buffer: Buffer, declaredMime?: string): ValidatedDocument {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_DOCUMENT_BYTES) throw new Error("Document exceeds supported size limits");
  let document: ValidatedDocument | undefined;
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-" && buffer.subarray(Math.max(0, buffer.length - 1024)).includes(Buffer.from("%%EOF"))) document = { mimeType: "application/pdf", extension: "pdf" };
  else if (buffer.length > 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.subarray(12, 16).toString("ascii") === "IHDR") {
    validatePng(buffer);
    document = { mimeType: "image/png", extension: "png" };
  } else if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9) { validateJpeg(buffer); document = { mimeType: "image/jpeg", extension: "jpg" }; }
  else if (buffer.length >= 20 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP" && buffer.readUInt32LE(4) + 8 === buffer.length && ["VP8 ", "VP8L", "VP8X"].includes(buffer.subarray(12, 16).toString("ascii"))) { validateWebp(buffer); document = { mimeType: "image/webp", extension: "webp" }; }
  else if (buffer.length >= 1536 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) && buffer.includes(Buffer.from("WordDocument", "utf16le"))) {
    const version = buffer.readUInt16LE(26);
    const sectorShift = buffer.readUInt16LE(30);
    const sectorSize = 2 ** sectorShift;
    if (buffer.readUInt16LE(28) !== 0xfffe || !(version === 3 && sectorShift === 9 || version === 4 && sectorShift === 12) || buffer.readUInt16LE(32) !== 6 || buffer.length % sectorSize !== 0 || !buffer.readUInt32LE(44) || buffer.readUInt32LE(48) >= buffer.length / sectorSize - 1) throw new Error("Invalid binary Word document structure");
    document = { mimeType: "application/msword", extension: "doc" };
  }
  else if (buffer.length >= 22 && buffer.readUInt32LE(0) === 0x04034b50) {
    validateDocxArchive(buffer);
    document = { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" };
  }
  if (!document || declaredMime && declaredMime.toLowerCase().split(";")[0].trim() !== document.mimeType) throw new Error("File contents do not match a supported document type");
  return document;
}
