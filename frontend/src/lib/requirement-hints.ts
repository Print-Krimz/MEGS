/**
 * Early warnings on the request and job forms for requirements the match score can't use.
 * The backend decides for scoring (assessRequirementClarity in
 * backend/src/services/scoring/scoring.dimensions.ts); keep these lists in step with it.
 */
import { useEffect, useState } from "react";

type PlaceNameCheck = (name: string) => boolean;

// The place list is large, so it loads on first use and one load is shared by every form.
let placeNameCheck: PlaceNameCheck | undefined;
let placeNameLoad: Promise<void> | undefined;

const loadPlaceNameCheck = (): Promise<void> => {
  placeNameLoad ??= import("./ph-address")
    .then((module) => {
      placeNameCheck = module.isKnownPlaceName;
    })
    .catch(() => {
      placeNameLoad = undefined; // the warning stays off; the next form to open tries again
    });
  return placeNameLoad;
};

/** The place-name check once its data has loaded, undefined until then. Pass enabled=false to skip loading. */
export const useKnownPlaceName = (enabled = true): PlaceNameCheck | undefined => {
  const [check, setCheck] = useState<PlaceNameCheck | undefined>(() => placeNameCheck);
  useEffect(() => {
    if (!enabled || check) return;
    let active = true;
    void loadPlaceNameCheck().then(() => {
      if (active && placeNameCheck) setCheck(() => placeNameCheck);
    });
    return () => {
      active = false;
    };
  }, [enabled, check]);
  return check;
};

// Personal qualities, English and Filipino. Useful to know, but not job skills.
const TRAIT_WORDS = new Set([
  "honest", "hardworking", "hard", "working", "responsible", "respectful", "kind", "patient", "reliable", "punctual",
  "trustworthy", "polite", "friendly", "courteous", "diligent", "dedicated", "loyal", "motivated", "flexible",
  "team", "player", "positive", "attitude", "disciplined", "obedient", "cheerful", "approachable", "willing",
  "pleasing", "personality", "honesty", "integrity", "initiative", "self", "starter", "neat",
  "mabait", "masipag", "matiyaga", "magalang", "tapat", "responsable", "maaasahan", "maagap", "masunurin",
  "and", "with", "a", "an", "of", "to", "must", "be", "is", "good", "very", "na", "ng", "sa", "at",
]);

const ANYWHERE = new Set(["philippines", "nationwide", "anywhere", "any", "various", "various locations"]);

const isTraitItem = (item: string) => {
  const words = item.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.length > 0 && words.every((word) => TRAIT_WORDS.has(word));
};

/** True when at least half of the listed skills are personal qualities ("Mabait, Respectful"). */
export const skillsLookLikeTraits = (skillsText: string): boolean => {
  const items = skillsText.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
  if (!items.length) return false;
  return items.filter(isTraitItem).length * 2 >= items.length;
};

/**
 * True when a location is filled in but names no city, municipality or province (e.g. a street).
 * Without isKnownPlaceName (data not loaded yet) it can't tell, so it returns false.
 */
export const locationLooksUnclear = (location: string, isKnownPlaceName?: PlaceNameCheck): boolean => {
  const value = location.trim();
  if (!isKnownPlaceName || !value || ANYWHERE.has(value.toLowerCase())) return false;
  return !value.split(/[,/;|]/).some((part) => isKnownPlaceName(part.trim()));
};

export const SKILLS_HINT = "Job skills or tasks, for example forklift operation, inventory counting. Put personal qualities in the description.";
export const SKILLS_TRAITS_WARNING = "These look like personal qualities, not job skills. The match score can't use them.";
export const LOCATION_HINT = "City or municipality and province, for example Antipolo City, Rizal.";
export const LOCATION_UNCLEAR_WARNING = "This doesn't name a city or province, so the match score will leave location out.";

/** "City, Province" for a client, never the street (a street can't be matched to candidates). */
export const clientWorkLocation = (client: { city?: string | null; province?: string | null }): string =>
  [client.city, client.province].filter(Boolean).join(", ");
