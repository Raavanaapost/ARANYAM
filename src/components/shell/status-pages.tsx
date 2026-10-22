import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

/** The body of a "page not found" screen, shown inside whichever layout is around it. */
export async function NotFoundContent({ homeHref }: { homeHref?: string }) {
  const { locale, t } = await getI18n();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <SearchX className="size-12 text-primary" aria-hidden="true" />
      <h1 className="mt-5 text-2xl">{t.errors.notFoundTitle}</h1>
      <p className="mt-2 text-muted">{t.errors.notFoundBody}</p>
      <ButtonLink href={homeHref ?? `/${locale}`} className="mt-8">
        {t.errors.goHome}
      </ButtonLink>
    </div>
  );
}
