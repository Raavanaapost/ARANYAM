import { BookHeart, PauseCircle, Sprout, UserRoundPen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard, AuthCardSkeleton } from "@/components/auth/auth-card";
import { LogoutButton } from "@/components/auth/logout-button";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.pending.title };
}

/** Where new families wait to be welcomed by a moderator. */
export default function PendingPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={2} />}>
      <PendingContent />
    </Suspense>
  );
}

async function PendingContent() {
  const { locale, t } = await getI18n();
  const viewer = await requireUser();
  if (!viewer.emailVerified) redirect(`/${locale}/verify-email`);
  if (viewer.status === "approved") redirect(`/${locale}/feed`);

  const footer = <LogoutButton locale={locale} label={t.nav.logout} className="flex justify-center" />;

  if (viewer.status === "suspended") {
    return (
      <AuthCard title={t.auth.pending.suspendedTitle} footer={footer}>
        <div className="space-y-4">
          <PauseCircle className="size-10 text-warning" aria-hidden="true" />
          <p className="text-ink">{t.auth.pending.suspendedBody}</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t.auth.pending.title} footer={footer}>
      <div className="space-y-5">
        <Sprout className="size-10 text-primary" aria-hidden="true" />
        <p className="text-ink">{t.auth.pending.body}</p>
        <div>
          <h2 className="mb-2 text-base font-semibold text-muted">{t.auth.pending.meanwhile}</h2>
          <ul className="space-y-2">
            <li>
              <Link
                href={`/${locale}/guidelines`}
                className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 font-semibold text-ink hover:bg-sunken"
              >
                <BookHeart className="size-5 text-primary" aria-hidden="true" />
                {t.auth.pending.readGuidelines}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/settings`}
                className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 font-semibold text-ink hover:bg-sunken"
              >
                <UserRoundPen className="size-5 text-primary" aria-hidden="true" />
                {t.auth.pending.setupProfile}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </AuthCard>
  );
}
