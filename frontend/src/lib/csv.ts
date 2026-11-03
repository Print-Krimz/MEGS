/** Cells that start with these characters would run as a formula in Excel or Sheets. */
const FORMULA_START = /^[=+\-@\t\r]/;

const cell = (value: string | number | null): string => {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  // A leading apostrophe makes the spreadsheet show the text instead of running it.
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** RFC 4180 CSV: quoted where needed, CRLF line ends, and no formula from a text cell. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers, ...rows].map((line) => line.map(cell).join(",")).join("\r\n");
}

/** Saves CSV text as a file. The BOM tells Excel to read accented names as UTF-8. */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
