import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
export const fromAddress = process.env.EMAIL_FROM || "MEGS Recruitment <onboarding@resend.dev>";

let resend: Resend | null = null;
if (resendApiKey) {
  resend = new Resend(resendApiKey);
}

export const sendMail = async (to: string, subject: string, text: string, html?: string) => {
  try {
    if (!resend) {
      console.log(`\n📧 [DEV EMAIL LOG] Resend API key not configured.`);
      console.log(`   To: ${to}`);
      console.log(`   From: ${fromAddress}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Body: ${text}\n`);
      return { success: true, messageId: "dev-mock-id" };
    }

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      text,
      html: html || text,
    });

    if (error) {
      console.error("[Resend] Failed to send email:", error.message);
      throw new Error(error.message);
    }

    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error("[Mailer] Email sending error:", error.message);
    throw error;
  }
};

