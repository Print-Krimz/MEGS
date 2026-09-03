/**
 * Utilities for Philippine phone number formatting, sanitization, and verification.
 * Strictly enforces maximum 11 digits only.
 */

/**
 * Sanitizes phone input to numeric digits only and strictly limits to 11 digits max.
 */
export function sanitizePhilippinePhone(raw: string): string {
  if (!raw) return "";

  // Strip non-digit characters
  let digits = raw.replace(/\D/g, "");

  // If user pasted/typed with country code (63), strip the 63 prefix to get local national number
  if (digits.startsWith("63") && digits.length > 10) {
    digits = digits.slice(2);
  }

  // Strictly limit to 11 digits max (or 10 digits if starting with 9 after +63)
  if (digits.startsWith("0")) {
    return digits.slice(0, 11);
  }
  if (digits.startsWith("9")) {
    return digits.slice(0, 10);
  }
  return digits.slice(0, 11);
}

/**
 * Formats sanitized phone digits with spacing for human readability.
 * Example:
 *  "09171234567" -> "0917 123 4567"
 *  "9171234567"  -> "917 123 4567"
 */
export function formatPhilippinePhoneDisplay(raw: string): string {
  const digits = sanitizePhilippinePhone(raw);
  if (!digits) return "";

  if (digits.startsWith("09")) {
    // Format: 09XX XXX XXXX (max 11 digits)
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
  }

  if (digits.startsWith("9")) {
    // Format: 9XX XXX XXXX (max 10 digits)
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }

  if (digits.startsWith("02") && digits.length >= 6) {
    // Metro Manila Landline: 02 XXXX XXXX (max 11 digits)
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 11)}`;
  }

  // General spacing (strictly capped at 11 digits)
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 11)}`;
}

export interface PhoneValidationResult {
  isValid: boolean;
  message?: string;
  isComplete: boolean;
  digitCount: number;
  expectedCount: number;
}

/**
 * Verifies whether the input is a valid Philippine mobile number or landline (max 11 digits).
 */
export function validatePhilippinePhone(val: string): PhoneValidationResult {
  if (!val || !val.trim()) {
    return {
      isValid: true,
      isComplete: false,
      digitCount: 0,
      expectedCount: 11,
    };
  }

  const digits = val.replace(/\D/g, "");

  // Local mobile starting with 09 (exactly 11 digits)
  if (digits.startsWith("09")) {
    if (digits.length === 11) {
      return {
        isValid: true,
        isComplete: true,
        digitCount: 11,
        expectedCount: 11,
      };
    }

    return {
      isValid: false,
      isComplete: false,
      message: `Incomplete mobile number (${digits.length}/11 digits entered)`,
      digitCount: digits.length,
      expectedCount: 11,
    };
  }

  // 10-digit starting with 9 (when combined with +63 country badge)
  if (digits.startsWith("9")) {
    if (digits.length === 10) {
      return {
        isValid: true,
        isComplete: true,
        digitCount: 10,
        expectedCount: 10,
      };
    }

    return {
      isValid: false,
      isComplete: false,
      message: `Incomplete number (${digits.length}/10 digits entered)`,
      digitCount: digits.length,
      expectedCount: 10,
    };
  }

  // Other Philippine numbers (7 to 11 digits max)
  if (digits.length >= 7 && digits.length <= 11) {
    return {
      isValid: true,
      isComplete: true,
      digitCount: digits.length,
      expectedCount: digits.length,
    };
  }

  return {
    isValid: false,
    isComplete: false,
    message: "Must be a valid phone number with up to 11 digits",
    digitCount: digits.length,
    expectedCount: 11,
  };
}
