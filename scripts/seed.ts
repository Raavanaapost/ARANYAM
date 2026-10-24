import "./_env";
import { count, sql } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { getDatabaseContext } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrate";
import {
  accounts,
  articleReactions,
  articles,
  auditLogs,
  comments,
  eventRsvps,
  events,
  groupMembers,
  groups,
  invites,
  notifications,
  postReactions,
  posts,
  reports,
  users,
  type ReactionKind,
} from "@/lib/db/schema";
import { newId, newInviteCode } from "@/lib/ids";
import { fromZonedParts, toZonedParts } from "@/lib/timezone";

/**
 * Fills an empty database with a small, believable community so every screen
 * can be tried out. Never run this against a real community's database.
 *
 *   npm run db:seed            # only when there are no accounts yet
 *   npm run db:seed -- --reset # empties every table first (not in production)
 *
 * Every demo account uses the password below.
 */
export const DEMO_PASSWORD = "aranyam-demo-2026";

const reset = process.argv.includes("--reset");

// The demo accounts share a published password, so they must never reach a
// community that real families can visit.
const appUrl = process.env.APP_URL || "http://localhost:3000";
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(appUrl).hostname);
if ((!isLocal || process.env.NODE_ENV === "production") && !process.argv.includes("--not-public")) {
  console.error(
    `Refusing to add demo accounts: APP_URL is ${appUrl}${process.env.NODE_ENV === "production" ? " and NODE_ENV=production" : ""}.\n` +
      "Everyone can read the demo password, so anyone could log in as the demo admin.\n" +
      "If this really is a private test copy, run again with --not-public.",
  );
  process.exit(1);
}

const context = getDatabaseContext();
const { db } = context;
await runMigrations(context);

