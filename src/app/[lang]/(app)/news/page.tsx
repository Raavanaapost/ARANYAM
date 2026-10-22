import type { Metadata } from "next";
import { ArticleListPage } from "@/components/community/article-pages";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.news.title };
}

export default function NewsPage({ searchParams }: PageProps<"/[lang]/news">) {
  return <ArticleListPage type="news" searchParams={searchParams} />;
}
