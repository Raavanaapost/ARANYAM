"use client";

import { Flag, HandHeart, Heart, MoreHorizontal, Pencil, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useOptimistic, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dropdown, menuItemClass, SubmitButton } from "@/components/ui/client";
import { Checkbox, describedBy, Field, Select, Textarea } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { reactToArticleAction } from "@/lib/actions/articles";
import { addCommentAction } from "@/lib/actions/comments";
import { createReportAction } from "@/lib/actions/moderation";
import { createPostAction, reactToPostAction } from "@/lib/actions/posts";
import { cn } from "@/lib/cn";
import { POST_KINDS, REPORT_REASONS, type ReactionKind, type ReportTarget } from "@/lib/constants";
import { initialFormState } from "@/lib/form-state";
import type { ReactionSummary } from "@/lib/services/common";

function LangField() {
  const { locale } = useI18n();
  return <input type="hidden" name="lang" value={locale} />;
}

/* ------------------------------ Reactions ------------------------------ */

const reactionIcons: Record<ReactionKind, typeof Heart> = {
  support: HandHeart,
  hug: Heart,
  same: UsersRound,
};

/** Gentle reactions instead of "likes". Updates instantly and saves in the background. */
export function ReactionBar({
  id,
  target,
  reactions,
}: {
  id: string;
  target: "post" | "article";
  reactions: ReactionSummary;
}) {
  const { t } = useI18n();
  const [current, toggle] = useOptimistic(reactions, (state, kind: ReactionKind) => {
    const mine = state.mine.includes(kind);
    return {
      counts: { ...state.counts, [kind]: Math.max(0, state.counts[kind] + (mine ? -1 : 1)) },
      mine: mine ? state.mine.filter((k) => k !== kind) : [...state.mine, kind],
    };
  });
  const save = target === "post" ? reactToPostAction : reactToArticleAction;

  return (
    <div role="group" aria-label={t.posts.reactionsLabel} className="flex flex-wrap gap-1.5">
      {(Object.keys(reactionIcons) as ReactionKind[]).map((kind) => {
        const Icon = reactionIcons[kind];
        const active = current.mine.includes(kind);
        const count = current.counts[kind];
        return (
          <form
            key={kind}
            action={async (formData) => {
              toggle(kind);
              await save(formData);
            }}
          >
            <LangField />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="kind" value={kind} />
            <button
              type="submit"
              aria-pressed={active}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors",
                active
                  ? "border-transparent bg-heart-soft text-heart"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              <Icon className={cn("size-4", active && "fill-current")} aria-hidden="true" />
              <span>{t.posts.reactions[kind]}</span>
              {count ? <span className="tabular-nums">{count}</span> : null}
            </button>
          </form>
        );
      })}
    </div>
  );
}

/* -------------------------------- Menus -------------------------------- */

export type MenuCommand = {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  confirm: string;
  label: string;
};

