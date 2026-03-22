import { Resend } from "resend";

// Initialise the Resend client with our API key from .env
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── SEND VERIFICATION EMAIL ──────────────────────────────────────────────────
// Sends a "verify your email" link to a newly registered user.
// The raw token is embedded in the URL — the frontend reads it from the URL
// and passes it to POST /api/auth/verify-email/:token
export const sendVerificationEmail = async (
  to: string,
  firstName: string,
  rawToken: string
): Promise<void> => {
  const url = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM as string,
    to,
    subject: "Verify your Vendorly account",
    html: `
      <h2>Hi ${firstName},</h2>
      <p>Thanks for signing up! Please verify your email address by clicking the link below:</p>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
        Verify Email
      </a>
      <p>Or copy and paste this link into your browser:</p>
      <p>${url}</p>
      <p><strong>This link expires in 24 hours.</strong></p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `,
  });
};

// ─── SEND PASSWORD RESET EMAIL ────────────────────────────────────────────────
// Sends a "reset your password" link.
// The raw token is embedded in the URL — the frontend reads it and passes it
// to POST /api/auth/reset-password/:token along with the new password.
export const sendPasswordResetEmail = async (
  to: string,
  firstName: string,
  rawToken: string
): Promise<void> => {
  const url = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM as string,
    to,
    subject: "Reset your Vendorly password",
    html: `
      <h2>Hi ${firstName},</h2>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
        Reset Password
      </a>
      <p>Or copy and paste this link into your browser:</p>
      <p>${url}</p>
      <p><strong>This link expires in 1 hour.</strong></p>
      <p>If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
    `,
  });
};
