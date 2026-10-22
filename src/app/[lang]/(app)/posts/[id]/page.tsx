import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostCard } from "@/components/community/cards";
import { CommentSection } from "@/components/community/comments";
import { Card, CardSection } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/misc";
import { format } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireMember } from "@/lib/auth/dal";
import { getPost } from "@/lib/services/posts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.posts.viewPost };
}

export default async function PostPage({ params }: PageProps<"/[lang]/posts/[id]">) {
  const { locale, t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href={`/${locale}/feed`} className="mb-4 inline-block font-semibold text-primary hover:underline">
        ← {t.nav.home}
      </Link>
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <Post params={params} />
      </Suspense>
    </div>
  );
}

async function Post({ params }: Pick<PageProps<"/[lang]/posts/[id]">, "params">) {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  const { id } = await params;
  const post = await getPost(viewer, id);
  if (!post) notFound();

  return (
    <div className="space-y-6">
      {post.group ? (
        <p className="rounded-2xl bg-sunken px-4 py-2.5 text-sm text-muted">
          {post.group.icon} {format(t.posts.groupOnlyNotice, { group: post.group.name })}
        </p>
      ) : null}
      <PostCard post={post} locale={locale} t={t} standalone />
      {post.removed ? null : (
        <Card>
          <CardSection>
            <CommentSection viewer={viewer} target={{ type: "post", id: post.id }} locale={locale} t={t} />
          </CardSection>
        </Card>
      )}
    </div>
  );
}