/** The "…" menu on posts, comments, blogs and events. */
export function ItemMenu({
  editHref,
  remove,
  report,
}: {
  editHref?: string;
  remove?: MenuCommand;
  report?: { targetType: ReportTarget; targetId: string };
}) {
  const { t } = useI18n();
  const [reporting, setReporting] = useState(false);
  if (!editHref && !remove && !report) return null;
  return (
    <>
      <Dropdown
        label={t.common.actions}
        triggerClassName="flex size-9 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"
        trigger={<MoreHorizontal className="size-5" aria-hidden="true" />}
      >
        {editHref ? (
          <Link href={editHref} className={menuItemClass}>
            <Pencil className="size-4 text-muted" aria-hidden="true" />
            {t.common.edit}
          </Link>
        ) : null}
        {remove ? (
          <form action={remove.action}>
            <LangField />
            {Object.entries(remove.fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <SubmitButton
              variant="danger-ghost"
              confirm={remove.confirm}
              className="h-auto w-full justify-start rounded-xl px-3 py-2.5 text-[0.95rem] font-normal"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {remove.label}
            </SubmitButton>
          </form>
        ) : null}
        {report ? (
          <button type="button" data-close-menu className={menuItemClass} onClick={() => setReporting(true)}>
            <Flag className="size-4 text-muted" aria-hidden="true" />
            {t.report.button}
          </button>
        ) : null}
      </Dropdown>
      {report && reporting ? (
        <ReportDialog targetType={report.targetType} targetId={report.targetId} onClose={() => setReporting(false)} />
      ) : null}
    </>
  );
}

/* ------------------------------- Reports ------------------------------- */

export function ReportDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: ReportTarget;
  targetId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, action] = useActionState(createReportAction, initialFormState);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog ref={ref} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <div className="p-6">
        <h2 id={titleId} className="text-xl">
          {t.report.title}
        </h2>
        <p className="mt-1 text-[0.95rem] text-muted">{t.report.intro}</p>
        {state.status === "success" ? (
          <div className="mt-5 space-y-5">
            <Alert tone="success">{state.message}</Alert>
            <Button variant="secondary" className="w-full" onClick={() => ref.current?.close()}>
              {t.common.close}
            </Button>
          </div>
        ) : (
          <form action={action} className="mt-5 space-y-5">
            <LangField />
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />
            {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
            <fieldset>
              <legend className="mb-2 font-semibold text-ink">{t.report.reasonLabel}</legend>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason, index) => (
                  <label
                    key={reason}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3.5 py-2.5 has-checked:border-primary has-checked:bg-primary-soft"
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason}
                      defaultChecked={index === 0}
                      className="mt-1 size-4 accent-primary"
                    />
                    <span className="text-[0.95rem] text-ink">{t.report.reasons[reason]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field id={`${titleId}-details`} label={t.report.detailsLabel} optionalLabel={t.common.optional}>
              <Textarea id={`${titleId}-details`} name="details" rows={3} maxLength={1000} />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => ref.current?.close()}>
                {t.common.cancel}
              </Button>
              <SubmitButton variant="danger" pendingLabel={t.common.loading}>
                <Flag className="size-4" aria-hidden="true" />
                {t.report.submit}
              </SubmitButton>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

/* ------------------------------- Composer ------------------------------ */

export type ComposerGroup = { id: string; name: string; icon: string };

/** Where members share a thought, question, celebration or tip. */
export function Composer({
  groups,
  lockedGroup,
  placeholder,
}: {
  /** Groups the member may post in (for the audience picker on the home feed). */
  groups: ComposerGroup[];
  /** On a group page, posts always go to that group. */
  lockedGroup?: ComposerGroup;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(createPostAction, initialFormState);
  const id = useId();
  const error = state.fieldErrors?.body;
  const values = state.status === "error" ? state.values : undefined;
  const kind = values?.kind ?? "thought";

  return (
    <form action={action} className="space-y-4" noValidate>
      <LangField />
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <div>
        <label htmlFor={`${id}-body`} className="sr-only">
          {t.posts.composerTitle}
        </label>
        <Textarea
          id={`${id}-body`}
          name="body"
          rows={3}
          maxLength={5000}
          placeholder={placeholder ?? t.posts.placeholder}
          defaultValue={values?.body}
          invalid={Boolean(error)}
          aria-describedby={describedBy(`${id}-body`, null, error)}
          className="text-[1.02rem]"
        />
        {error ? (
          <p id={`${id}-body-error`} className="mt-1.5 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-muted">{t.posts.kindLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {POST_KINDS.map((option) => (
            <label key={option} className="cursor-pointer">
              <input type="radio" name="kind" value={option} defaultChecked={kind === option} className="peer sr-only" />
              <span className="inline-flex rounded-full border border-line-strong px-3.5 py-1.5 text-sm font-semibold text-ink peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:outline-3 peer-focus-visible:outline-focus">
                {t.posts.kinds[option]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          {lockedGroup ? (
            <input type="hidden" name="audience" value={lockedGroup.id} />
          ) : groups.length ? (
            <div className="flex items-center gap-2.5">
              <label htmlFor={`${id}-audience`} className="text-sm font-semibold whitespace-nowrap text-muted">
                {t.posts.audience}
              </label>
              <Select id={`${id}-audience`} name="audience" defaultValue={values?.audience ?? "all"} className="h-10 text-sm">
                <option value="all">{t.posts.everyone}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.icon} {format(t.posts.audienceGroup, { group: group.name })}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <input type="hidden" name="audience" value="all" />
          )}
          <Checkbox
            id={`${id}-anonymous`}
            name="anonymous"
            defaultChecked={values?.anonymous === "on"}
            label={t.posts.anonymous}
            hint={t.posts.anonymousHint}
          />
        </div>
        <SubmitButton className="shrink-0 sm:min-w-32" pendingLabel={t.posts.submitting}>
          {t.posts.submit}
        </SubmitButton>
      </div>
    </form>
  );
}

/* ------------------------------- Comments ------------------------------ */

export function CommentForm({ targetType, targetId }: { targetType: "post" | "article" | "event"; targetId: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(addCommentAction, initialFormState);
  const id = useId();
  const error = state.fieldErrors?.body;
  const values = state.status === "error" ? state.values : undefined;
  return (
    <form action={action} className="space-y-3" noValidate>
      <LangField />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <label htmlFor={`${id}-body`} className="sr-only">
        {t.comments.placeholder}
      </label>
      <Textarea
        id={`${id}-body`}
        name="body"
        rows={2}
        maxLength={2000}
        placeholder={t.comments.placeholder}
        defaultValue={values?.body}
        invalid={Boolean(error)}
        aria-describedby={describedBy(`${id}-body`, null, error)}
      />
      {error ? (
        <p id={`${id}-body-error`} className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Checkbox
          id={`${id}-anonymous`}
          name="anonymous"
          defaultChecked={values?.anonymous === "on"}
          label={t.comments.anonymous}
        />
        <SubmitButton size="sm" pendingLabel={t.common.loading}>
          {t.comments.submit}
        </SubmitButton>
      </div>
    </form>
  );
}
