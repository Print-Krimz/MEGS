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
    const sanitizedText = text.replace(/\b\d{6}\b/g, "******");
    console.log(`\n📧 [DEV EMAIL LOG] SMTP / Gmail credentials not configured.`);
    console.log(`   To: ${to}`);
    console.log(`   From: ${from}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${sanitizedText}\n`);
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

export const sendRegistrationOtpEmail = async (to: string, otp: string) => {
  const subject = "Verify Your MEGS Candidate Account";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-bottom: 16px;">Verify Your Email Address</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">Thank you for registering with MEGS Recruitment Portal. Please use the 6-digit verification code below to activate your candidate account:</p>
      <div style="margin: 28px 0; text-align: center;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0d9488; background: #f0fdfa; padding: 14px 28px; border-radius: 8px; border: 1px dashed #0d9488; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px;">This code expires in <strong>10 minutes</strong> and can only be used once.</p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">If you did not register for a MEGS account, you can safely ignore this email.</p>
    </div>
  `;
  const text = `MEGS Candidate Verification Code: ${otp}\n\nThis code expires in 10 minutes.`;
  return sendMail(to, subject, text, html);
};

export const sendPasswordResetOtpEmail = async (to: string, otp: string) => {
  const subject = "MEGS Password Reset Code";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-bottom: 16px;">Password Reset Request</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">We received a request to reset your MEGS account password. Use the 6-digit verification code below to proceed with the reset:</p>
      <div style="margin: 28px 0; text-align: center;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; background: #eff6ff; padding: 14px 28px; border-radius: 8px; border: 1px dashed #2563eb; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px;">This code expires in <strong>10 minutes</strong> and can only be used once.</p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">If you did not request a password reset, please ignore this email or contact support if you have security concerns.</p>
    </div>
  `;
  const text = `MEGS Password Reset Code: ${otp}\n\nThis code expires in 10 minutes.`;
  return sendMail(to, subject, text, html);
};

export const sendTAInvitationEmail = async (
  to: string,
  setupLink: string,
  firstName?: string
) => {
  const nameGreeting = firstName ? `Hello ${firstName},` : "Hello,";
  const subject = "Invitation: Join MEGS as Talent Acquisition Specialist";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-bottom: 16px;">MEGS Recruitment Management System</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">${nameGreeting}</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">You have been invited to join MEGS as a <strong>Talent Acquisition Specialist</strong>.</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">Please click the button below to set up your password and complete your secure account onboarding:</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${setupLink}" style="background-color: #0d9488; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">Complete TA Account Setup</a>
      </div>
      <p style="color: #64748b; font-size: 13px;">This secure invitation link is single-use and will expire in <strong>48 hours</strong>.</p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">If you were not expecting this invitation, please contact your organization administrator.</p>
    </div>
  `;
  const text = `MEGS TA Invitation:\n\n${nameGreeting}\nYou have been invited to join MEGS as a Talent Acquisition Specialist.\n\nPlease complete your account setup and create your password using this link:\n${setupLink}\n\nThis link is single-use and expires in 48 hours.`;
  return sendMail(to, subject, text, html);
};

