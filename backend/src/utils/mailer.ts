import nodemailer from "nodemailer";
import { redactSensitiveText } from "../security/errors.js";
import { isSyntheticEmail } from "./sms.js";

export const getFromAddress = (): string => {
  if (process.env.EMAIL_FROM) {
    return process.env.EMAIL_FROM;
  }
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  if (user) {
    return `"MEGS Inc." <${user}>`;
  }
  return '"MEGS Inc." <noreply@megsinc.com>';
};

export const fromAddress = getFromAddress();

// Splits `"Name" <a@b.c>` into the sender object Brevo expects. A bare address has no name.
export const parseFromAddress = (from: string): { name?: string; email: string } => {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (!match) return { email: from.trim() };
  const name = match[1].trim();
  return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
};

export const redactAuthenticationSecrets = (value: string): string =>
  redactSensitiveText(value)
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:token|access_token|refresh_token|code|otp)=)[^&#\s]+/gi, "$1[REDACTED]")
    .replace(/\b\d{6}\b/g, "******");

export const isMockTransporterOrNodemailer = (transporter?: any): boolean => {
  const nm: any = nodemailer;
  const ct = nm?.createTransport || nm?.default?.createTransport;
  const isCreateTransportMocked =
    typeof ct === "function" &&
    (Boolean(ct._isMockFunction) || Boolean(ct.mock));

  if (isCreateTransportMocked) return true;
  if (!transporter) return false;

  const isSendMailMocked =
    Boolean(transporter._isMockFunction) ||
    Boolean(transporter.mock) ||
    Boolean((transporter.sendMail as any)?._isMockFunction) ||
    Boolean((transporter.sendMail as any)?.mock);

  const isNotRealMailInstance = transporter.constructor?.name !== "Mail";

  return isSendMailMocked || isNotRealMailInstance;
};

let cachedTransporter: nodemailer.Transporter | null = null;

export const resetMailTransporter = (): void => {
  cachedTransporter = null;
};

// Sends handed to the pool that have not settled yet. closeMailTransporter waits on these.
const pendingSends = new Set<Promise<unknown>>();

// Short-lived processes (jobs:run) call this before exit: a pooled SMTP socket stays open for
// minutes and would keep the process alive. pool.close() lets in-flight sends finish but fails
// queued ones (nodemailer smtp-pool close(), "Connection pool was closed"), so wait for them first.
export const closeMailTransporter = async (timeoutMs = 15_000): Promise<void> => {
  const transporter = cachedTransporter;
  if (!transporter && pendingSends.size === 0) return;
  if (pendingSends.size > 0) {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      Promise.allSettled([...pendingSends]),
      new Promise((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
    clearTimeout(timer);
  }
  cachedTransporter = null;
  transporter?.close?.();
};

export const createMailTransporter = () => {
  const isTest = process.env.NODE_ENV === "test";
  const isLiveTest = Boolean(process.env.LIVE_EMAIL_TEST);

  // In test environment without LIVE_EMAIL_TEST, avoid creating live SMTP transport
  // unless nodemailer.createTransport is a test mock or spy.
  if (isTest && !isLiveTest && !isMockTransporterOrNodemailer()) {
    return null;
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  // One pooled transporter is reused so each send skips a fresh TLS + AUTH handshake.
  if (cachedTransporter) return cachedTransporter;

  if (gmailUser && gmailPass) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      auth: {
        user: gmailUser.trim(),
        pass: gmailPass.replace(/\s+/g, ""),
      },
    });
    return cachedTransporter;
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpUser && smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    return cachedTransporter;
  }

  return null;
};

// ---------------------------------------------------------------------------
// MEGS email branding. Every HTML email goes through renderBrandedEmail so the
// logo, colours and company footer match the public site.
// ---------------------------------------------------------------------------

const BRAND = {
  red: "#C8102E",
  redTint: "#FDF1F2",
  navy: "#0B2F5B",
  text: "#0F1B2D",
  muted: "#4B5A6E",
  border: "#DDE2E9",
  page: "#F6F7F9",
  font: "Arial, Helvetica, sans-serif",
};

const COMPANY = {
  shortName: "MEGS Inc.",
  legalName: "MAR Employment for Good Services Inc.",
  office: "Valenzuela Central Office",
  address: "#9, PJAR Bldg, P. Gomez St, Malinta, Valenzuela City",
  phones: ["0917-629-1864", "(02) 8277-2959", "(02) 8291-0807"],
  compliance: "DOLE D.O. 174-17 & D.O. 40-03 Compliant",
};

const getAppBaseUrl = (): string =>
  (process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

// The logo is a public frontend asset. Brevo's API has no inline (CID) images, and a
// localhost URL would show a broken image, so non-https bases get the text wordmark.
const getEmailLogoUrl = (): string | null => {
  const base = getAppBaseUrl();
  return base.startsWith("https://") ? `${base}/images/canva-ref/megs-logo-480.jpg` : null;
};

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const textToHtml = (value: string): string => escapeHtml(value).replace(/\r?\n/g, "<br/>");

export const plainTextFooter = (): string =>
  [
    "--",
    `${COMPANY.shortName} | ${COMPANY.legalName}`,
    `${COMPANY.office}, ${COMPANY.address}`,
    COMPANY.phones.join(" | "),
    getAppBaseUrl(),
  ].join("\n");

export interface BrandedEmailParams {
  heading: string;
  bodyHtml: string;
  // Inbox preview line. Defaults to the heading.
  preheader?: string;
  // Small coloured label above the heading.
  eyebrow?: { text: string; color: string };
  cta?: { text: string; url: string };
  // Security or context note shown under the body.
  footnote?: string;
}

export const renderBrandedEmail = (params: BrandedEmailParams): string => {
  const baseUrl = getAppBaseUrl();
  const siteLabel = baseUrl.replace(/^https?:\/\//, "");

  const logoUrl = getEmailLogoUrl();
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="MEGS Inc." width="110" height="80" style="display: block; border: 0; width: 110px; height: auto;" />`
    : `<span style="font-family: ${BRAND.font}; font-size: 24px; font-weight: 800; color: ${BRAND.red}; letter-spacing: 0.02em;">MEGS Inc.</span>`;

  const eyebrowHtml = params.eyebrow
    ? `<p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${params.eyebrow.color};">${escapeHtml(params.eyebrow.text)}</p>`
    : "";

  const ctaHtml = params.cta
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 8px 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: ${BRAND.red};">
                    <a href="${escapeHtml(params.cta.url)}" style="display: inline-block; padding: 13px 26px; font-family: ${BRAND.font}; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 6px;">${escapeHtml(params.cta.text)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${BRAND.muted};">Button not working? Copy this link into your browser:<br/><a href="${escapeHtml(params.cta.url)}" style="color: ${BRAND.navy}; word-break: break-all;">${escapeHtml(params.cta.url)}</a></p>`
    : "";

  const footnoteHtml = params.footnote
    ? `<p style="margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid ${BRAND.border}; font-size: 13px; line-height: 1.5; color: ${BRAND.muted};">${escapeHtml(params.footnote)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${escapeHtml(params.heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.page};">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(params.preheader || params.heading)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND.page};">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid ${BRAND.border}; border-top: 4px solid ${BRAND.red}; border-radius: 8px; font-family: ${BRAND.font};">
          <tr>
            <td style="padding: 20px 32px; border-bottom: 1px solid ${BRAND.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle;">${logoHtml}</td>
                  <td align="right" style="vertical-align: middle; font-size: 12px; line-height: 1.4; color: ${BRAND.navy};">
                    <strong>${COMPANY.legalName}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              ${eyebrowHtml}
              <h1 style="margin: 0 0 16px 0; font-size: 22px; line-height: 1.3; font-weight: 700; color: ${BRAND.navy};">${escapeHtml(params.heading)}</h1>
              <div style="font-size: 15px; line-height: 1.6; color: ${BRAND.text};">${params.bodyHtml}</div>
              ${ctaHtml}
              ${footnoteHtml}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; font-family: ${BRAND.font};">
          <tr>
            <td style="padding: 20px 32px; font-size: 12px; line-height: 1.6; color: ${BRAND.muted}; text-align: center;">
              <strong style="color: ${BRAND.navy};">${COMPANY.legalName} (MEGS)</strong><br/>
              ${COMPANY.office}, ${COMPANY.address}<br/>
              ${COMPANY.phones.join(" &middot; ")}<br/>
              <a href="${escapeHtml(baseUrl)}" style="color: ${BRAND.navy};">${escapeHtml(siteLabel)}</a> &middot; ${COMPANY.compliance.replace("&", "&amp;")}<br/>
              <span style="display: inline-block; margin-top: 8px;">This is an automated message from the MEGS portal. Please do not reply to this email.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

const isFetchMocked = (): boolean => {
  const f: any = globalThis.fetch;
  return Boolean(f?._isMockFunction || f?.mock);
};

const sendViaBrevo = async (
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<{ success: boolean; messageId?: string }> => {
  try {
    const res = await fetch(BREVO_SEND_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: parseFromAddress(from),
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Brevo ${res.status}: ${body.slice(0, 300)}`);
    }
    const data: any = await res.json().catch(() => ({}));
    return { success: true, messageId: data?.messageId };
  } catch (error: any) {
    console.error("[Mailer] Email delivery error:", redactAuthenticationSecrets(String(error?.message || error)));
    throw new Error("Email delivery is temporarily unavailable. Please try again later.");
  }
};

export const sendMail = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<{ success: boolean; messageId?: string }> => {
  // Placeholder addresses (phone sign-ups, walk-ins) have no mailbox.
  if (isSyntheticEmail(to)) {
    console.log("[MAIL] Skipped: recipient has no real email address.");
    return { success: true };
  }
  const from = getFromAddress();
  const isTest = process.env.NODE_ENV === "test";
  const isLiveTest = Boolean(process.env.LIVE_EMAIL_TEST);

  // Brevo wins when configured. Tests never hit it unless fetch is mocked or LIVE_EMAIL_TEST is set.
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  if (brevoKey && (!isTest || isLiveTest || isFetchMocked())) {
    const brevoHtml = html || renderBrandedEmail({ heading: subject, bodyHtml: textToHtml(text) });
    const sending = sendViaBrevo(brevoKey, from, to, subject, `${text}\n\n${plainTextFooter()}`, brevoHtml);
    pendingSends.add(sending);
    return sending.finally(() => pendingSends.delete(sending));
  }

  const transporter = createMailTransporter();
  const isMocked = isMockTransporterOrNodemailer(transporter);

  if (!transporter || (isTest && !isLiveTest && !isMocked)) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email delivery is unavailable because SMTP is not configured");
    }

    const sanitizedText = redactAuthenticationSecrets(text);
    const reason = !transporter
      ? "SMTP / Gmail credentials not configured or live SMTP disabled in test."
      : "SMTP / Gmail live connection skipped in test mode.";
    console.log(`\n📧 [DEV EMAIL LOG] ${reason}`);
    console.log(`   To: ${to.replace(/(^.).*(@.*$)/, "$1***$2")}`);
    console.log(`   From: ${redactSensitiveText(from)}`);
    console.log(`   Subject: ${redactSensitiveText(subject)}`);
    console.log(`   Body: ${sanitizedText}\n`);
    return { success: true, messageId: "dev-mock-id" };
  }

  // Plain-text callers (the outbox worker) still get the branded layout.
  const finalHtml = html || renderBrandedEmail({ heading: subject, bodyHtml: textToHtml(text) });

  try {
    const sending = Promise.resolve(transporter.sendMail({
      from,
      to,
      subject,
      text: `${text}\n\n${plainTextFooter()}`,
      html: finalHtml,
    }));
    pendingSends.add(sending);
    const info = await sending.finally(() => pendingSends.delete(sending));

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[Mailer] Email delivery error:", redactAuthenticationSecrets(String(error?.message || error)));
    throw new Error("Email delivery is temporarily unavailable. Please try again later.");
  }
};

