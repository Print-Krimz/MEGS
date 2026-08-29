/**
 * Local Client-Side Password Strength & Requirement Evaluator.
 * 
 * Evaluates password complexity entirely within the browser runtime.
 * Never stores, logs, or transmits plaintext passwords to backend APIs.
 */

export type PasswordStrengthLevel = "Weak" | "Fair" | "Good" | "Strong";

export interface PasswordRequirement {
  id: "length" | "uppercase" | "lowercase" | "number" | "special";
  label: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0 to 4
  level: PasswordStrengthLevel;
  percentage: number; // 0, 25, 50, 75, 100
  color: string; // Text color class
  bgColor: string; // Progress bar background class
  requirements: PasswordRequirement[];
  isEligible: boolean; // Minimum length requirement met
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const pwd = password || "";
  
  const hasMinLength = pwd.length >= 8;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasLowercase = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

  const requirements: PasswordRequirement[] = [
    { id: "length", label: "At least 8 characters", met: hasMinLength },
    { id: "uppercase", label: "At least one uppercase letter (A-Z)", met: hasUppercase },
    { id: "lowercase", label: "At least one lowercase letter (a-z)", met: hasLowercase },
    { id: "number", label: "At least one number (0-9)", met: hasNumber },
    { id: "special", label: "At least one special character (e.g. !@#$%)", met: hasSpecial },
  ];

  if (!pwd) {
    return {
      score: 0,
      level: "Weak",
      percentage: 0,
      color: "text-slate-400",
      bgColor: "bg-slate-200",
      requirements,
      isEligible: false,
    };
  }

  // Count diversity criteria (0 to 4)
  const charTypesCount =
    (hasUppercase ? 1 : 0) +
    (hasLowercase ? 1 : 0) +
    (hasNumber ? 1 : 0) +
    (hasSpecial ? 1 : 0);

  let score = 1;
  let level: PasswordStrengthLevel = "Weak";
  let percentage = 25;
  let color = "text-rose-600";
  let bgColor = "bg-rose-500";

  if (!hasMinLength) {
    // Under 8 characters is always Weak
    score = 1;
    level = "Weak";
    percentage = 25;
    color = "text-rose-600";
    bgColor = "bg-rose-500";
  } else {
    // 8+ characters
    if (charTypesCount <= 2) {
      score = 2;
      level = "Fair";
      percentage = 50;
      color = "text-amber-600";
      bgColor = "bg-amber-500";
    } else if (charTypesCount === 3) {
      score = 3;
      level = "Good";
      percentage = 75;
      color = "text-teal-700";
      bgColor = "bg-teal-600";
    } else {
      // charTypesCount === 4 (or 3 with length >= 12)
      score = 4;
      level = "Strong";
      percentage = 100;
      color = "text-emerald-700";
      bgColor = "bg-emerald-600";
    }
  }

  return {
    score,
    level,
    percentage,
    color,
    bgColor,
    requirements,
    isEligible: hasMinLength,
  };
}
