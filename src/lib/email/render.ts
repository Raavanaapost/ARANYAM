import type { Locale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";

export type EmailContent = { subject: string; text: string; html: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EmailParts = {
  locale: Locale;
  subject: string;
  name?: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  links?: { label: string; url: string }[];
  notes?: string[];
};

/**
 * Builds a plain, accessible email in both text and HTML form. Subjects are
 * deliberately neutral, because notifications are often seen by others on a
 * shared phone or inbox.
 */
export function renderEmail(parts: EmailParts): EmailContent {
  const t = getDictionaryFor(parts.locale).email;
  const greeting = parts.name ? format(t.greeting, { name: parts.name }) : "";

  const text = [
    greeting,
    ...parts.paragraphs,
    parts.button ? `${parts.button.label}: ${parts.button.url}` : "",
    ...(parts.links ?? []).map((link) => `${link.label}: ${link.url}`),
    ...(parts.notes ?? []),
    t.signoff,
  ]
    .filter(Boolean)
    .join("\n\n");

  const font = `'Mukta Malar','Noto Sans Tamil','Latha',Arial,sans-serif`;
  const p = (content: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1d2b25;font-family:${font}">${content}</p>`;
  const button = parts.button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(parts.button.url)}" style="display:inline-block;background:#2f6a5a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;font-family:${font};font-size:16px">${escapeHtml(parts.button.label)}</a></p>`
    : "";
  const links = (parts.links ?? [])
    .map((link) =>
      p(`<a href="${escapeHtml(link.url)}" style="color:#2f6a5a">${escapeHtml(link.label)}</a>`),
    )
    .join("");
  const notes = (parts.notes ?? [])
    .map(
      (note) =>
        `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#5e6b64;font-family:${font}">${escapeHtml(note)}</p>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="${parts.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(parts.subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f4ee">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ee;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6dfd0;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#2f6a5a;font-family:${font}">Aranyam <span style="color:#b85f27">Together</span></p>
${greeting ? p(escapeHtml(greeting)) : ""}
${parts.paragraphs.map((para) => p(escapeHtml(para))).join("")}
${button}
${links}
${notes}
${p(escapeHtml(t.signoff).replace(/\n/g, "<br>"))}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: parts.subject, text, html };
}

/** Adds the community's name to a subject, unless the subject already says it. */
function subjectLine(subject: string): string {
  return subject.includes("Aranyam Together") ? subject : `${subject} · Aranyam Together`;
}

export function verifyEmailMessage(locale: Locale, name: string, url: string): EmailContent {
  const t = getDictionaryFor(locale).email;
  return renderEmail({
    locale,
    subject: subjectLine(t.verify.subject),
    name,
    paragraphs: [t.verify.body],
    button: { label: t.verify.button, url },
    notes: [t.verify.expiry, t.ignore],
  });
}

export function resetPasswordMessage(locale: Locale, name: string, url: string): EmailContent {
  const t = getDictionaryFor(locale).email;
  return renderEmail({
    locale,
    subject: subjectLine(t.reset.subject),
    name,
    paragraphs: [t.reset.body],
    button: { label: t.reset.button, url },
    notes: [t.reset.expiry, t.ignore],
  });
}

export function existingAccountMessage(
  locale: Locale,
  name: string,
  loginUrl: string,
  resetUrl: string,
): EmailContent {
  const t = getDictionaryFor(locale).email;
  return renderEmail({
    locale,
    subject: subjectLine(t.existing.subject),
    name,
    paragraphs: [t.existing.body],
    button: { label: t.existing.login, url: loginUrl },
    links: [{ label: t.existing.reset, url: resetUrl }],
    notes: [t.ignore],
  });
}

export function approvedMessage(locale: Locale, name: string, url: string): EmailContent {
  const t = getDictionaryFor(locale).email;
  return renderEmail({
    locale,
    subject: subjectLine(t.approved.subject),
    name,
    paragraphs: [t.approved.body],
    button: { label: t.approved.button, url },
  });
}

export function declinedMessage(locale: Locale, name: string): EmailContent {
  const t = getDictionaryFor(locale).email;
  return renderEmail({
    locale,
    subject: subjectLine(t.declined.subject),
    name,
    paragraphs: [t.declined.body],
  });
}
