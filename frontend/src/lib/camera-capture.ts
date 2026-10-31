const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const SHRINK_MAX_EDGE = 2000;

// Phone photos are often 3-8 MB. Scale big images down to JPEG so they pass the 5 MB limit and upload fast.
// Falls back to the original file if the browser cannot decode or encode it.
export const shrinkImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/") || file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, SHRINK_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
};

// Camera buttons show only on touch devices; desktop keeps the single upload button.
export const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
