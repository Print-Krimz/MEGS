// Rule for NEW passwords (sign-up, reset, setup, claim, change). Logging in never uses it, so older accounts still sign in.
// Keep the list and messages in step with frontend/src/lib/password-strength.ts.

export const PASSWORD_TOO_SHORT = "Use at least 8 characters.";
export const PASSWORD_NEEDS_LETTER = "Add at least one letter.";
export const PASSWORD_NEEDS_NUMBER = "Add at least one number.";
export const PASSWORD_TOO_COMMON = "This password is too common. Choose another.";

export const PASSWORD_POLICY_MESSAGES: readonly string[] = [
  PASSWORD_TOO_SHORT,
  PASSWORD_NEEDS_LETTER,
  PASSWORD_NEEDS_NUMBER,
  PASSWORD_TOO_COMMON,
];

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

/** The first reason a new password is not allowed, or null when it is fine. Length is counted in characters. */
export const newPasswordProblem = (password: string): string | null => {
  if (password.length < 8) return PASSWORD_TOO_SHORT;
  if (!/\p{L}/u.test(password)) return PASSWORD_NEEDS_LETTER;
  if (!/\p{N}/u.test(password)) return PASSWORD_NEEDS_NUMBER;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return PASSWORD_TOO_COMMON;
  return null;
};
