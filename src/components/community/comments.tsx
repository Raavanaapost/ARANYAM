import { MessageCircle } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { deleteCommentAction } from "@/lib/actions/comments";
import { removeContentAction } from "@/lib/actions/moderation";
import type { Viewer } from "@/lib/auth/viewer";
import { listComments, type CommentTarget } from "@/lib/services/comments";
import { AuthorLine, RelativeTime, RichText } from "./basics";
import { CommentForm, ItemMenu } from "./interactive";

/**
 * Replies under a post, blog, news item or event. The caller has already
 * checked that the viewer may see the thing being discussed.
 */
export async function CommentSection({
  viewer,
  target,
  locale,
  t,
  title,
  canReply = true,
}: {
  viewer: Viewer;
  target: CommentTarget;
  locale: Locale;
  t: Dictionary;
  title?: string;
  canReply?: boolean;
}) {
  const comments = await listComments(viewer, target);
  return (
    <section id="comments" aria-labelledby="comments-title" className="scroll-mt-24">
      <h2 id="comments-title" className="mb-4 flex items-center gap-2 text-xl text-ink">
        <MessageCircle className="size-5 text-muted" aria-hidden="true" />
        {title ?? t.comments.title}
        {comments.length ? <span className="text-base font-semibold text-muted">({comments.length})</span> : null}
      </h2>

      {comments.length === 0 ? (
        <p className="mb-5 text-muted">{t.comments.empty}</p>
      ) : (
        <ol className="mb-6 space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              id={`comment-${comment.id}`}
              className="rounded-2xl bg-sunken/60 px-4 py-3.5"
              data-testid="comment"
            >
              <div className="flex items-start justify-between gap-3">
                <AuthorLine
                  author={comment.author}
                  isMine={comment.isMine}
                  locale={locale}
                  t={t}
                  size="sm"
                  meta={<RelativeTime date={comment.createdAt} locale={locale} t={t} />}
                />
                <ItemMenu
                  remove={
                    comment.canDelete
                      ? {
                          action: deleteCommentAction,
                          fields: { id: comment.id },
                          confirm: t.comments.deleteConfirm,
                          label: t.common.delete,
                        }
                      : comment.canRemove
                        ? {
                            action: removeContentAction,
                            fields: { type: "comment", id: comment.id },
                            confirm: t.common.removeConfirm,
                            label: t.common.remove,
                          }
                        : undefined
                  }
                  report={comment.isMine ? undefined : { targetType: "comment", targetId: comment.id }}
                />
              </div>
              <RichText text={comment.body} className="mt-2 pl-11 text-ink" />
            </li>
          ))}
        </ol>
      )}

      {canReply ? <CommentForm targetType={target.type} targetId={target.id} /> : null}
    </section>
  );
}
