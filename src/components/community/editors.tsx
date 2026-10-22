"use client";

import { Eye, Lock, Monitor, MapPin, PencilLine } from "lucide-react";
import { useActionState, useId, useState, type CSSProperties } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client";
import { Checkbox, describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { saveArticleAction } from "@/lib/actions/articles";
import { saveEventAction } from "@/lib/actions/events";
import { saveGroupAction } from "@/lib/actions/groups";
import { updatePostAction } from "@/lib/actions/posts";
import { cn } from "@/lib/cn";
import {
  EVENT_FEATURES,
  EVENT_MODES,
  GROUP_COLORS,
  GROUP_ICONS,
  GROUP_PRIVACY,
  groupHue,
  POST_KINDS,
  type ArticleType,
  type ArticleVisibility,
  type EventMode,
  type GroupPrivacy,
  type PostKind,
} from "@/lib/constants";
import { initialFormState, type FormState } from "@/lib/form-state";
import { Markdown } from "./markdown";

function LangField() {
  const { locale } = useI18n();
  return <input type="hidden" name="lang" value={locale} />;
}

/** Values to show after a failed save, falling back to what is stored. */
function useValues(state: FormState, stored: Record<string, string | undefined>) {
  return (name: string) => state.values?.[name] ?? stored[name] ?? "";
}

function FormActions({ cancelHref, children }: { cancelHref: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
      <ButtonLink href={cancelHref} variant="ghost">
        {t.common.cancel}
      </ButtonLink>
      {children}
    </div>
  );
}

const pillClass =
  "inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3.5 py-1.5 text-sm font-semibold text-ink peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:outline-3 peer-focus-visible:outline-focus";

/* --------------------------------- Posts -------------------------------- */

export function PostEditForm({
  post,
  cancelHref,
}: {
  post: { id: string; body: string; kind: PostKind };
  cancelHref: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const [state, action] = useActionState(updatePostAction, initialFormState);
  const value = useValues(state, { body: post.body, kind: post.kind });
  const error = state.fieldErrors?.body;
  return (
    <form action={action} className="space-y-5" noValidate>
      <LangField />
      <input type="hidden" name="id" value={post.id} />
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field id={`${id}-body`} label={t.posts.composerTitle} error={error}>
        <Textarea
          id={`${id}-body`}
          name="body"
          rows={8}
          maxLength={5000}
          defaultValue={value("body")}
          invalid={Boolean(error)}
          aria-describedby={describedBy(`${id}-body`, null, error)}
        />
      </Field>
      <fieldset>
        <legend className="mb-2 font-semibold text-ink">{t.posts.kindLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {POST_KINDS.map((kind) => (
            <label key={kind}>
              <input type="radio" name="kind" value={kind} defaultChecked={value("kind") === kind} className="peer sr-only" />
              <span className={pillClass}>{t.posts.kinds[kind]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormActions cancelHref={cancelHref}>
        <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
      </FormActions>
    </form>
  );
}

/* ---------------------------- Blogs and news ---------------------------- */

export type EditableArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string;
  visibility: ArticleVisibility;
  isAnonymous: boolean;
  sourceUrl: string;
  status: "draft" | "published";
};

/** Writing a blog or a news item, with a preview of the formatted text. */
export function ArticleEditor({
  type,
  article,
  cancelHref,
}: {
  type: ArticleType;
  article?: EditableArticle;
  cancelHref: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const [state, action] = useActionState(saveArticleAction, initialFormState);
  const value = useValues(state, {
    title: article?.title,
    summary: article?.summary,
    tags: article?.tags,
    sourceUrl: article?.sourceUrl,
    visibility: article?.visibility ?? "members",
    anonymous: article?.isAnonymous ? "on" : "",
  });
  const [body, setBody] = useState(article?.body ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const errors = state.fieldErrors ?? {};
  const isPublished = article?.status === "published";

  return (
    <form action={action} className="space-y-6" noValidate>
      <LangField />
      <input type="hidden" name="type" value={type} />
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field id={`${id}-title`} label={t.blogs.titleLabel} error={errors.title}>
        <Input
          id={`${id}-title`}
          name="title"
          maxLength={150}
          defaultValue={value("title")}
          invalid={Boolean(errors.title)}
          aria-describedby={describedBy(`${id}-title`, null, errors.title)}
          className="text-lg font-semibold"
        />
      </Field>

      <Field
        id={`${id}-summary`}
        label={t.blogs.summaryLabel}
        hint={t.blogs.summaryHint}
        optionalLabel={t.common.optional}
        error={errors.summary}
      >
        <Textarea
          id={`${id}-summary`}
          name="summary"
          rows={2}
          maxLength={300}
          defaultValue={value("summary")}
          invalid={Boolean(errors.summary)}
          aria-describedby={describedBy(`${id}-summary`, true, errors.summary)}
          className="min-h-0"
        />
      </Field>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label htmlFor={`${id}-body`} className="font-semibold text-ink">
            {type === "news" ? t.news.editorTitleNew : t.blogs.bodyLabel}
          </label>
          <div role="tablist" aria-label={t.blogs.bodyLabel} className="flex rounded-full bg-sunken p-1 text-sm font-semibold">
            {(
              [
                ["write", t.blogs.write_tab, PencilLine],
                ["preview", t.blogs.preview_tab, Eye],
              ] as const
            ).map(([name, label, Icon]) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                aria-controls={`${id}-${name}`}
                onClick={() => setTab(name)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
                  tab === name ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div id={`${id}-write`} role="tabpanel" hidden={tab !== "write"}>
          <Textarea
            id={`${id}-body`}
            name="body"
            rows={16}
            maxLength={50_000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            invalid={Boolean(errors.body)}
            aria-describedby={describedBy(`${id}-body`, true, errors.body)}
            className="font-[inherit] leading-relaxed"
          />
        </div>
        <div
          id={`${id}-preview`}
          role="tabpanel"
          hidden={tab !== "preview"}
          className="min-h-48 rounded-xl border border-line bg-canvas px-5 py-4"
        >
          {body.trim() ? <Markdown>{body}</Markdown> : <p className="text-muted">{t.blogs.previewEmpty}</p>}
        </div>
        <p id={`${id}-body-hint`} className="text-sm text-muted">
          {t.blogs.bodyHint}
        </p>
        {errors.body ? (
          <p id={`${id}-body-error`} className="text-sm font-medium text-danger" role="alert">
            {errors.body}
          </p>
        ) : null}
      </div>

      <Field id={`${id}-tags`} label={t.blogs.tagsLabel} hint={t.blogs.tagsHint} optionalLabel={t.common.optional}>
        <Input id={`${id}-tags`} name="tags" maxLength={400} defaultValue={value("tags")} aria-describedby={`${id}-tags-hint`} />
      </Field>

      {type === "news" ? (
        <>
          <Field
            id={`${id}-source`}
            label={t.news.sourceLabel}
            hint={t.news.sourceHint}
            optionalLabel={t.common.optional}
            error={errors.sourceUrl}
          >
            <Input
              id={`${id}-source`}
              name="sourceUrl"
              type="url"
              inputMode="url"
              placeholder="https://"
              maxLength={500}
              defaultValue={value("sourceUrl")}
              invalid={Boolean(errors.sourceUrl)}
              aria-describedby={describedBy(`${id}-source`, true, errors.sourceUrl)}
            />
          </Field>
          <fieldset>
            <legend className="mb-2 font-semibold text-ink">{t.news.visibilityLabel}</legend>
            <div className="space-y-2">
              {(
                [
                  ["members", t.news.visibilityMembers],
                  ["public", t.news.visibilityPublic],
                ] as const
              ).map(([option, label]) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3.5 py-3 has-checked:border-primary has-checked:bg-primary-soft"
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={option}
                    defaultChecked={value("visibility") === option}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="text-ink">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : (
        <Checkbox
          id={`${id}-anonymous`}
          name="anonymous"
          defaultChecked={value("anonymous") === "on"}
          label={t.blogs.anonymous}
          hint={t.blogs.anonymousHint}
        />
      )}

      <FormActions cancelHref={cancelHref}>
        <SubmitButton name="intent" value="draft" variant="secondary" pendingLabel={t.common.saving}>
          {isPublished ? t.blogs.unpublish : t.blogs.saveDraft}
        </SubmitButton>
        <SubmitButton name="intent" value="publish" pendingLabel={t.common.saving}>
          {isPublished ? t.blogs.update : t.blogs.publish}
        </SubmitButton>
      </FormActions>
    </form>
  );
}

/* -------------------------------- Events -------------------------------- */

export type EditableEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  start: string;
  end: string;
  mode: EventMode;
  city: string;
  venue: string;
  onlineUrl: string;
  capacity: string;
  features: string[];
};

export function EventForm({
  event,
  groups,
  defaultGroupId,
  zoneName,
  cancelHref,
}: {
  event?: EditableEvent;
  /** Groups the organiser can share a new event with. */
  groups: { id: string; name: string; icon: string }[];
  defaultGroupId?: string;
  zoneName: string;
  cancelHref: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const [state, action] = useActionState(saveEventAction, initialFormState);
  const value = useValues(state, {
    title: event?.title,
    description: event?.description,
    date: event?.date,
    start: event?.start ?? "10:00",
    end: event?.end,
    city: event?.city,
    venue: event?.venue,
    onlineUrl: event?.onlineUrl,
    capacity: event?.capacity,
    groupId: defaultGroupId,
    features: event?.features.join(","),
  });
  const [mode, setMode] = useState<EventMode>((state.values?.mode as EventMode | undefined) ?? event?.mode ?? "in_person");
  const errors = state.fieldErrors ?? {};
  const features = value("features").split(",");
  const zoneHint = format(t.events.timezoneNote, { zone: zoneName });

  return (
    <form action={action} className="space-y-6" noValidate>
      <LangField />
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field id={`${id}-title`} label={t.events.titleLabel} error={errors.title}>
        <Input
          id={`${id}-title`}
          name="title"
          maxLength={120}
          defaultValue={value("title")}
          invalid={Boolean(errors.title)}
          aria-describedby={describedBy(`${id}-title`, null, errors.title)}
        />
      </Field>

      <Field
        id={`${id}-description`}
        label={t.events.descriptionLabel}
        hint={t.events.descriptionHint}
        error={errors.description}
      >
        <Textarea
          id={`${id}-description`}
          name="description"
          rows={6}
          maxLength={5000}
          defaultValue={value("description")}
          invalid={Boolean(errors.description)}
          aria-describedby={describedBy(`${id}-description`, true, errors.description)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${id}-date`} label={t.events.dateLabel} error={errors.date}>
          <Input
            id={`${id}-date`}
            name="date"
            type="date"
            defaultValue={value("date")}
            invalid={Boolean(errors.date)}
            aria-describedby={describedBy(`${id}-date`, null, errors.date)}
          />
        </Field>
        <Field id={`${id}-start`} label={t.events.startLabel}>
          <Input id={`${id}-start`} name="start" type="time" defaultValue={value("start")} />
        </Field>
        <Field id={`${id}-end`} label={t.events.endLabel} optionalLabel={t.common.optional} error={errors.end}>
          <Input
            id={`${id}-end`}
            name="end"
            type="time"
            defaultValue={value("end")}
            invalid={Boolean(errors.end)}
            aria-describedby={describedBy(`${id}-end`, null, errors.end)}
          />
        </Field>
      </div>
      <p className="-mt-3 text-sm text-muted">{zoneHint}</p>

      <fieldset>
        <legend className="mb-2 font-semibold text-ink">{t.events.modeLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_MODES.map((option) => {
            const Icon = option === "online" ? Monitor : MapPin;
            return (
              <label key={option}>
                <input
                  type="radio"
                  name="mode"
                  value={option}
                  checked={mode === option}
                  onChange={() => setMode(option)}
                  className="peer sr-only"
                />
                <span className={pillClass}>
                  <Icon className="size-4" aria-hidden="true" />
                  {option === "online" ? t.events.online : t.events.inPerson}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div hidden={mode !== "in_person"} className="space-y-5">
        <Field
          id={`${id}-city`}
          label={t.events.cityLabel}
          hint={t.events.cityHint}
          optionalLabel={t.common.optional}
          error={errors.city}
        >
          <Input
            id={`${id}-city`}
            name="city"
            maxLength={80}
            defaultValue={value("city")}
            invalid={Boolean(errors.city)}
            aria-describedby={describedBy(`${id}-city`, true, errors.city)}
          />
        </Field>
        <Field
          id={`${id}-venue`}
          label={
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-4 text-muted" aria-hidden="true" />
              {t.events.venueLabel}
            </span>
          }
          hint={t.events.venueHint}
          optionalLabel={t.common.optional}
          error={errors.venue}
        >
          <Textarea
            id={`${id}-venue`}
            name="venue"
            rows={2}
            maxLength={300}
            defaultValue={value("venue")}
            invalid={Boolean(errors.venue)}
            aria-describedby={describedBy(`${id}-venue`, true, errors.venue)}
            className="min-h-0"
          />
        </Field>
      </div>

      <div hidden={mode !== "online"}>
        <Field
          id={`${id}-online`}
          label={
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-4 text-muted" aria-hidden="true" />
              {t.events.onlineUrlLabel}
            </span>
          }
          hint={t.events.onlineUrlHint}
          optionalLabel={t.common.optional}
          error={errors.onlineUrl}
        >
          <Input
            id={`${id}-online`}
            name="onlineUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            maxLength={500}
            defaultValue={value("onlineUrl")}
            invalid={Boolean(errors.onlineUrl)}
            aria-describedby={describedBy(`${id}-online`, true, errors.onlineUrl)}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={`${id}-capacity`}
          label={t.events.capacityLabel}
          hint={t.events.capacityHint}
          optionalLabel={t.common.optional}
          error={errors.capacity}
        >
          <Input
            id={`${id}-capacity`}
            name="capacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            defaultValue={value("capacity")}
            invalid={Boolean(errors.capacity)}
            aria-describedby={describedBy(`${id}-capacity`, true, errors.capacity)}
          />
        </Field>
        {event ? null : (
          <Field id={`${id}-group`} label={t.events.groupLabel}>
            <Select id={`${id}-group`} name="groupId" defaultValue={value("groupId")}>
              <option value="">{t.posts.everyone}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.icon} {format(t.posts.audienceGroup, { group: group.name })}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold text-ink">{t.events.featuresLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_FEATURES.map((feature) => (
            <label key={feature}>
              <input
                type="checkbox"
                name="features"
                value={feature}
                defaultChecked={features.includes(feature)}
                className="peer sr-only"
              />
              <span className={pillClass}>{t.events.features[feature]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormActions cancelHref={cancelHref}>
        <SubmitButton pendingLabel={t.common.saving}>{t.events.save}</SubmitButton>
      </FormActions>
    </form>
  );
}

/* -------------------------------- Groups -------------------------------- */

export type EditableGroup = {
  id: string;
  name: string;
  description: string;
  privacy: GroupPrivacy;
  icon: string;
  color: string;
};

export function GroupForm({ group, cancelHref }: { group?: EditableGroup; cancelHref: string }) {
  const { t } = useI18n();
  const id = useId();
  const [state, action] = useActionState(saveGroupAction, initialFormState);
  const value = useValues(state, {
    name: group?.name,
    description: group?.description,
    privacy: group?.privacy ?? "open",
    icon: group?.icon ?? GROUP_ICONS[0],
    color: group?.color ?? GROUP_COLORS[0],
  });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6" noValidate>
      <LangField />
      {group ? <input type="hidden" name="id" value={group.id} /> : null}
      {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state.status === "error" && state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field id={`${id}-name`} label={t.groups.nameLabel} error={errors.name}>
        <Input
          id={`${id}-name`}
          name="name"
          maxLength={60}
          defaultValue={value("name")}
          invalid={Boolean(errors.name)}
          aria-describedby={describedBy(`${id}-name`, null, errors.name)}
        />
      </Field>

      <Field id={`${id}-description`} label={t.groups.descriptionLabel} error={errors.description}>
        <Textarea
          id={`${id}-description`}
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={value("description")}
          invalid={Boolean(errors.description)}
          aria-describedby={describedBy(`${id}-description`, null, errors.description)}
        />
      </Field>

      <fieldset>
        <legend className="mb-2 font-semibold text-ink">{t.groups.privacyLabel}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {GROUP_PRIVACY.map((privacy) => (
            <label
              key={privacy}
              className="flex cursor-pointer flex-col gap-1 rounded-xl border border-line px-3.5 py-3 has-checked:border-primary has-checked:bg-primary-soft"
            >
              <span className="flex items-center gap-2 font-semibold text-ink">
                <input
                  type="radio"
                  name="privacy"
                  value={privacy}
                  defaultChecked={value("privacy") === privacy}
                  className="size-4 accent-primary"
                />
                {t.groups.privacy[privacy]}
              </span>
              <span className="text-sm text-muted">{t.groups.privacyHelp[privacy]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold text-ink">{t.groups.iconLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {GROUP_ICONS.map((icon) => (
            <label key={icon}>
              <input type="radio" name="icon" value={icon} defaultChecked={value("icon") === icon} className="peer sr-only" />
              <span className="flex size-11 cursor-pointer items-center justify-center rounded-xl border border-line-strong text-2xl peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:outline-3 peer-focus-visible:outline-focus">
                {icon}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold text-ink">{t.groups.colorLabel}</legend>
        <div className="flex flex-wrap gap-2.5">
          {GROUP_COLORS.map((color) => (
            <label key={color} title={t.groups.colors[color]}>
              <input
                type="radio"
                name="color"
                value={color}
                defaultChecked={value("color") === color}
                className="peer sr-only"
              />
              <span
                className="hue-tile flex size-10 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-3 peer-checked:ring-primary peer-focus-visible:outline-3 peer-focus-visible:outline-focus"
                style={{ "--hue": groupHue(color) } as CSSProperties}
              >
                <span className="sr-only">{t.groups.colors[color]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormActions cancelHref={cancelHref}>
        <SubmitButton pendingLabel={t.common.saving}>{group ? t.common.save : t.groups.create}</SubmitButton>
      </FormActions>
    </form>
  );
}
