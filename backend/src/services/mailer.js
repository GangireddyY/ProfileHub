import { env } from '../config/env.js';

const SENDGRID_URL = 'https://api.sendgrid.com/v3/mail/send';

export const mailEnabled = () => Boolean(env.mail.sendgridKey && env.mail.fromEmail);

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const appLink = (path = '/') => `${env.appUrl}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * Simple, table-based layout that renders in every mail client.
 * `lines` are plain text paragraphs; `button` is { label, url }.
 */
function render({ heading, lines = [], button, footer }) {
  const paragraphs = lines
    .filter(Boolean)
    .map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#334155">${escapeHtml(l)}</p>`)
    .join('');
  const cta = button
    ? `<p style="margin:22px 0 8px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 20px;border-radius:8px">${escapeHtml(button.label)}</a></p>
       <p style="margin:0 0 4px;font-size:12px;color:#64748b">Or open this link: <a href="${escapeHtml(button.url)}" style="color:#2563eb;word-break:break-all">${escapeHtml(button.url)}</a></p>`
    : '';
  const note =
    footer ??
    'You get this email because you have a ProfileHUB account. You can choose which emails you receive in Settings → Notifications.';
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
<tr><td style="padding:22px 28px 8px;font-size:18px;font-weight:700;color:#0f172a">Profile<span style="color:#2563eb">HUB</span></td></tr>
<tr><td style="padding:8px 28px 24px">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a">${escapeHtml(heading)}</h1>
${paragraphs}${cta}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b">${escapeHtml(note)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [heading, '', ...lines.filter(Boolean), button ? `\n${button.label}: ${button.url}` : '', '', note].join('\n');
  return { html, text };
}

/**
 * Sends one email. Never throws: a failed email must not break the action that triggered it.
 * Returns true when SendGrid accepted the message (or it was printed in development).
 */
export async function sendEmail({ to, subject, heading, lines, button, footer }) {
  if (!to) return false;
  const { html, text } = render({ heading: heading || subject, lines, button, footer });
  if (!mailEnabled()) {
    console.log(`\n[email -> ${to}] ${subject}\n${text}\n`);
    return true;
  }
  try {
    const res = await fetch(SENDGRID_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.mail.sendgridKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.mail.fromEmail, name: env.mail.fromName },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
        tracking_settings: { click_tracking: { enable: false, enable_text: false } },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`Email to ${to} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Email to ${to} failed: ${err.message}`);
    return false;
  }
}
