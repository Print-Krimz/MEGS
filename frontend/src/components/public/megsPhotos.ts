/**
 * Real MEGS photographs for the landing page.
 *
 * Drop a file into `src/assets/megs/` using one of the slot names below (any of
 * .jpg, .jpeg, .png, .webp) and it appears on the page on the next build. A slot
 * with no file renders nothing, so the page never shows an empty frame.
 * See `src/assets/megs/README.md` for the shot list.
 */
const files = import.meta.glob<string>("../../assets/megs/*.{jpg,jpeg,png,webp}", {
  eager: true,
  import: "default",
  query: "?url",
});

const byName = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const name = path.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase();
  byName.set(name, url);
}

export interface MegsPhoto {
  src: string;
  alt: string;
}

const SLOT_ALT: Record<string, string> = {
  hero: "MEGS deployed personnel at a client site",
  office: "MEGS central office on P. Gomez Street, Valenzuela City",
  "step-request": "MEGS staff meeting with a client about a manpower request",
  "step-screening": "Applicants taking a screening test at MEGS",
  "step-contract": "New hires signing their MEGS employment contracts",
  "step-deployment": "MEGS service coordinator briefing workers on site",
  "industry-manufacturing": "MEGS personnel on a manufacturing line",
  "industry-logistics": "MEGS delivery personnel loading a truck",
  "industry-warehousing": "MEGS warehouse crew handling inventory",
  "industry-retail": "MEGS merchandiser at a retail store",
  "industry-hospitality": "MEGS food service crew",
  "industry-gaming": "MEGS personnel at a gaming facility",
};

/** Returns the photo for a named slot, or null when no file has been added. */
export const megsPhoto = (slot: string): MegsPhoto | null => {
  const src = byName.get(slot);
  return src ? { src, alt: SLOT_ALT[slot] ?? "" } : null;
};

/**
 * Event and activity photos: any file named `activity-<anything>`. The part after
 * `activity-` becomes the caption, so `activity-2025-job-fair.jpg` reads "2025 job fair".
 */
export const megsActivityPhotos = (): (MegsPhoto & { caption: string })[] =>
  [...byName.entries()]
    .filter(([name]) => name.startsWith("activity-"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, src]) => {
      const words = name.slice("activity-".length).replace(/[-_]+/g, " ").trim();
      const caption = words.charAt(0).toUpperCase() + words.slice(1);
      return { src, alt: caption, caption };
    });
