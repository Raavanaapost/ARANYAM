import { desc } from "drizzle-orm";
import { Mail } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Fragment, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { devEmails } from "@/lib/db/schema";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Development mailbox" };

/**
 * Shows the emails the app would have sent, so sign-up and password reset can
 * be tried locally without an email server. Not available in production.
 */
export default function MailboxPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="flex items-center gap-3 text-2xl">
        <Mail className="size-7 text-primary" aria-hidden="true" />
        Development mailbox
      </h1>
      <p className="mt-2 text-muted">
        Emails are kept here instead of being sent, because EMAIL_TRANSPORT is &quot;dev&quot;. Newest first.
      </p>
      <Suspense fallback={<div className="mt-8"><ListSkeleton /></div>}>
        <Messages />
      </Suspense>
    </div>
  );
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function Linkified({ text }: { text: string }) {
  return text.split(URL_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={part} className="break-all font-semibold text-primary underline">
        {part}
      </a>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

async function Messages() {
  await connection();
  if (!env.devMailboxEnabled) notFound();
  const messages = await db.select().from(devEmails).orderBy(desc(devEmails.createdAt)).limit(50);
  if (messages.length === 0) {
    return <p className="mt-8 rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">No emails yet.</p>;
  }
  return (
    <ul className="mt-8 space-y-4">
      {messages.map((message) => (
        <li key={message.id}>
          <Card className="p-5" data-testid="dev-email">
            <p className="text-sm text-muted">
              To <span data-testid="dev-email-to">{message.to}</span> · {message.createdAt.toLocaleString("en-IN")}
            </p>
            <h2 className="mt-1 text-lg">{message.subject}</h2>
            <pre className="mt-3 font-sans text-[0.95rem] whitespace-pre-wrap text-ink">
              <Linkified text={message.text} />
            </pre>
          </Card>
        </li>
      ))}
    </ul>
  );
}
