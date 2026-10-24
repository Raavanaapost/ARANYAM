/**
 * Fixed lists of values stored in the database. Kept apart from the schema so
 * browser code can use them without loading the database library.
 */

export const USER_ROLES = ["member", "moderator", "admin"] as const;
export const USER_STATUSES = ["pending", "approved", "suspended"] as const;
export const LOCALES = ["en", "ta"] as const;
export const GROUP_PRIVACY = ["open", "private", "hidden"] as const;
export const GROUP_ROLES = ["owner", "admin", "member"] as const;
export const GROUP_MEMBER_STATUSES = ["active", "pending"] as const;
export const POST_KINDS = ["thought", "question", "celebration", "tip"] as const;
export const ARTICLE_TYPES = ["blog", "news"] as const;
export const ARTICLE_VISIBILITY = ["members", "public"] as const;
export const ARTICLE_STATUSES = ["draft", "published"] as const;
export const EVENT_MODES = ["in_person", "online"] as const;
export const EVENT_FEATURES = [
  "sensory_friendly",
  "wheelchair",
  "siblings_welcome",
  "parents_only",
  "free",
] as const;
export const RSVP_STATUSES = ["going", "interested"] as const;
export const REACTION_KINDS = ["support", "hug", "same"] as const;
export const NOTIFICATION_TYPES = [
  "comment_on_post",
  "comment_on_article",
  "comment_on_event",
  "membership_approved",
  "group_join_request",
  "group_join_approved",
  "event_rsvp",
] as const;
export const REPORT_TARGETS = [
  "post",
  "comment",
  "article",
  "event",
  "user",
] as const;
export const REPORT_REASONS = [
  "privacy",
  "harassment",
  "misinformation",
  "spam",
  "other",
] as const;
export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
/** Outside accounts families can join and log in with, when the site is set up for them. */
export const SOCIAL_PROVIDERS = ["google", "facebook"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type GroupPrivacy = (typeof GROUP_PRIVACY)[number];
export type GroupRole = (typeof GROUP_ROLES)[number];
export type PostKind = (typeof POST_KINDS)[number];
export type ReactionKind = (typeof REACTION_KINDS)[number];
export type EventFeature = (typeof EVENT_FEATURES)[number];
export type EventMode = (typeof EVENT_MODES)[number];
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export type ArticleType = (typeof ARTICLE_TYPES)[number];
export type ArticleVisibility = (typeof ARTICLE_VISIBILITY)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Icons and colours a group can choose. Members never upload pictures. */
export const GROUP_ICONS = ["🌳", "🌼", "🦋", "🧩", "🎨", "🎵", "🏫", "🤝", "💬", "🌈", "☀️", "🐘", "🪁", "📚", "🍃", "🏡"] as const;
export const GROUP_COLORS = ["green", "teal", "blue", "purple", "rose", "amber", "earth"] as const;
export type GroupColor = (typeof GROUP_COLORS)[number];

/** The hue (0-360) behind each group colour, used with the .hue-tile style. */
export const GROUP_HUES: Record<GroupColor, number> = {
  green: 155,
  teal: 190,
  blue: 245,
  purple: 300,
  rose: 10,
  amber: 75,
  earth: 45,
};

export function groupHue(color: string): number {
  return GROUP_HUES[color as GroupColor] ?? GROUP_HUES.green;
}
