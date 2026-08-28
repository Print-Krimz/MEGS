/**
 * Mask an email address for privacy and security display
 * Example: juan.delacruz@gmail.com -> ju***********@gmail.com
 * Example: ab@gmail.com -> a*@gmail.com
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "";
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return trimmed;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex); // includes '@'

  if (local.length === 1) {
    return `*${domain}`;
  }
  if (local.length === 2) {
    return `${local[0]}*${domain}`;
  }
  if (local.length <= 4) {
    return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}${domain}`;
  }

  // Length > 4: Show first 2 characters, mask middle, keep domain
  const maskedLength = local.length - 2;
  return `${local.slice(0, 2)}${"*".repeat(maskedLength)}${domain}`;
}