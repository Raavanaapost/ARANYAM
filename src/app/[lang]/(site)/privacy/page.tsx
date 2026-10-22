import { Baby } from "lucide-react";
import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pages.privacy.title, robots: { index: true, follow: true } };
}

export default async function PrivacyPage() {
  const { t } = await getI18n();
  const page = t.pages.privacy;
  return (
    <ContentPage title={page.title} intro={page.intro} sections={page.sections}>
      <aside className="mt-12 flex gap-4 rounded-2xl bg-heart-soft p-5 sm:p-6">
        <Baby className="mt-1 size-6 shrink-0 text-heart" aria-hidden="true" />
        <div>
          <h2 className="text-xl text-ink">{page.childrenTitle}</h2>
          <p className="mt-1.5 text-ink/90">{page.childrenBody}</p>
        </div>
      </aside>
    </ContentPage>
  );
}
