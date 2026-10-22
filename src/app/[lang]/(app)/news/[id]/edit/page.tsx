import type { Metadata } from "next";
import { ArticleEditorPage } from "@/components/community/article-pages";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.news.editorTitleEdit };
}

export default function EditNewsPage({ params }: PageProps<"/[lang]/news/[id]/edit">) {
  return <ArticleEditorPage type="news" params={params} />;
}