if (reset) {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to empty the database while NODE_ENV=production.");
    process.exit(1);
  }
  await db.execute(
    sql.raw(
      `TRUNCATE TABLE audit_logs, reports, notifications, article_reactions, post_reactions, comments,
       event_rsvps, events, articles, posts, group_members, groups, accounts, verifications, sessions, rate_limits,
       dev_emails, users, invites RESTART IDENTITY CASCADE`,
    ),
  );
  console.info("Emptied all tables.");
} else {
  const [existing] = await db.select({ value: count() }).from(users);
  if ((existing?.value ?? 0) > 0) {
    console.info("The database already has accounts, so no demo data was added. Use --reset to start over.");
    await context.close();
    process.exit(0);
  }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const zone = process.env.APP_TIMEZONE || "Asia/Kolkata";
const ago = (ms: number) => new Date(now - ms);

/** A time on the community clock, `days` from today. */
function onDay(days: number, time: string): Date {
  const { date } = toZonedParts(new Date(now + days * DAY), zone);
  const instant = fromZonedParts(date, time, zone);
  if (!instant) throw new Error(`Bad demo time ${date} ${time}`);
  return instant;
}

/* --------------------------------- People -------------------------------- */

const passwordHash = await hashPassword(DEMO_PASSWORD);

type Person = {
  key: string;
  name: string;
  role?: "member" | "moderator" | "admin";
  status?: "approved" | "pending" | "suspended";
  verified?: boolean;
  locale?: "en" | "ta";
  hue: number;
  bio?: string;
  location?: string;
  joinNote?: string;
  joinedDaysAgo: number;
};

const people: Person[] = [
  {
    key: "meena",
    name: "Meena Sundaram",
    role: "admin",
    locale: "ta",
    hue: 155,
    bio: "ஒரு மகளின் அம்மா. ஆரண்யத்தின் தன்னார்வ ஒருங்கிணைப்பாளர். ஒவ்வொரு குடும்பமும் இங்கே பாதுகாப்பாக உணர வேண்டும் என்பதே என் ஆசை.",
    location: "Chennai",
    joinedDaysAgo: 120,
  },
  {
    key: "karthik",
    name: "Karthik Raman",
    role: "moderator",
    hue: 245,
    bio: "Dad of a 9-year-old with ADHD. Software engineer by day, volunteer moderator by night.",
    location: "Bengaluru",
    joinedDaysAgo: 110,
  },
  {
    key: "priya",
    name: "Priya Amma",
    hue: 10,
    bio: "Mother of a wonderful 6-year-old boy on the autism spectrum. We love trains, music and long walks.",
    location: "Anna Nagar, Chennai",
    joinedDaysAgo: 90,
  },
  {
    key: "lakshmi",
    name: "Lakshmi Venkat",
    locale: "ta",
    hue: 300,
    bio: "பேச்சுப் பயிற்சி பற்றிக் கற்றுக்கொண்டதை எல்லோருடனும் பகிர விரும்புகிறேன்.",
    location: "Madurai",
    joinedDaysAgo: 80,
  },
  { key: "arun", name: "Arun Kumar", hue: 190, location: "Coimbatore", joinedDaysAgo: 70 },
  {
    key: "fathima",
    name: "Fathima Begum",
    hue: 75,
    bio: "Learning every day with my daughter, who has Down syndrome. Tea and good books keep me going.",
    location: "Tiruchirappalli",
    joinedDaysAgo: 60,
  },
  { key: "selvi", name: "Selvi Murugan", locale: "ta", hue: 45, location: "Madurai", joinedDaysAgo: 40 },
  { key: "ravi", name: "Ravi Shankar", hue: 120, location: "Coimbatore", joinedDaysAgo: 35 },
  { key: "vijay", name: "Vijay Anand", hue: 30, location: "Salem", joinedDaysAgo: 3 },
  {
    key: "divya",
    name: "Divya Prakash",
    status: "pending",
    hue: 330,
    joinNote:
      "We live in Tirunelveli. Our son is 4 and was diagnosed with autism last month. A friend from the therapy centre told me about Aranyam.",
    joinedDaysAgo: 1,
  },
  {
    key: "anitha",
    name: "அனிதா ராஜன்",
    status: "pending",
    locale: "ta",
    hue: 210,
    joinNote: "என் மகளுக்கு செரிப்ரல் பால்சி உள்ளது. சென்னையில் உள்ள மற்ற பெற்றோர்களைச் சந்திக்க விரும்புகிறேன்.",
    joinedDaysAgo: 0.2,
  },
  { key: "ganesh", name: "Ganesh", status: "pending", verified: false, hue: 90, joinedDaysAgo: 0.5 },
];

const id: Record<string, string> = Object.fromEntries(people.map((person) => [person.key, newId()]));

await db.insert(users).values(
  people.map((person) => {
    const joined = ago(person.joinedDaysAgo * DAY);
    const approved = (person.status ?? "approved") === "approved";
    return {
      id: id[person.key],
      email: `${person.key}@aranyam.local`,
      emailVerified: person.verified !== false,
      displayName: person.name,
      bio: person.bio ?? "",
      location: person.location ?? "",
      locale: person.locale ?? "en",
      role: person.role ?? "member",
      status: person.status ?? "approved",
      joinNote: person.joinNote ?? "",
      avatarHue: person.hue,
      approvedAt: approved ? new Date(joined.getTime() + 3 * HOUR) : null,
      approvedById: approved && person.key !== "meena" ? id.meena : null,
      createdAt: joined,
      updatedAt: joined,
    };
  }),
);
// Passwords live in Better Auth's accounts table, as a "credential" account.
await db.insert(accounts).values(
  people.map((person) => ({
    id: id[person.key],
    accountId: id[person.key],
    providerId: "credential",
    userId: id[person.key],
    password: passwordHash,
  })),
);

/* --------------------------------- Groups -------------------------------- */

const group = {
  chennai: newId(),
  speech: newId(),
  coimbatore: newId(),
  dads: newId(),
};

await db.insert(groups).values([
  {
    id: group.chennai,
    name: "Chennai Autism Parents",
    description:
      "Families in and around Chennai raising autistic children. Meetups, school questions, therapy centres and a lot of encouragement.",
    privacy: "open",
    icon: "🧩",
    color: "teal",
    inviteCode: newInviteCode(),
    createdById: id.priya,
    createdAt: ago(85 * DAY),
  },
  {
    id: group.speech,
    name: "பேச்சுப் பயிற்சி குறிப்புகள் · Speech therapy tips",
    description: "Home activities, apps and questions about speech and language therapy, in Tamil and English.",
    privacy: "open",
    icon: "💬",
    color: "blue",
    inviteCode: newInviteCode(),
    createdById: id.lakshmi,
    createdAt: ago(75 * DAY),
  },
  {
    id: group.coimbatore,
    name: "Coimbatore Families",
    description: "A small, private circle of families in Coimbatore and Tiruppur. Ask to join and tell us a little about yourself.",
    privacy: "private",
    icon: "🌳",
    color: "green",
    inviteCode: newInviteCode(),
    createdById: id.arun,
    createdAt: ago(60 * DAY),
  },
  {
    id: group.dads,
    name: "Dads' Circle",
    description: "Fathers talking honestly. This group is hidden; members join with the invite link.",
    privacy: "hidden",
    icon: "🤝",
    color: "amber",
    inviteCode: newInviteCode(),
    createdById: id.ravi,
    createdAt: ago(30 * DAY),
  },
]);

const membership = (
  groupId: string,
  key: string,
  role: "owner" | "admin" | "member" = "member",
  status: "active" | "pending" = "active",
  note = "",
) => ({ groupId, userId: id[key], role, status, note, createdAt: ago(20 * DAY) });

await db.insert(groupMembers).values([
  membership(group.chennai, "priya", "owner"),
  membership(group.chennai, "meena", "admin"),
  membership(group.chennai, "lakshmi"),
  membership(group.chennai, "karthik"),
  membership(group.chennai, "fathima"),
  membership(group.speech, "lakshmi", "owner"),
  membership(group.speech, "fathima"),
  membership(group.speech, "selvi"),
  membership(group.speech, "priya"),
  membership(group.coimbatore, "arun", "owner"),
  membership(group.coimbatore, "ravi", "admin"),
  membership(group.coimbatore, "selvi", "member", "pending", "My sister lives in Coimbatore and we visit every month."),
  membership(group.dads, "ravi", "owner"),
  membership(group.dads, "arun"),
  membership(group.dads, "karthik"),
]);

/* ---------------------------------- Posts --------------------------------- */

type SeedPost = {
  key: string;
  author: string;
  kind: "thought" | "question" | "celebration" | "tip";
  body: string;
  hoursAgo: number;
  group?: string;
  anonymous?: boolean;
  reactions?: [string, ReactionKind][];
};

const seedPosts: SeedPost[] = [
  {
    key: "firstWord",
    author: "priya",
    kind: "celebration",
    body: "Today my son said “Amma” clearly for the first time, after two years of speech therapy. I cried in the car park. 🌱\n\nTo every parent still waiting: please don't give up. Small steps are still steps.",
    hoursAgo: 2,
    reactions: [
      ["lakshmi", "support"],
      ["meena", "hug"],
      ["fathima", "same"],
      ["karthik", "support"],
      ["arun", "hug"],
      ["selvi", "support"],
    ],
  },
  {
    key: "relatives",
    author: "selvi",
    kind: "question",
    anonymous: true,
    body: "எங்கள் மகனின் ஆட்டிசம் பற்றி உறவினர்களிடம் எப்படிச் சொல்வது? பலர் “வளர்ந்தால் சரியாகிவிடும்” என்று சொல்கிறார்கள். உங்கள் அனுபவம் என்ன?",
    hoursAgo: 5,
    reactions: [
      ["meena", "same"],
      ["arun", "same"],
      ["priya", "hug"],
    ],
  },
  {
    key: "pictureCards",
    author: "lakshmi",
    kind: "tip",
    group: group.speech,
    body: "Tip: we stuck picture cards on the fridge for breakfast choices (idli, dosa, pongal, upma). Pointing instead of guessing cut our morning meltdowns in half. Happy to share the printable set if anyone wants it.",
    hoursAgo: 26,
    reactions: [
      ["fathima", "support"],
      ["selvi", "support"],
    ],
  },
  {
    key: "heavyDay",
    author: "arun",
    kind: "thought",
    body: "Some days are heavy. Today was one of them. Grateful this space exists, where I don't have to explain anything.",
    hoursAgo: 30,
    reactions: [
      ["priya", "hug"],
      ["meena", "hug"],
      ["ravi", "same"],
    ],
  },
  {
    key: "udid",
    author: "karthik",
    kind: "tip",
    body: "Reminder: the UDID disability card can be applied for online now. It took us about six weeks from application to card. If you get stuck on any step, ask here. Several of us have been through it.",
    hoursAgo: 50,
    reactions: [["lakshmi", "support"]],
  },
  {
    key: "onlineTherapy",
    author: "fathima",
    kind: "question",
    group: group.speech,
    body: "Has anyone tried online speech therapy for a 5-year-old? Is it as effective as going to the centre? The centre is 1.5 hours away from us.",
    hoursAgo: 75,
  },
  {
    key: "cricket",
    author: "ravi",
    kind: "thought",
    group: group.dads,
    body: "Fathers, let's plan a Sunday cricket morning with our kids. No pressure, no rules, just fun. I've created an event.",
    hoursAgo: 80,
    reactions: [["arun", "support"]],
  },
  {
    key: "stage",
    author: "meena",
    kind: "celebration",
    body: "என் மகள் இன்று பள்ளியில் முதல் முறையாக மேடையில் பாடினாள்! 🎶 பொறுமையாக இருந்த ஆசிரியர்களுக்கு மிக்க நன்றி.",
    hoursAgo: 98,
    reactions: [
      ["priya", "support"],
      ["lakshmi", "support"],
      ["karthik", "hug"],
      ["fathima", "support"],
    ],
  },
  {
    key: "dentist",
    author: "selvi",
    kind: "question",
    body: "Any recommendations for a patient dentist in Madurai? My son has strong sensory issues and the last visit was very hard for him.",
    hoursAgo: 120,
  },
  {
    key: "film",
    author: "priya",
    kind: "thought",
    group: group.chennai,
    body: "The sensory-friendly film screening last weekend was lovely: lights dimmed, sound low, and nobody minded when the kids walked around. Let's go together next time!",
    hoursAgo: 145,
    reactions: [["meena", "support"]],
  },
];

const postId: Record<string, string> = {};
for (const post of seedPosts) postId[post.key] = newId();

await db.insert(posts).values(
  seedPosts.map((post) => ({
    id: postId[post.key],
    authorId: id[post.author],
    groupId: post.group ?? null,
    kind: post.kind,
    body: post.body,
    isAnonymous: post.anonymous ?? false,
    createdAt: ago(post.hoursAgo * HOUR),
  })),
);

const reactionRows = seedPosts.flatMap((post) =>
  (post.reactions ?? []).map(([key, kind]) => ({ postId: postId[post.key], userId: id[key], kind })),
);
if (reactionRows.length) await db.insert(postReactions).values(reactionRows);

const misinformationCommentId = newId();
await db.insert(comments).values([
  {
    id: newId(),
    authorId: id.lakshmi,
    postId: postId.firstWord,
    body: "So happy for you! These moments are everything. 💚",
    createdAt: ago(1.5 * HOUR),
  },
  {
    id: newId(),
    authorId: id.fathima,
    postId: postId.firstWord,
    isAnonymous: true,
    body: "This gives me so much hope. My daughter is four and still non-verbal.",
    createdAt: ago(1 * HOUR),
  },
  {
    id: newId(),
    authorId: id.meena,
    postId: postId.relatives,
    body: "நாங்களும் இதையே சந்தித்தோம். மருத்துவரின் அறிக்கையைக் காட்டியது உதவியது. ஒரே நேரத்தில் எல்லோரிடமும் இல்லாமல், ஒவ்வொருவரிடமாக மெதுவாகச் சொல்லுங்கள். 💚",
    createdAt: ago(4 * HOUR),
  },
  {
    id: newId(),
    authorId: id.arun,
    postId: postId.relatives,
    body: "My parents took a year to accept it. Bringing them along to one therapy session changed everything.",
    createdAt: ago(3 * HOUR),
  },
  {
    id: misinformationCommentId,
    authorId: id.vijay,
    postId: postId.relatives,
    body: "Try our herbal oil, it cures autism in 30 days! WhatsApp me for the price.",
    createdAt: ago(2.5 * HOUR),
  },
  {
    id: newId(),
    authorId: id.lakshmi,
    postId: postId.onlineTherapy,
    body: "We did online sessions for six months. It works well if a parent sits with the child and practises the activities during the week.",
    createdAt: ago(70 * HOUR),
  },
  {
    id: newId(),
    authorId: id.priya,
    postId: postId.dentist,
    body: "Ask for the first appointment of the day, when the clinic is quiet. It helped us a lot.",
    createdAt: ago(110 * HOUR),
  },
]);

/* ----------------------------- Blogs and news ---------------------------- */

const article = {
  diagnosis: newId(),
  journey: newId(),
  guilt: newId(),
  school: newId(),
  udidNews: newId(),
  cinemaNews: newId(),
  meetupNews: newId(),
};

await db.insert(articles).values([
  {
    id: article.diagnosis,
    type: "blog",
    authorId: id.priya,
    title: "What I wish someone had told me on diagnosis day",
    summary: "Five things I learned in the first year after our son's autism diagnosis.",
    body: `The day we heard the word *autism*, I went home and searched the internet until 3 am. Here is what I wish someone had told me instead.

## 1. Your child is the same child as yesterday

The diagnosis didn't change who he is. It gave us a map.

## 2. You don't have to do everything at once

Speech therapy, occupational therapy, diet changes, special schools… Pick **one** thing, start it, and breathe.

## 3. Find your people

For a long time we didn't tell anyone outside the family. Finding other parents, first one, then a few, then this community, was the turning point.

## 4. Grandparents need time too

They grieve in their own way. Invite them to a session. Let them see the progress.

## 5. Celebrate the small things

- The first time he pointed at something he wanted
- The first night he slept through
- The first time he held my hand in a crowd

If you are at the beginning of this road: you are not alone. 💚`,
    tags: ["autism", "diagnosis", "parenting"],
    status: "published",
    publishedAt: ago(8 * DAY),
    createdAt: ago(8 * DAY),
    updatedAt: ago(8 * DAY),
  },
  {
    id: article.journey,
    type: "blog",
    authorId: id.meena,
    title: "எங்கள் பயணம்: மௌனத்திலிருந்து வார்த்தைகளுக்கு",
    summary: "எங்கள் மகளின் பேச்சுப் பயிற்சியின் மூன்று ஆண்டுகள், நாங்கள் கற்றுக்கொண்டவை.",
    body: `மூன்று வயது வரை எங்கள் மகள் ஒரு வார்த்தையும் பேசவில்லை. உறவினர்கள் பலர் “பொறுமையாக இருங்கள், தானாகப் பேசுவாள்” என்றார்கள்.

## முதல் படி

ஒரு குழந்தை மருத்துவர் எங்களை பேச்சுப் பயிற்சியாளரிடம் அனுப்பினார். முதல் மூன்று மாதங்கள் எந்த மாற்றமும் தெரியவில்லை.

## வீட்டில் செய்தவை

- தினமும் பத்து நிமிடம் படப் புத்தகங்கள்
- பாடல்கள் மூலம் புதிய சொற்கள்
- அவள் விரும்பும் பொருட்களை உயரத்தில் வைத்து, கேட்கத் தூண்டுவது

## இன்று

இன்று அவள் பள்ளியில் மேடையில் பாடுகிறாள். ஒவ்வொரு குழந்தையின் வேகமும் வேறு. **நம்பிக்கையை விடாதீர்கள்.**`,
    tags: ["speech", "therapy", "தமிழ்"],
    status: "published",
    publishedAt: ago(5 * DAY),
    createdAt: ago(5 * DAY),
    updatedAt: ago(5 * DAY),
  },
  {
    id: article.guilt,
    type: "blog",
    authorId: id.lakshmi,
    isAnonymous: true,
    title: "The guilt nobody talks about",
    summary: "On the days I lose my patience, and why I stopped hiding them.",
    body: `Some evenings I raise my voice. Some evenings I sit in the bathroom for five minutes just to be alone. Then the guilt comes.

I am writing this without my name because I am not ready to say it out loud, but I think many of us feel it.

What helps me:

1. Saying sorry to my child, even when I think he doesn't understand
2. Asking my husband to take over one evening a week
3. Talking to other parents who **get it**

We are not perfect parents. We are tired, loving ones.`,
    tags: ["mental-health", "parents"],
    status: "published",
    publishedAt: ago(3 * DAY),
    createdAt: ago(3 * DAY),
    updatedAt: ago(3 * DAY),
  },
  {
    id: article.school,
    type: "blog",
    authorId: id.arun,
    title: "Finding a school that said yes",
    summary: "",
    body: "Seven schools said no. This is the story of the eighth.\n\n(Still writing…)",
    tags: ["school", "inclusion"],
    status: "draft",
    createdAt: ago(2 * DAY),
    updatedAt: ago(2 * DAY),
  },
  {
    id: article.udidNews,
    type: "news",
    authorId: id.karthik,
    title: "UDID disability card: apply online",
    summary: "The Unique Disability ID card can be applied for online. Here is what to keep ready before you start.",
    body: `The **Unique Disability ID (UDID)** card is accepted across India for disability benefits and concessions.

### Keep these ready

- A recent photo and Aadhaar card of your child
- Medical reports and the diagnosis certificate
- Address proof

After you apply, the district medical board will give you an appointment for assessment. Families in our community report waiting four to eight weeks.`,
    tags: ["government", "udid"],
    visibility: "public",
    sourceUrl: "https://www.swavlambancard.gov.in/",
    status: "published",
    publishedAt: ago(4 * DAY),
    createdAt: ago(4 * DAY),
    updatedAt: ago(4 * DAY),
  },
  {
    id: article.cinemaNews,
    type: "news",
    authorId: id.meena,
    title: "Sensory-friendly film screenings this month",
    summary: "Dimmed lights, lower sound and freedom to move around: special screenings for families with sensory needs.",
    body: "Several cinemas are running sensory-friendly shows on Saturday mornings this month. Lights stay dimmed rather than dark, the sound is lower, and children are welcome to walk, talk or take breaks.\n\nAsk at the ticket counter for the *sensory-friendly* show.",
    tags: ["events", "sensory"],
    visibility: "public",
    status: "published",
    publishedAt: ago(9 * DAY),
    createdAt: ago(9 * DAY),
    updatedAt: ago(9 * DAY),
  },
  {
    id: article.meetupNews,
    type: "news",
    authorId: id.meena,
    title: "Thank you for a wonderful first meetup!",
    summary: "Thirty-two families came to our first meetup. Here is what we heard, and what comes next.",
    body: "Thank you to every family who came to the Diwali get-together. Many of you asked for **smaller city meetups** and a **fathers' group**. Both are now happening: look in Groups and Events.\n\nWith love, the Aranyam volunteers 💚",
    tags: ["community"],
    visibility: "members",
    status: "published",
    publishedAt: ago(18 * DAY),
    createdAt: ago(18 * DAY),
    updatedAt: ago(18 * DAY),
  },
]);

await db.insert(articleReactions).values([
  { articleId: article.diagnosis, userId: id.lakshmi, kind: "support" },
  { articleId: article.diagnosis, userId: id.fathima, kind: "same" },
  { articleId: article.diagnosis, userId: id.meena, kind: "hug" },
  { articleId: article.guilt, userId: id.priya, kind: "same" },
  { articleId: article.guilt, userId: id.fathima, kind: "hug" },
  { articleId: article.journey, userId: id.priya, kind: "support" },
]);

await db.insert(comments).values([
  {
    id: newId(),
    authorId: id.fathima,
    articleId: article.diagnosis,
    body: "Number 2 is so true. We tried everything at once and burned out in three months.",
    createdAt: ago(7 * DAY),
  },
  {
    id: newId(),
    authorId: id.priya,
    articleId: article.guilt,
    body: "Thank you for writing this. I felt every word.",
    createdAt: ago(2 * DAY),
  },
]);

/* --------------------------------- Events -------------------------------- */

const event = { park: newId(), iep: newId(), speechQa: newId(), cricket: newId(), diwali: newId() };

await db.insert(events).values([
  {
    id: event.park,
    title: "Sensory-friendly morning at the park",
    description:
      "A relaxed morning in the park before it gets crowded. Bring a mat, water and your child's favourite snack. There is a quiet corner under the trees for anyone who needs a break. Siblings are very welcome!",
    startsAt: onDay(5, "07:30"),
    endsAt: onDay(5, "09:30"),
    mode: "in_person",
    city: "Anna Nagar, Chennai",
    venue: "Anna Nagar Tower Park, entrance near the 2nd Avenue gate. Look for the green Aranyam balloon.",
    capacity: 15,
    features: ["sensory_friendly", "siblings_welcome", "free"],
    createdById: id.priya,
    createdAt: ago(2 * DAY),
  },
  {
    id: event.iep,
    title: "Online talk: understanding IEPs in Indian schools",
    description:
      "What is an Individualised Education Plan, how do you ask your school for one, and what should it contain? A special educator joins us for 30 minutes, followed by questions.",
    startsAt: onDay(9, "19:00"),
    endsAt: onDay(9, "20:00"),
    mode: "online",
    onlineUrl: "https://meet.example.org/aranyam-iep-talk",
    features: ["free", "parents_only"],
    createdById: id.karthik,
    createdAt: ago(3 * DAY),
  },
  {
    id: event.speechQa,
    title: "பேச்சுப் பயிற்சியாளருடன் கேள்வி பதில்",
    description: "ஒரு அனுபவமிக்க பேச்சுப் பயிற்சியாளர் உங்கள் கேள்விகளுக்குப் பதில் அளிப்பார். தமிழில் நடைபெறும்.",
    startsAt: onDay(12, "11:00"),
    endsAt: onDay(12, "12:30"),
    mode: "online",
    onlineUrl: "https://meet.example.org/aranyam-speech-qa",
    features: ["free"],
    groupId: group.speech,
    createdById: id.lakshmi,
    createdAt: ago(1 * DAY),
  },
  {
    id: event.cricket,
    title: "Dads' cricket morning",
    description: "Soft-ball cricket with our kids. Every child bats, nobody is ever out. Breakfast after at the canteen.",
    startsAt: onDay(3, "06:30"),
    endsAt: onDay(3, "08:30"),
    mode: "in_person",
    city: "Coimbatore",
    venue: "College ground, gate 2 (parking inside)",
    features: ["siblings_welcome", "free"],
    groupId: group.dads,
    createdById: id.ravi,
    createdAt: ago(80 * HOUR),
  },
  {
    id: event.diwali,
    title: "Diwali get-together",
    description: "Sweets, music and a quiet room for anyone who needs it.",
    startsAt: onDay(-20, "16:00"),
    endsAt: onDay(-20, "19:00"),
    mode: "in_person",
    city: "T. Nagar, Chennai",
    venue: "Community hall, 2nd floor",
    features: ["sensory_friendly", "wheelchair", "siblings_welcome"],
    createdById: id.meena,
    createdAt: ago(40 * DAY),
  },
]);

const rsvp = (eventId: string, key: string, status: "going" | "interested") => ({ eventId, userId: id[key], status });
await db.insert(eventRsvps).values([
  rsvp(event.park, "priya", "going"),
  rsvp(event.park, "lakshmi", "going"),
  rsvp(event.park, "meena", "going"),
  rsvp(event.park, "arun", "interested"),
  rsvp(event.iep, "karthik", "going"),
  rsvp(event.iep, "fathima", "going"),
  rsvp(event.iep, "priya", "interested"),
  rsvp(event.speechQa, "lakshmi", "going"),
  rsvp(event.speechQa, "selvi", "going"),
  rsvp(event.cricket, "ravi", "going"),
  rsvp(event.cricket, "arun", "going"),
  rsvp(event.diwali, "meena", "going"),
  rsvp(event.diwali, "priya", "going"),
  rsvp(event.diwali, "lakshmi", "going"),
]);

await db.insert(comments).values({
  id: newId(),
  authorId: id.fathima,
  eventId: event.park,
  body: "Is there a toilet nearby? My daughter may need one.",
  createdAt: ago(20 * HOUR),
});

/* ------------------------ Invites, reports, activity ---------------------- */

await db.insert(invites).values({
  id: newId(),
  code: newInviteCode(),
  createdById: id.priya,
  note: "Kavitha from the therapy centre",
  expiresAt: new Date(now + 10 * DAY),
  createdAt: ago(4 * DAY),
});

await db.insert(reports).values({
  id: newId(),
  reporterId: id.lakshmi,
  targetType: "comment",
  targetId: misinformationCommentId,
  reason: "misinformation",
  details: "Selling a “cure”. This could hurt families who are desperate.",
  createdAt: ago(2 * HOUR),
});

await db.insert(notifications).values([
  {
    id: newId(),
    userId: id.priya,
    type: "comment_on_post",
    actorId: id.lakshmi,
    link: `/posts/${postId.firstWord}`,
    createdAt: ago(1.5 * HOUR),
  },
  {
    id: newId(),
    userId: id.priya,
    type: "comment_on_post",
    actorId: id.fathima,
    actorAnonymous: true,
    link: `/posts/${postId.firstWord}`,
    createdAt: ago(1 * HOUR),
  },
  {
    id: newId(),
    userId: id.priya,
    type: "event_rsvp",
    actorId: id.lakshmi,
    link: `/events/${event.park}`,
    data: { title: "Sensory-friendly morning at the park" },
    readAt: ago(10 * HOUR),
    createdAt: ago(30 * HOUR),
  },
  {
    id: newId(),
    userId: id.arun,
    type: "group_join_request",
    actorId: id.selvi,
    link: `/groups/${group.coimbatore}/manage`,
    data: { group: "Coimbatore Families" },
    createdAt: ago(6 * HOUR),
  },
]);

await db.insert(auditLogs).values(
  people
    .filter((person) => (person.status ?? "approved") === "approved" && person.key !== "meena")
    .map((person) => ({
      id: newId(),
      actorId: id.meena,
      action: "user.approve",
      targetType: "user",
      targetId: id[person.key],
      createdAt: new Date(ago(person.joinedDaysAgo * DAY).getTime() + 3 * HOUR),
    })),
);

console.info(`Demo community ready (${context.kind}). Log in with any of these, password "${DEMO_PASSWORD}":`);
console.info("  meena@aranyam.local     admin");
console.info("  karthik@aranyam.local   moderator");
console.info("  priya@aranyam.local     member (owns a group and an event)");
console.info("  lakshmi@aranyam.local   member");
console.info("  divya@aranyam.local     waiting for approval");
await context.close();
