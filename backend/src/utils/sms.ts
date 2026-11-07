/**
 * SMS Utility Module for MEGS
 * Sends SMS (OTPs and notifications) through Semaphore with sender name MEGSINC.
 */

const PH_MOBILE_REGEX = /^(?:\+63|0)?9\d{9}$/;

export const isPhilippinePhone = (val: string): boolean => {
  if (!val || typeof val !== "string") return false;
  const cleaned = val.replace(/[\s-]/g, "");
  return PH_MOBILE_REGEX.test(cleaned);
};

export const normalizeToE164 = (val: string): string => {
  const cleaned = val.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+63")) {
    return cleaned;
  }
  if (cleaned.startsWith("63")) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith("09")) {
    return `+63${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith("9") && cleaned.length === 10) {
    return `+63${cleaned}`;
  }
  return cleaned;
};

export const normalizeToLocal = (val: string): string => {
  const e164 = normalizeToE164(val);
  if (e164.startsWith("+63")) {
    return `0${e164.slice(3)}`;
  }
  return e164;
};

/** Every spelling a stored number may take: +639…, 09… and 639…. */
export const phoneVariants = (phone: string): string[] => {
  const e164 = normalizeToE164(phone);
  return [...new Set([e164, normalizeToLocal(e164), e164.replace(/^\+/, "")])];
};

export const SYNTHETIC_EMAIL_DOMAIN = "applicant.megs.local";

export const toSyntheticEmail = (phoneE164: string): string => {
  const digitsOnly = normalizeToE164(phoneE164).replace(/\D/g, "");
  return `${digitsOnly}@${SYNTHETIC_EMAIL_DOMAIN}`;
};

export const WALK_IN_EMAIL_DOMAIN = "megs.internal";

/** True for phone-derived placeholder addresses (`<digits>@applicant.megs.local`). */
export const isPhoneSyntheticEmail = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;
  return email.toLowerCase().trim().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
};

/** True for any placeholder address MEGS made up: phone-derived or walk-in. Never email these. */
export const isSyntheticEmail = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;
  const lower = email.toLowerCase().trim();
  return lower.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`) || lower.endsWith(`@${WALK_IN_EMAIL_DOMAIN}`);
};

export const fromSyntheticEmail = (email: string): string => {
  const localPart = email.split("@")[0] || "";
  return `+${localPart}`;
};

export const maskPhoneNumber = (phone: string): string => {
  const local = normalizeToLocal(phone);
  if (local.length === 11) {
    return `${local.slice(0, 4)}****${local.slice(8)}`;
  }
  if (phone.length > 4) {
    return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
  }
  return phone;
};

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Sends one text through Semaphore. Never throws: failure comes back in the result. */
export const sendSms = async (phone: string, message: string): Promise<SmsSendResult> => {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  const recipient = normalizeToLocal(phone);

  if (!apiKey) {
    console.warn("⚠️ [SMS] SEMAPHORE_API_KEY not configured. Message not sent via network.");
    return { success: false, error: "SEMAPHORE_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        apikey: apiKey,
        number: recipient,
        message,
        sendername: process.env.SEMAPHORE_SENDER_NAME || "MEGSINC",
      }),
      // A stalled gateway must not hold the request open.
      signal: AbortSignal.timeout(10_000),
    });

    const data: any = await response.json().catch(() => null);

    // Success is an array with one object per message; errors come back as an object.
    const first = Array.isArray(data) ? data[0] : null;
    if (!response.ok || !first || first.status === "Failed") {
      const raw = Array.isArray(data) ? first?.status : data && typeof data === "object" ? Object.values(data)[0] : null;
      const errorMsg = (Array.isArray(raw) ? String(raw[0]) : raw ? String(raw) : "") || `Semaphore error: HTTP ${response.status}`;
      console.error(`❌ [Semaphore] Failed to send SMS to ${recipient}:`, errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log(`📱 [Semaphore] SMS dispatched to ${recipient}. Message ID: ${first.message_id ?? "N/A"}`);
    return { success: true, messageId: first.message_id != null ? String(first.message_id) : undefined };
  } catch (err: any) {
    console.error(`❌ [Semaphore] Network exception sending SMS to ${recipient}:`, err.message);
    return { success: false, error: err.message };
  }
};
