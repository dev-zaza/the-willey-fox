interface EmailContent {
  subject: string;
  body: string;
}

function unsubscribeFooter(unsubscribeUrl?: string): string {
  if (!unsubscribeUrl) return '';
  return `
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;">
      You're receiving this because you have an account with TheWileyfox.<br>
      <a href="${unsubscribeUrl}" style="color:#f97316;">Unsubscribe from email notifications</a>
    </p>
  `;
}

export function buildVerificationEmail(firstName: string, verifyUrl: string, unsubscribeUrl?: string): EmailContent {
  return {
    subject: 'Verify your TheWileyfox email',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to TheWileyfox, ${firstName}!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
            Verify Email
          </a>
        </p>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #6b7280;">${verifyUrl}</p>
        <p>This link expires in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">If you didn't create a TheWileyfox account, you can ignore this email.</p>
        ${unsubscribeFooter(unsubscribeUrl)}
      </div>
    `.trim(),
  };
}

export function buildPasswordResetEmail(firstName: string, resetUrl: string, unsubscribeUrl?: string): EmailContent {
  return {
    subject: 'Reset your TheWileyfox password',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hi ${firstName},</p>
        <p>We received a request to reset your password. Click the link below to choose a new one:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
        <p>This link expires in 1 hour.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">If you didn't request a password reset, you can ignore this email. Your password will remain unchanged.</p>
        ${unsubscribeFooter(unsubscribeUrl)}
      </div>
    `.trim(),
  };
}
