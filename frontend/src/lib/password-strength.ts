/**
 * Local Client-Side Password Strength & Requirement Evaluator.
 *
 * Evaluates password complexity entirely within the browser runtime.
 * Never stores, logs, or transmits plaintext passwords to backend APIs.
 *
 * Required for a NEW password: 8+ characters, a letter, a number, and not a very common password.
 * Capital letters, symbols and length beyond 8 only raise the meter. Keep the common list and messages
 * in step with backend/src/security/password-policy.ts.
 */

export type PasswordStrengthLevel = "Weak" | "Fair" | "Good" | "Strong";

export interface PasswordRequirement {
  id: "length" | "letter" | "number" | "common" | "stronger";
  label: string;
  met: boolean;
  /** A tip that raises the meter but is never required. */
  optional?: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0 to 4
  level: PasswordStrengthLevel;
  percentage: number; // 0, 25, 50, 75, 100
  color: string; // Text color class
  bgColor: string; // Progress bar background class
  requirements: PasswordRequirement[];
  isEligible: boolean; // Every required rule is met
}

export const PASSWORD_TOO_SHORT = "Use at least 8 characters.";
export const PASSWORD_NEEDS_LETTER = "Add at least one letter.";
export const PASSWORD_NEEDS_NUMBER = "Add at least one number.";
export const PASSWORD_TOO_COMMON = "This password is too common. Choose another.";

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword1",
  "12345678", "123456789", "1234567890", "11111111", "00000000", "87654321", "12341234", "12345678a",
  "qwerty123", "qwertyuiop", "qwerty12", "qwerty1234", "1q2w3e4r", "1qaz2wsx", "zaq12wsx",
  "abc12345", "abcd1234", "abcd12345", "a1b2c3d4", "iloveyou", "iloveyou1", "iloveyou123",
  "admin123", "admin1234", "administrator1", "welcome1", "welcome123", "letmein123", "changeme1", "changeme123",
  "megs1234", "megs12345", "megsinc123", "megsjobs1", "megs2026", "megs2025",
  "monkey123", "dragon123", "football1", "baseball1", "superman1", "sunshine1", "princess1", "master123",
  "pogiako1", "mahalkita1", "iloveyou2", "philippines1", "manila123",
]);

/** The first reason a new password is not allowed, or null when it is fine. */
export function newPasswordProblem(password: string): string | null {
  if (password.length < 8) return PASSWORD_TOO_SHORT;
  if (!/\p{L}/u.test(password)) return PASSWORD_NEEDS_LETTER;
  if (!/\p{N}/u.test(password)) return PASSWORD_NEEDS_NUMBER;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return PASSWORD_TOO_COMMON;
  return null;
}

/**
 * For a Zod `.superRefine` on a new-password field. The existing `.min(8, ...)` already reports a short password,
 * so this adds only the letter, number and too-common messages.
 */
export function addNewPasswordIssue(
  value: string,
  ctx: { addIssue: (issue: { code: "custom"; message: string }) => void },
): void {
  const problem = value.length >= 8 ? newPasswordProblem(value) : null;
  if (problem) ctx.addIssue({ code: "custom", message: problem });
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const pwd = password || "";

  const hasMinLength = pwd.length >= 8;
  const hasLetter = /\p{L}/u.test(pwd);
  const hasNumber = /\p{N}/u.test(pwd);
  const isCommon = hasMinLength && hasLetter && hasNumber && newPasswordProblem(pwd) === PASSWORD_TOO_COMMON;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  const isLong = pwd.length >= 12;
  const bonusCount = (hasUppercase ? 1 : 0) + (hasSpecial ? 1 : 0);

  const requirements: PasswordRequirement[] = [
    { id: "length", label: "At least 8 characters", met: hasMinLength },
    { id: "letter", label: "At least one letter", met: hasLetter },
    { id: "number", label: "At least one number", met: hasNumber },
  ];
  // Shown only when the password would otherwise pass, so the extra line explains why it is still Weak.
  if (isCommon) requirements.push({ id: "common", label: "Not a very common password", met: false });
  requirements.push({
    id: "stronger",
    label: "Optional: add a capital letter or symbol, or use 12+ characters",
    met: isLong || bonusCount > 0,
    optional: true,
  });

  const isEligible = hasMinLength && hasLetter && hasNumber && !isCommon;

  if (!pwd) {
    return { score: 0, level: "Weak", percentage: 0, color: "text-slate-400", bgColor: "bg-slate-200", requirements, isEligible: false };
  }

  if (!isEligible) {
    return { score: 1, level: "Weak", percentage: 25, color: "text-rose-600", bgColor: "bg-rose-500", requirements, isEligible };
  }
  if (isLong && bonusCount >= 1) {
    return { score: 4, level: "Strong", percentage: 100, color: "text-emerald-700", bgColor: "bg-emerald-600", requirements, isEligible };
  }
  if (isLong || bonusCount === 2) {
    return { score: 3, level: "Good", percentage: 75, color: "text-teal-700", bgColor: "bg-teal-600", requirements, isEligible };
  }
  return { score: 2, level: "Fair", percentage: 50, color: "text-amber-600", bgColor: "bg-amber-500", requirements, isEligible };
}

/** Supabase Auth hashes passwords with bcrypt, which only reads the first 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MAX_BYTES_MESSAGE = `Password must be ${PASSWORD_MAX_BYTES} bytes or fewer.`;

/** UTF-8 byte length, so accented letters and emoji count as more than one byte. */
export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

/** True when a NEW password fits the 72-byte limit. Login passwords are never checked against it. */
export function isWithinPasswordByteLimit(password: string): boolean {
  return passwordByteLength(password) <= PASSWORD_MAX_BYTES;
}
