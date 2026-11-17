import type { RequirementRowData } from "../components/ta/application/RequirementRow";

const KEYWORD_RULES: Array<{ filePattern: RegExp; labelPattern: RegExp }> = [
  { filePattern: /\bnbi\b/i, labelPattern: /\bnbi\b/i },
  { filePattern: /\bpolice\b/i, labelPattern: /\b(nbi|police)\b/i },
  { filePattern: /\b(brgy|barangay)\b/i, labelPattern: /\bbarangay\b/i },
  { filePattern: /\bsss\b/i, labelPattern: /\bsss\b/i },
  { filePattern: /\b(philhealth|mdr)\b/i, labelPattern: /\bphil\s*health\b/i },
  { filePattern: /\b(pagibig|pag_ibig|pag-ibig|hdmf|mid)\b/i, labelPattern: /\b(pag-?ibig|hdmf)\b/i },
  { filePattern: /\b(bir|tin|1902|2316)\b/i, labelPattern: /\b(bir|tin)\b/i },
  { filePattern: /\b(fit[\s_-]*to[\s_-]*work|medical|med[\s_-]*cert)\b/i, labelPattern: /\b(fit[\s-]*to[\s-]*work|medical)\b/i },
  { filePattern: /\bdrug\b/i, labelPattern: /\bdrug\b/i },
  { filePattern: /\b(tor|transcript)\b/i, labelPattern: /\b(tor|transcript)\b/i },
  { filePattern: /\bdiploma\b/i, labelPattern: /\bdiploma\b/i },
  { filePattern: /\bcoe\b/i, labelPattern: /\b(coe|certificate of employment)\b/i },
  { filePattern: /\b(driver|lto)\b/i, labelPattern: /\bdriver\b/i },
  { filePattern: /\bprc\b/i, labelPattern: /\bprc\b/i },
  { filePattern: /\btesda\b/i, labelPattern: /\btesda\b/i },
  { filePattern: /\b(gov[\s_-]*id|valid[\s_-]*id|umid|passport|national[\s_-]*id)\b/i, labelPattern: /\bgovernment.*id\b/i },
  { filePattern: /\bnda\b/i, labelPattern: /\bnda\b/i },
];

export function matchFileToRequirement(
  fileName: string,
  candidates: RequirementRowData[],
  takenIds: Set<number>
): number | "" {
  const baseName = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  for (const rule of KEYWORD_RULES) {
    if (!rule.filePattern.test(baseName)) continue;
    const match = candidates.find(
      (req) => !takenIds.has(req.id) && rule.labelPattern.test(req.documentLabel)
    );
    if (match) return match.id;
  }
  return "";
}
