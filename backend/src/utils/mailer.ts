import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || "587", 10);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
export const fromAddress = process.env.SMTP_FROM || "no-reply@cap2-recruitment.com";

let transporter: nodemailer.Transporter;

if (host && user && pass) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
} else {
  // Mock transporter for development/test when SMTP environment variables are not configured
  transporter = nodemailer.createTransport({
    jsonTransport: true,
  });
}

export const sendMail = async (to: string, subject: string, text: string, html?: string) => {
  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html: html || text,
    });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[Mailer] Failed to send email:", error.message);
    throw error;
  }
};
