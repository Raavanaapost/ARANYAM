import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostEditForm } from "@/components/community/editors";
import { Card, CardSection } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { requireMember } from "@/lib/auth/dal";
import { getPost } from "@/lib/services/posts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.posts.editTitle };
}

export default async function EditPostPage({ params }: PageProps<"/[lang]/posts/[id]/edit">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={t.posts.editTitle} />
      <Card>
        <CardSection>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <EditPost params={params} />
          </Suspense>
        </CardSection>
      </Card>
    </div>
  );
}

async function EditPost({ params }: Pick<PageProps<"/[lang]/posts/[id]/edit">, "params">) {
  const viewer = await requireMember();
  const { locale } = await getI18n();
  const { id } = await params;
  const post = await getPost(viewer, id);
  if (!post || !post.canEdit) notFound();
  return (
    <PostEditForm post={{ id: post.id, body: post.body, kind: post.kind }} cancelHref={`/${locale}/posts/${post.id}`} />
  );
}
