import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pages.guidelines.title, robots: { index: true, follow: true } };
}

export default async function GuidelinesPage() {
  const { t } = await getI18n();
  const page = t.pages.guidelines;
  return (
    <ContentPage title={page.title} intro={page.intro} sections={page.sections}>
      <p className="mt-12 rounded-2xl border border-line bg-surface p-5 text-muted">{page.closing}</p>
    </ContentPage>
  );
}
