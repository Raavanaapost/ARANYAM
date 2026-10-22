import type { Metadata } from "next";
import { ArticleEditorPage } from "@/components/community/article-pages";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.blogs.editorTitleEdit };
}

export default function EditBlogsPage({ params }: PageProps<"/[lang]/blogs/[id]/edit">) {
  return <ArticleEditorPage type="blog" params={params} />;
}
