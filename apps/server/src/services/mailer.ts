import nodemailer from 'nodemailer';
import { env } from '../env.js';

const transport = env.smtpUrl ? nodemailer.createTransport(env.smtpUrl) : null;

/**
 * Sends the password-reset link. Without SMTP_URL (local dev) the link is printed to the
 * server console instead, so the flow can be tested without an email provider.
 */
export async function sendPasswordReset(to: string, link: string) {
  if (!transport) {
    console.log(`[dev] SMTP_URL not set. Password reset link for ${to}:\n  ${link}`);
    return;
  }
  await transport.sendMail({
    from: env.mailFrom,
    to,
    subject: 'Reset your medify.Rx password',
    text:
      `Someone asked to reset the password for your medify.Rx account.\n\n` +
      `Choose a new password here (the link works once and expires in 30 minutes):\n${link}\n\n` +
      `If this wasn't you, you can ignore this email; your password won't change.`,
    html: resetEmailHtml(link),
  });
}

function resetEmailHtml(link: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#E9E9EC;font-family:Helvetica,Arial,sans-serif;color:#2F3040">
  <div style="max-width:480px;margin:0 auto;background:#EFEFF2;border-radius:24px;padding:36px 32px">
    <p style="margin:0 0 20px;font-size:22px;font-weight:600">medify<span style="color:#665C82">.Rx</span></p>
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:600">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#474859">
      Someone asked to reset the password for your medify.Rx account. Tap the button to choose a new one.
    </p>
    <a href="${link}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#595170;color:#fff;text-decoration:none;font-size:16px;font-weight:600">Reset password</a>
    <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#62626F">
      This link works once and expires in 30 minutes. If this wasn't you, ignore this email; your password won't change.
    </p>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#62626F;word-break:break-all">
      Button not working? Paste this into your browser:<br>${link}
    </p>
  </div>
</body></html>`;
}
