import nodemailer from "nodemailer";

export const getFromAddress = (): string => {
  if (process.env.EMAIL_FROM) {
    return process.env.EMAIL_FROM;
  }
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  if (user) {
    return `"MEGS Recruitment" <${user}>`;
  }
  return '"MEGS Recruitment" <no-reply@megs.com>';
};

export const fromAddress = getFromAddress();

export const createMailTransporter = () => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (gmailUser && gmailPass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser.trim(),
        pass: gmailPass.replace(/\s+/g, ""),
      },
    });
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  return null;
};

export const sendMail = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<{ success: boolean; messageId?: string }> => {
  const from = getFromAddress();
  const transporter = createMailTransporter();

  if (!transporter) {
    console.log(`\n📧 [DEV EMAIL LOG] SMTP / Gmail credentials not configured.`);
    console.log(`   To: ${to}`);
    console.log(`   From: ${from}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${text}\n`);
    return { success: true, messageId: "dev-mock-id" };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || text,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[Mailer] Email delivery error:", error?.message || error);
    throw error;
  }
};
