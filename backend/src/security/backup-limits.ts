import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export const MAX_BACKUP_EXPANDED_BYTES = 128 * 1024 * 1024;

export async function decompressBackupPayload(compressed: Buffer): Promise<Buffer> {
  if (!compressed.length || compressed.length > MAX_BACKUP_BYTES) throw new Error("Backup exceeds supported size limits");
  return new Promise((resolve, reject) => {
    const inflater = createGunzip();
    const input = Readable.from(compressed);
    const chunks: Buffer[] = [];
    let total = 0;
    const fail = () => { input.destroy(); inflater.destroy(); reject(new Error("Backup decompression exceeded supported limits or failed")); };
    const timer = setTimeout(fail, 15_000);
    inflater.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BACKUP_EXPANDED_BYTES) { fail(); return; }
      chunks.push(chunk);
    });
    inflater.once("error", fail);
    inflater.once("close", () => clearTimeout(timer));
    inflater.once("end", () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
    input.pipe(inflater);
  });
}

export function validateBackupStructure(snapshot: unknown): void {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("Invalid backup structure");
  const { meta, data } = snapshot as { meta?: unknown; data?: unknown };
  if (!meta || typeof meta !== "object" || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid backup structure: missing metadata or data section");
  let records = 0;
  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) throw new Error("Invalid backup data section");
    records += value.length;
    if (records > 250_000 || value.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Backup record limit or structure is invalid");
  }
}
