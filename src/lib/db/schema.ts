import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  USER_ROLES,
  USER_STATUSES,
  LOCALES,
  AUTH_TOKEN_PURPOSES,
  GROUP_PRIVACY,
  GROUP_ROLES,
  GROUP_MEMBER_STATUSES,
  POST_KINDS,
  ARTICLE_TYPES,
  ARTICLE_VISIBILITY,
  ARTICLE_STATUSES,
  EVENT_MODES,
  RSVP_STATUSES,
  REACTION_KINDS,
  NOTIFICATION_TYPES,
  REPORT_TARGETS,
  REPORT_REASONS,
  REPORT_STATUSES,
} from "../constants";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });


export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailVerifiedAt: ts("email_verified_at"),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    location: text("location").notNull().default(""),
    locale: text("locale", { enum: LOCALES }).notNull().default("en"),
    role: text("role", { enum: USER_ROLES }).notNull().default("member"),
    status: text("status", { enum: USER_STATUSES })
      .notNull()
      .default("pending"),
    joinNote: text("join_note").notNull().default(""),
    avatarHue: integer("avatar_hue").notNull().default(150),
    invitedById: text("invited_by_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    inviteId: text("invite_id").references((): AnyPgColumn => invites.id, {
      onDelete: "set null",
    }),
    approvedAt: ts("approved_at"),
    approvedById: text("approved_by_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_key").on(t.email),
    index("users_status_idx").on(t.status),
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the cookie token, so a database leak cannot be replayed.
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: createdAt(),
    lastUsedAt: ts("last_used_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);


export const authTokens = pgTable(
  "auth_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose", { enum: AUTH_TOKEN_PURPOSES }).notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId, t.purpose)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: ts("window_start").notNull(),
});

export const invites = pgTable(
  "invites",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" }),
    note: text("note").notNull().default(""),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("invites_code_key").on(t.code),
    index("invites_creator_idx").on(t.createdById),
  ],
);


export const groups = pgTable(
  "groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    privacy: text("privacy", { enum: GROUP_PRIVACY }).notNull().default("open"),
    icon: text("icon").notNull().default("🌳"),
    color: text("color").notNull().default("green"),
    inviteCode: text("invite_code").notNull(),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("groups_invite_code_key").on(t.inviteCode)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: GROUP_ROLES }).notNull().default("member"),
    status: text("status", { enum: GROUP_MEMBER_STATUSES })
      .notNull()
      .default("active"),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("group_members_user_idx").on(t.userId),
  ],
);


export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    kind: text("kind", { enum: POST_KINDS }).notNull().default("thought"),
    body: text("body").notNull(),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    editedAt: ts("edited_at"),
    removedAt: ts("removed_at"),
    removedById: text("removed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("posts_created_idx").on(t.createdAt),
    index("posts_group_idx").on(t.groupId, t.createdAt),
    index("posts_author_idx").on(t.authorId),
  ],
);


export const articles = pgTable(
  "articles",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ARTICLE_TYPES }).notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    visibility: text("visibility", { enum: ARTICLE_VISIBILITY })
      .notNull()
      .default("members"),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    status: text("status", { enum: ARTICLE_STATUSES })
      .notNull()
      .default("draft"),
    sourceUrl: text("source_url").notNull().default(""),
    publishedAt: ts("published_at"),
    removedAt: ts("removed_at"),
    removedById: text("removed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("articles_feed_idx").on(t.type, t.status, t.publishedAt),
    index("articles_author_idx").on(t.authorId),
  ],
);


export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at"),
    mode: text("mode", { enum: EVENT_MODES }).notNull().default("in_person"),
    city: text("city").notNull().default(""),
    // Only shown to the organiser and to members who have responded.
    venue: text("venue").notNull().default(""),
    onlineUrl: text("online_url").notNull().default(""),
    capacity: integer("capacity"),
    features: text("features").array().notNull().default(sql`'{}'::text[]`),
    groupId: text("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cancelledAt: ts("cancelled_at"),
    removedAt: ts("removed_at"),
    removedById: text("removed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("events_starts_idx").on(t.startsAt),
    index("events_group_idx").on(t.groupId),
  ],
);


export const eventRsvps = pgTable(
  "event_rsvps",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: RSVP_STATUSES }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.userId] }),
    index("event_rsvps_user_idx").on(t.userId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id").references(() => posts.id, {
      onDelete: "cascade",
    }),
    articleId: text("article_id").references(() => articles.id, {
      onDelete: "cascade",
    }),
    eventId: text("event_id").references(() => events.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    removedAt: ts("removed_at"),
    removedById: text("removed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("comments_post_idx").on(t.postId),
    index("comments_article_idx").on(t.articleId),
    index("comments_event_idx").on(t.eventId),
    check(
      "comments_single_target",
      sql`num_nonnulls(${t.postId}, ${t.articleId}, ${t.eventId}) = 1`,
    ),
  ],
);


export const postReactions = pgTable(
  "post_reactions",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: REACTION_KINDS }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId, t.kind] })],
);

export const articleReactions = pgTable(
  "article_reactions",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: REACTION_KINDS }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.userId, t.kind] })],
);


export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: NOTIFICATION_TYPES }).notNull(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorAnonymous: boolean("actor_anonymous").notNull().default(false),
    // Path inside the app without the language prefix, e.g. /posts/abc.
    link: text("link").notNull().default(""),
    data: jsonb("data").$type<Record<string, string>>().notNull().default({}),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);


export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetType: text("target_type", { enum: REPORT_TARGETS }).notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason", { enum: REPORT_REASONS }).notNull(),
    details: text("details").notNull().default(""),
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("open"),
    resolution: text("resolution").notNull().default(""),
    resolvedById: text("resolved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull().default(""),
    targetId: text("target_id").notNull().default(""),
    details: jsonb("details")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

// Only written to in development, so emails can be read at /dev/mailbox.
export const devEmails = pgTable("dev_emails", {
  id: text("id").primaryKey(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  text: text("text").notNull(),
  html: text("html").notNull(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;

export * from "../constants";
