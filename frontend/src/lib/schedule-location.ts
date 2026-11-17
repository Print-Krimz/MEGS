const LAST_LOCATION_KEY = "megs_ta_last_interview_location";

export function getRememberedInterviewLocation(): string {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "";
    return window.localStorage.getItem(LAST_LOCATION_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberInterviewLocation(location: string): void {
  const trimmed = location.trim();
  if (!trimmed) return;
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(LAST_LOCATION_KEY, trimmed);
  } catch {
    // Ignore storage errors in restricted/private environments.
  }
}
