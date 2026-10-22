import { NotFoundContent } from "@/components/shell/status-pages";
import { getLocale } from "@/i18n/server";

export default async function NotFound() {
  const locale = await getLocale();
  return <NotFoundContent homeHref={`/${locale}/feed`} />;
}
