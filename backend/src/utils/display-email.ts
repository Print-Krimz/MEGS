import { isSyntheticEmail } from "./sms.js";

/** Email to show people: null for placeholder addresses MEGS made up (phone sign-ups, walk-ins). */
export const displayEmail = (email: string | null | undefined): string | null => {
  if (!email || isSyntheticEmail(email)) return null;
  return email;
};
