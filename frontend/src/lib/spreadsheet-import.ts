// Shared by the "Add clients / MRFs from files" dialogs for the Excel template.
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const isXlsxFile = (file: File) => file.type === XLSX_MIME || /\.xlsx$/i.test(file.name);

/** Where a row came from: a whole file, or one row of an Excel file. */
export interface BatchSource {
  fileName: string;
  rowNumber?: number;
}

export const sourceLabel = (source: BatchSource) =>
  source.rowNumber === undefined ? source.fileName : `${source.fileName} · row ${source.rowNumber}`;

/** Files used so far. Every row of one Excel file counts as that one file. */
export const batchFileCount = (rows: Array<{ source: BatchSource }>) =>
  new Set(rows.map((row, index) => (row.source.rowNumber === undefined ? `#${index}` : row.source.fileName))).size;

export const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
