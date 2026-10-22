import type { Metadata } from "next";
import { ArticleDetailPage } from "@/components/community/article-pages";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.blogs.title };
}

export default function BlogsArticlePage({ params }: PageProps<"/[lang]/blogs/[id]">) {
  return <ArticleDetailPage type="blog" params={params} />;
}