const otpCodeHtml = (otp: string): string => `
  <div style="margin: 24px 0; text-align: center;">
    <span style="display: inline-block; font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${BRAND.navy}; background-color: ${BRAND.redTint}; padding: 14px 28px; border-radius: 8px; border: 1px dashed ${BRAND.red};">${escapeHtml(otp)}</span>
  </div>
  <p style="margin: 0; font-size: 14px; color: ${BRAND.muted};">This code expires in <strong>10 minutes</strong> and can only be used once. MEGS staff will never ask you for this code.</p>`;

export const buildRegistrationOtpEmailHtml = (otp: string): string =>
  renderBrandedEmail({
    heading: "Verify your email address",
    preheader: "Your MEGS verification code expires in 10 minutes.",
    bodyHtml: `<p style="margin: 0;">Thank you for registering with MEGS Inc. Enter this 6-digit code to activate your applicant account:</p>${otpCodeHtml(otp)}`,
    footnote: "If you did not register for a MEGS account, you can ignore this email.",
  });

export const buildPasswordResetOtpEmailHtml = (otp: string): string =>
  renderBrandedEmail({
    heading: "Reset your password",
    preheader: "Your MEGS password reset code expires in 10 minutes.",
    bodyHtml: `<p style="margin: 0;">We received a request to reset the password of your MEGS account. Enter this 6-digit code to continue:</p>${otpCodeHtml(otp)}`,
    footnote:
      "If you did not ask to reset your password, ignore this email. Your password stays the same. Call our Valenzuela office if you think someone else is using your account.",
  });

