import { db } from "@/lib/db";
import { devEmails } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";
import type { EmailContent } from "./render";

type Transporter = { sendMail: (message: Record<string, unknown>) => Promise<unknown> };

const globalForMail = globalThis as unknown as { __aranyamMailer?: Promise<Transporter> };

async function getSmtpTransport(): Promise<Transporter> {
  globalForMail.__aranyamMailer ??= import("nodemailer").then((nodemailer) =>
    nodemailer.createTransport(env.smtpUrl),
  );
  return globalForMail.__aranyamMailer;
}

function redact(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain ?? ""}`;
}

/**
 * Sends an email. Never throws: a failed email must not break registration or
 * a password reset request (members can always ask for the link again).
 * Returns whether the message was handed off.
 */
export async function sendEmail(to: string, content: EmailContent): Promise<boolean> {
  try {
    const transport = env.emailTransport;
    if (transport === "smtp") {
      const mailer = await getSmtpTransport();
      await mailer.sendMail({
        from: env.emailFrom,
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      return true;
    }
    if (transport === "dev" && env.devMailboxEnabled) {
      await db.insert(devEmails).values({
        id: newId(),
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      console.info(`[mail] "${content.subject}" to ${to} (read it at /en/dev/mailbox)`);
      return true;
    }
    // Production without SMTP: log that an email was skipped, but never its
    // contents, because they can contain sign-in links.
    console.warn(
      `[mail] Not sent: SMTP_URL is not configured. "${content.subject}" to ${redact(to)}`,
    );
    return false;
  } catch (error) {
    console.error(`[mail] Failed to send "${content.subject}" to ${redact(to)}`, error);
    return false;
  }
}
