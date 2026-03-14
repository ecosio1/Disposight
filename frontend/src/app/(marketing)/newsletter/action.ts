"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || "";

export type NewsletterState = {
  success: boolean;
  error: string | null;
};

export async function subscribeToNewsletter(
  _prev: NewsletterState,
  formData: FormData
): Promise<NewsletterState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  try {
    if (AUDIENCE_ID) {
      await resend.contacts.create({
        audienceId: AUDIENCE_ID,
        email,
        unsubscribed: false,
      });
    }

    // Send welcome / confirmation email
    await resend.emails.send({
      from: "DispoSight <no-reply@disposight.com>",
      to: email,
      subject: "You're in — weekly distress signals start next Monday",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#111111;border-radius:8px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr><td style="padding:24px 32px 16px;border-bottom:1px solid #2a2a2a;">
          <span style="font-size:18px;font-weight:700;color:#10b981;">DispoSight</span>
          <span style="font-size:13px;color:#888;margin-left:8px;">Weekly Digest</span>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#e5e5e5;">You're on the list.</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#a3a3a3;line-height:1.7;">
            Every Monday, you'll get a curated summary of the week's highest-impact distress signals — WARN filings, bankruptcy triggers, SEC disclosures, and facility closures.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.7;">
            No fluff. Just the signals that matter for deal sourcing.
          </p>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:#10b981;border-radius:6px;">
              <a href="https://disposight.com/blog" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Read the Blog</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #2a2a2a;">
          <p style="margin:0;font-size:12px;color:#666;">
            You signed up at disposight.com. Reply to this email anytime to unsubscribe.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    });

    // Notify team
    await resend.emails.send({
      from: "DispoSight <no-reply@disposight.com>",
      to: "support@disposight.com",
      subject: `[Newsletter] New subscriber: ${email}`,
      html: `<p>New newsletter subscriber: <strong>${email}</strong></p><p>Subscribed at ${new Date().toISOString()}</p>`,
    });

    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