export const sendRegistrationOtpEmail = async (to: string, otp: string) => {
  const subject = "MEGS Inc.: Your verification code";
  const text = `MEGS Inc. verification code: ${otp}\n\nThis code expires in 10 minutes.`;
  return sendMail(to, subject, text, buildRegistrationOtpEmailHtml(otp));
};

export const sendPasswordResetOtpEmail = async (to: string, otp: string) => {
  const subject = "MEGS Inc.: Your password reset code";
  const text = `MEGS Inc. password reset code: ${otp}\n\nThis code expires in 10 minutes.`;
  return sendMail(to, subject, text, buildPasswordResetOtpEmailHtml(otp));
};

export const buildTAInvitationEmailHtml = (setupLink: string, firstName?: string): string =>
  renderBrandedEmail({
    heading: "You're invited to the MEGS portal",
    preheader: "Set up your Talent Acquisition account. The link expires in 48 hours.",
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">${firstName ? `Hello ${escapeHtml(firstName)},` : "Hello,"}</p>
      <p style="margin: 0 0 12px 0;">You have been invited to join MEGS Inc. as a <strong>Talent Acquisition Specialist</strong>.</p>
      <p style="margin: 0;">Set your password to finish your account setup. This link works once and expires in <strong>48 hours</strong>.</p>`,
    cta: { text: "Set up your account", url: setupLink },
    footnote: "If you were not expecting this invitation, contact the MEGS administrator.",
  });

export const sendTAInvitationEmail = async (
  to: string,
  setupLink: string,
  firstName?: string
) => {
  const nameGreeting = firstName ? `Hello ${firstName},` : "Hello,";
  const subject = "MEGS Inc.: Your Talent Acquisition account invitation";
  const text = `${nameGreeting}\nYou have been invited to join MEGS Inc. as a Talent Acquisition Specialist.\n\nSet up your account and create your password using this link:\n${setupLink}\n\nThis link is single-use and expires in 48 hours.`;
  return sendMail(to, subject, text, buildTAInvitationEmailHtml(setupLink, firstName));
};

export interface NotificationEmailTemplateParams {
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  ctaText?: string;
  ctaUrl?: string;
}

const NOTIFICATION_TYPE_STYLES: Record<string, { color: string; label: string }> = {
  INFO: { color: BRAND.navy, label: "Update" },
  SUCCESS: { color: "#047857", label: "Good news" },
  WARNING: { color: "#B45309", label: "Action needed" },
  ERROR: { color: BRAND.red, label: "Important" },
};

export const buildNotificationEmailHtml = (params: NotificationEmailTemplateParams): string => {
  const typeStyle = NOTIFICATION_TYPE_STYLES[params.type || "INFO"] || NOTIFICATION_TYPE_STYLES.INFO;

  let cta: BrandedEmailParams["cta"];
  if (params.ctaUrl) {
    let fullCtaUrl = params.ctaUrl;
    if (!fullCtaUrl.startsWith("http://") && !fullCtaUrl.startsWith("https://")) {
      fullCtaUrl = `${getAppBaseUrl()}${fullCtaUrl.startsWith("/") ? "" : "/"}${fullCtaUrl}`;
    }
    cta = { text: params.ctaText || "Open the MEGS portal", url: fullCtaUrl };
  }

  return renderBrandedEmail({
    heading: params.title,
    preheader: (params.message || "").split(/\r?\n/)[0],
    eyebrow: { text: typeStyle.label, color: typeStyle.color },
    bodyHtml: `<p style="margin: 0;">${textToHtml(params.message || "")}</p>`,
    cta,
  });
};
