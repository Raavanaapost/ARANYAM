import {
  BookOpen,
  CalendarHeart,
  EyeOff,
  MessageCircleHeart,
  Newspaper,
  ShieldCheck,
  Sprout,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import Image from "next/image";
import { PageSlides } from "@/components/page-slides";
import { ButtonLink } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/i18n/format";
import { env } from "@/lib/env";
import { listPublicNews } from "@/lib/services/articles";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { absolute: `${t.meta.siteName} · ${t.meta.tagline}` },
    robots: { index: true, follow: true },
    alternates: { languages: { en: "/en", ta: "/ta" } },
  };
}

export default async function LandingPage() {
  const { locale, t } = await getI18n();
  const l = t.landing;

  const pillars = [
    { icon: ShieldCheck, title: l.privateTitle, body: l.privateBody },
    { icon: Sprout, title: l.hopeTitle, body: l.hopeBody },
    { icon: UsersRound, title: l.togetherTitle, body: l.togetherBody },
  ];
  const features = [
    { icon: MessageCircleHeart, label: l.featureThoughts },
    { icon: BookOpen, label: l.featureBlogs },
    { icon: CalendarHeart, label: l.featureEvents },
    { icon: UsersRound, label: l.featureGroups },
    { icon: Newspaper, label: l.featureNews },
  ];
  const steps = [l.step1, l.step2, l.step3, l.step4];

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:pt-10">
        <PageSlides page="landing" variant="hero">
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={`/${locale}/register`} size="lg">
              {l.ctaJoin}
            </ButtonLink>
            <ButtonLink href={`/${locale}/login`} size="lg" variant="secondary">
              {l.ctaLogin}
            </ButtonLink>
          </div>
        </PageSlides>
      </div>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[0.9fr_1.1fr] md:py-20">
        {/* The logo's colours are made for a light background, so it keeps one in dark mode too. */}
        <div className="mx-auto w-full max-w-md rounded-[2.5rem] bg-[#fbf8f1] p-6 shadow-[0_18px_50px_-30px_rgba(36,48,44,0.45)] ring-1 ring-line sm:p-8">
          <Image
            src="/brand/aranyam-logo.webp"
            alt={l.logoAlt}
            width={1000}
            height={661}
            sizes="(min-width: 768px) 28rem, 100vw"
            className="h-auto w-full"
          />
        </div>
        <div>
          <h1 className="text-[2rem] leading-tight text-ink sm:text-[2.6rem] sm:leading-[1.15]">{l.introTitle}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">{l.body}</p>
          <p className="mt-6 flex max-w-xl items-start gap-2.5 text-[0.95rem] text-muted">
            <EyeOff className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
            {l.trust}
          </p>
        </div>
      </section>

      <section className="border-y border-line/70 bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl text-ink sm:text-3xl">{l.pillarsTitle}</h2>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {pillars.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-3xl border border-line/70 bg-canvas p-7">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-xl text-ink">{title}</h3>
                <p className="mt-2 text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 md:grid-cols-2">
        <div>
          <h2 className="text-2xl text-ink sm:text-3xl">{l.featuresTitle}</h2>
          <ul className="mt-6 space-y-3">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3.5 rounded-2xl bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(29,43,37,0.05)]">
                <Icon className="size-5 shrink-0 text-accent" aria-hidden="true" />
                <span className="font-medium text-ink">{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl text-ink sm:text-3xl">{l.howTitle}</h2>
          <ol className="mt-6 space-y-4">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-on-primary">
                  {index + 1}
                </span>
                <p className="pt-1 text-ink">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Suspense fallback={null}>
        <LatestPublicNews />
      </Suspense>

      <section className="mx-auto w-full max-w-6xl px-4 pb-6">
        <div className="rounded-[2rem] bg-[linear-gradient(135deg,var(--primary),var(--primary-strong))] px-6 py-14 text-center text-on-primary sm:px-12">
          <h2 className="text-2xl sm:text-3xl">{l.closingTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg opacity-90">{l.closingBody}</p>
          <ButtonLink
            href={`/${locale}/register`}
            size="lg"
            variant="secondary"
            className="mt-8 border-transparent bg-canvas text-primary hover:bg-surface"
          >
            {l.ctaJoin}
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

/** News that moderators chose to share with everyone, for example new government schemes. */
async function LatestPublicNews() {
  await connection();
  const { locale, t } = await getI18n();
  const news = await listPublicNews(3);
  if (news.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl text-ink sm:text-3xl">{t.landing.latestNews}</h2>
        <Link href={`/${locale}/news`} className="font-semibold text-primary hover:underline">
          {t.common.seeAll}
        </Link>
      </div>
      <ul className="grid gap-5 md:grid-cols-3">
        {news.map((item) => (
          <li key={item.id}>
            <Link
              href={`/${locale}/news/${item.id}`}
              className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
            >
              <time className="text-sm text-muted" dateTime={item.publishedAt.toISOString()}>
                {formatDate(item.publishedAt, locale, env.timezone)}
              </time>
              <h3 className="mt-2 text-lg leading-snug text-ink">{item.title}</h3>
              {item.summary ? <p className="mt-2 line-clamp-3 text-muted">{item.summary}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
