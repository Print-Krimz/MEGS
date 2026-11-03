import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadCsv, toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks, and doubles inner quotes", () => {
    const csv = toCsv(["Candidate", "Note"], [["Doe, Jane", 'Said "yes"\nthen left']]);
    expect(csv).toBe('Candidate,Note\r\n"Doe, Jane","Said ""yes""\nthen left"');
  });

  it("writes numbers as they are and empty cells for null", () => {
    expect(toCsv(["Days", "Rate", "Note"], [[-3, 0.5, null]])).toBe("Days,Rate,Note\r\n-3,0.5,");
  });

  it("stops a text cell from running as a formula", () => {
    expect(toCsv(["a"], [["=SUM(A1)"], ["+1"], ["-2"], ["@cmd"], ["\tTab"]])).toBe("a\r\n'=SUM(A1)\r\n'+1\r\n'-2\r\n'@cmd\r\n'\tTab");
  });

  it("guards a leading carriage return and quotes the cell", () => {
    expect(toCsv(["a"], [["\rCR"]])).toBe('a\r\n"\'\rCR"');
  });

  it("guards header cells the same way", () => {
    expect(toCsv(["=Total"], [])).toBe("'=Total");
  });
});

describe("downloadCsv", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves a BOM-prefixed .csv file under the given name", async () => {
    let saved: Blob | undefined;
    let savedAs = "";
    URL.createObjectURL = vi.fn((blob: Blob) => {
      saved = blob;
      return "blob:csv";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      savedAs = this.download;
    });

    downloadCsv("Starts", "a,b\r\n1,2");
    expect(savedAs).toBe("Starts.csv");
    expect(saved?.type).toBe("text/csv;charset=utf-8");
    const bytes = await new Promise<Uint8Array>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(saved as Blob);
    });
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe("a,b\r\n1,2");
  });
});
