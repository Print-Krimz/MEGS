/**
 * Helpers for reading and writing a skills list on a manpower request.
 * (The role template catalog that used to live here was removed.)
 */


/**
 * Normalizes any raw skills input (JSON string array, string with brackets/quotes, comma-delimited, etc.)
 * into a clean array of string skill names.
 * Example: '["Machinery Operation", "Preventive Maintenance"]' -> ['Machinery Operation', 'Preventive Maintenance']
 */
export function parseSkillsArray(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Check if string is a JSON array e.g. ["Skill 1", "Skill 2"]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((s) => String(s).trim())
          .filter(Boolean);
      }
    } catch {
      // Regex fallback if JSON.parse fails
      return trimmed
        .replace(/^\[\s*|\s*\]$/g, "")
        .split(",")
        .map((s) => s.replace(/^["']\s*|\s*["']$/g, "").trim())
        .filter(Boolean);
    }
  }

  // Handle standard comma-separated or newline-separated string
  return trimmed
    .split(/[,;\n]/)
    .map((s) => s.replace(/^["'\[\]]\s*|\s*["'\[\]]$/g, "").trim())
    .filter(Boolean);
}

/**
 * Normalizes any raw skills data into a clean, human-readable comma-separated string.
 * Example: '["Forklift", "5S"]' -> 'Forklift, 5S'
 */
export function formatSkillsList(raw: string | string[] | null | undefined): string {
  return parseSkillsArray(raw).join(", ");
}
