/**
 * Utilities for Philippine phone number formatting, sanitization, and verification.
 * Strictly enforces maximum 11 digits only.
 */

/**
 * Sanitizes phone input to numeric digits only and strictly limits to 11 digits max.
 */
export function sanitizePhilippinePhone(raw: string): string {
  if (!raw) return "";

  // Preserve invalid or multi-number pastes so validation can reject them instead of
  // silently truncating a second number to the first 11 digits.
  if (!/^\+?[0-9\s().-]*$/.test(raw) || (raw.match(/\+/g)?.length ?? 0) > 1) return raw;

  // Strip non-digit characters
  let digits = raw.replace(/\D/g, "");

  // If user pasted/typed with country code (63), strip the 63 prefix to get local national number
  if (digits.startsWith("63") && digits.length > 10) {
    digits = digits.slice(2);
    if (!digits.startsWith("0") && !digits.startsWith("9")) digits = `0${digits}`;
  }

  if (digits.length > 11) return raw;

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

  if (/^\+?[0-9\s().-]*$/.test(raw) && (raw.match(/\+/g)?.length ?? 0) <= 1 && digits === raw) {
    const digitCount = raw.replace(/\D/g, "").length;
    if (digitCount > 11) return raw;
  } else if (digits === raw) {
    return raw;
  }

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

/** Formats an accepted mobile value in local 09xxxxxxxxx form. */
export function formatPhilippineMobileDisplay(raw: string): string {
  const sanitized = sanitizePhilippinePhone(raw);
  if (sanitized === raw && raw && !/^\+?[0-9\s().-]*$/.test(raw)) return raw;
  let digits = sanitized.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) digits = digits.slice(2);
  if (/^9\d{9}$/.test(digits)) digits = `0${digits}`;
  if (digits.length > 11) return raw;
  return formatPhilippinePhoneDisplay(digits);
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

  if (!/^\+?[0-9\s().-]+$/.test(val) || (val.match(/\+/g)?.length ?? 0) > 1) {
    return {
      isValid: false,
      isComplete: false,
      message: "Enter one Philippine phone number using digits and standard separators",
      digitCount: val.replace(/\D/g, "").length,
      expectedCount: 11,
    };
  }

  const digits = val.replace(/\D/g, "");
  let localDigits = digits;
  if (localDigits.startsWith("63")) {
    if (localDigits.length < 9 || localDigits.length > 12) {
      return {
        isValid: false,
        isComplete: false,
        message: "Enter one Philippine phone number with 7 to 11 local digits",
        digitCount: localDigits.length,
        expectedCount: 11,
      };
    }
    localDigits = `0${localDigits.slice(2)}`;
  }

  // Local mobile starting with 09 (exactly 11 digits)
  if (localDigits.startsWith("09")) {
    if (localDigits.length === 11) {
      return {
        isValid: true,
        isComplete: true,
        digitCount: localDigits.length,
        expectedCount: 11,
      };
    }

    return {
      isValid: false,
      isComplete: false,
        message: `Incomplete mobile number (${localDigits.length}/11 digits entered)`,
        digitCount: localDigits.length,
      expectedCount: 11,
    };
  }

  // 10-digit starting with 9 (when combined with +63 country badge)
  if (localDigits.startsWith("9")) {
    if (localDigits.length === 10) {
      return {
        isValid: true,
        isComplete: true,
        digitCount: localDigits.length,
        expectedCount: 10,
      };
    }

    return {
      isValid: false,
      isComplete: false,
        message: `Incomplete number (${localDigits.length}/10 digits entered)`,
        digitCount: localDigits.length,
      expectedCount: 10,
    };
  }

  // Other Philippine numbers (7 to 11 digits max)
  if (localDigits.length >= 7 && localDigits.length <= 11) {
    return {
      isValid: true,
      isComplete: true,
      digitCount: localDigits.length,
      expectedCount: localDigits.length,
    };
  }

  return {
    isValid: false,
    isComplete: false,
    message: "Must be a valid phone number with up to 11 digits",
    digitCount: localDigits.length,
    expectedCount: 11,
  };
}

const normalizePhilippineMobile = (raw: string): string | null => {
  if (!/^\+?[0-9\s().-]+$/.test(raw) || (raw.match(/\+/g)?.length ?? 0) > 1) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63")) {
    if (digits.length !== 12) return null;
    digits = digits.slice(2);
  }
  if (/^9\d{9}$/.test(digits)) digits = `0${digits}`;
  return /^09\d{9}$/.test(digits) ? digits : null;
};

export function validatePhilippineMobile(val: string): PhoneValidationResult {
  if (!val || !val.trim()) {
    return { isValid: true, isComplete: false, digitCount: 0, expectedCount: 11 };
  }
  const normalized = normalizePhilippineMobile(val);
  if (normalized) return { isValid: true, isComplete: true, digitCount: 11, expectedCount: 11 };
  return {
    isValid: false,
    isComplete: false,
    message: `Enter one Philippine mobile number with 11 local digits beginning with 09 (${val.replace(/\D/g, "").length}/11 digits)`,
    digitCount: val.replace(/\D/g, "").length,
    expectedCount: 11,
  };
}
