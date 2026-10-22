import type { Metadata } from "next";
import { ArticleDetailPage } from "@/components/community/article-pages";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.news.title };
}

export default function NewsArticlePage({ params }: PageProps<"/[lang]/news/[id]">) {
  return <ArticleDetailPage type="news" params={params} />;
}
