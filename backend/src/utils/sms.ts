/**
 * SMS Utility Module for MEGS
 * Interfaces with TextBee Android SMS Gateway to dispatch SMS OTPs.
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

export const SYNTHETIC_EMAIL_DOMAIN = "applicant.megs.local";

export const toSyntheticEmail = (phoneE164: string): string => {
  const digitsOnly = normalizeToE164(phoneE164).replace(/\D/g, "");
  return `${digitsOnly}@${SYNTHETIC_EMAIL_DOMAIN}`;
};

export const isSyntheticEmail = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;
  return email.toLowerCase().trim().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
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

export interface TextBeeSendResult {
  success: boolean;
  smsBatchId?: string;
  error?: string;
}

export const sendSmsViaTextBee = async (
  phone: string,
  message: string
): Promise<TextBeeSendResult> => {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;

  const recipientE164 = normalizeToE164(phone);

  if (!apiKey) {
    console.warn("⚠️ [SMS] TEXTBEE_API_KEY not configured. Message not sent via network.");
    return { success: false, error: "TEXTBEE_API_KEY not configured" };
  }

  const payload: Record<string, any> = {
    recipients: [recipientE164],
    message,
  };

  if (deviceId) {
    payload.deviceId = deviceId;
  }

  try {
    const response = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `TextBee error: HTTP ${response.status}`;
      console.error(`❌ [TextBee] Failed to send SMS to ${recipientE164}:`, errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log(`📱 [TextBee] SMS dispatched to ${recipientE164}. Batch ID: ${data?.smsBatchId || "N/A"}`);
    return { success: true, smsBatchId: data?.smsBatchId };
  } catch (err: any) {
    console.error(`❌ [TextBee] Network exception sending SMS to ${recipientE164}:`, err.message);
    return { success: false, error: err.message };
  }
};
