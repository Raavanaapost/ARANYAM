import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { PageSlides } from "@/components/page-slides";
import { ButtonLink } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pages.about.title, robots: { index: true, follow: true } };
}

export default async function AboutPage() {
  const { locale, t } = await getI18n();
  const page = t.pages.about;
  return (
    <ContentPage
      title={page.title}
      intro={page.intro}
      sections={page.sections}
      banner={<PageSlides page="about" />}
    >
      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={`/${locale}/register`} size="lg">
          {t.landing.ctaJoin}
        </ButtonLink>
        <ButtonLink href={`/${locale}/privacy`} size="lg" variant="secondary">
          {t.pages.privacy.title}
        </ButtonLink>
      </div>
    </ContentPage>
  );
}
