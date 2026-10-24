# Aranyam · ஆரண்யம்

A safe grove for Tamil families raising children with special needs.
சிறப்புத் தேவையுள்ள குழந்தைகளை வளர்க்கும் தமிழ்க் குடும்பங்களுக்கான பாதுகாப்பான சோலை.

Many families keep their child's needs to themselves and know only a few others who understand. Aranyam is a private, members-only community where they can share, learn and meet, in Tamil or English, without being seen by the wider world.

## What families can do

- **Share** thoughts, questions, celebrations and tips in the feed, with Support, Hug and Me too reactions and kind replies. Anything can be posted without a name.
- **Write blogs** in simple Markdown with a preview, keep drafts, and publish with or without a name.
- **Read news** about schemes, rights and therapies. Moderators post news and decide which items are public.
- **Meet at events**, online or in person. The exact address or meeting link is shown only to families who respond, and every event has a calendar file.
- **Join groups** by city, need or interest. A group is open, private (ask to join) or hidden (invite link only).
- **Invite** a family they trust with a personal link that skips the waiting list.
- **Stay in touch** with notifications, and switch between Tamil and English at any time. Emails arrive in each family's own language.

Moderators welcome new families in, handle reports, pause accounts and remove harmful content. Everything they do is written to an activity log.

## Privacy by design

- Nothing is public except the welcome pages and the news that moderators mark as public. Search engines are asked not to index anything else.
- New families see nothing until they confirm their email and a moderator welcomes them in.
- Anonymous posts never show their author, not even in notifications. A moderator can reveal an author only from a report, and that is logged.
- Hidden groups are invisible to everyone outside them. Event addresses are shared only with families who respond.
- No ads, no tracking, and no third-party scripts, fonts or images. A strict content security policy enforces it.
- Families can download everything they have shared, and delete their account with all of it for good.
- Logging out loads a fresh page, so nothing from the session stays in the browser's memory.

## Try it on your computer

You need Node.js 22.12 or newer, and nothing else. By default Aranyam uses [PGlite](https://pglite.dev), a full PostgreSQL that runs inside Node and keeps its files in `.data/pglite`.

```bash
npm install
npm run setup   # creates the tables and a small demo community
npm run dev
```

Open http://localhost:3000. Every demo account uses the password `aranyam-demo-2026`:

| Email                   | Who                                     |
| ----------------------- | --------------------------------------- |
| `meena@aranyam.local`   | Admin                                   |
| `karthik@aranyam.local` | Moderator                               |
| `priya@aranyam.local`   | Member who runs a group and an event    |
| `lakshmi@aranyam.local` | Member who uses Aranyam in Tamil        |
| `divya@aranyam.local`   | New family waiting for a moderator      |

During development no email is sent. Read them at http://localhost:3000/en/dev/mailbox instead.

To start over, run `npm run db:seed -- --reset`, or stop the server and delete `.data/pglite`.

### Using PostgreSQL

Copy `.env.example` to `.env.local` and set `DATABASE_URL`, for example:

```bash
DATABASE_URL=postgres://aranyam:aranyam@localhost:5432/aranyam
```

Then run `npm run setup` again. Aranyam is tested with PostgreSQL 16.

## Starting a real community

The demo accounts share a published password, so never add them to a real community. The seed script refuses unless `APP_URL` points at your own computer.

1. Create a PostgreSQL database and set the settings below, in `.env.local` or in your host's environment.
2. Build and start with `npm run build && npm start`. The tables are created when the server starts. Set `AUTO_MIGRATE=false` if you would rather run `npm run db:migrate` yourself.
3. Register on the site and confirm your email, then make yourself the first admin with `npm run admin:promote -- you@example.com`. You can also list your email in `ADMIN_EMAILS` before you register.
4. Serve the site over HTTPS, through a hosting platform, Caddy or nginx.

| Setting                                     | What it does                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `APP_URL`                                   | The public address, used for links in emails                                      |
| `DATABASE_URL`                              | PostgreSQL connection string                                                      |
| `BETTER_AUTH_SECRET`                        | Signs login cookies and email links. Make one with `openssl rand -base64 32`      |
| `SMTP_URL`, `SMTP_PASSWORD`, `EMAIL_FROM`   | How to send email, through any SMTP provider. `SMTP_PASSWORD` is optional         |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`        | Keeps forms working across restarts. Make one with `openssl rand -base64 32`      |
| `TRUST_PROXY`                               | `true` behind a proxy or hosting platform, so rate limits see real addresses      |
| `REQUIRE_APPROVAL`, `INVITES_SKIP_APPROVAL` | Whether moderators welcome new families in, and whether invite links skip that   |
| `APP_TIMEZONE`                              | Time zone for events, `Asia/Kolkata` by default                                   |

`.env.example` explains every setting.

### On Netlify

`netlify.toml` holds the build settings. Because `@netlify/database` is installed, Netlify creates a PostgreSQL database for the site and applies `netlify/database/migrations` before each deploy goes live, so leave `DATABASE_URL` unset there.

In the Netlify dashboard, under Project configuration > Environment variables, set `APP_URL`, `ADMIN_EMAILS`, `SMTP_URL`, `EMAIL_FROM` and `BETTER_AUTH_SECRET`, plus `NETLIFY_NEXT_SKEW_PROTECTION=true` so open pages keep working while a new version goes live. Deploy, then register with the email in `ADMIN_EMAILS` to become the first admin.

To send email through Gmail, turn on 2-Step Verification for the Google account and create an app password at https://myaccount.google.com/apppasswords. Then set `SMTP_URL=smtps://you%40gmail.com@smtp.gmail.com:465`, `SMTP_PASSWORD` to the app password (spaces are fine) and `EMAIL_FROM="Aranyam <you@gmail.com>"`.

`npm run db:generate` copies each new migration into `netlify/database/migrations`. Commit both copies.

## Tests

```bash
npm test            # unit and privacy tests on a throwaway in-memory database
npm run test:e2e    # browser tests: joining, login, privacy, posts, events, groups, moderation, Tamil
npm run lint
npm run typecheck
```

The browser tests need Chromium once: `npx playwright install chromium`. They build the app and run it on port 3100 with fresh demo data in `.data/e2e`.

- `E2E_DATABASE_URL=postgres://…` runs them on PostgreSQL instead. **That database is emptied.**
- `E2E_SKIP_BUILD=1` reuses the last build.
- `E2E_SERVER=dev` uses the development server.

## How it is built

- [Next.js 16](https://nextjs.org) with React 19, Server Components, Server Actions and TypeScript
- PostgreSQL through [Drizzle ORM](https://orm.drizzle.team), or PGlite with no setup at all
- Tailwind CSS 4, with the Tamil fonts Mukta Malar and Baloo Thambi 2 served from the site itself
- Sign-in by [Better Auth](https://www.better-auth.com), used only from the server: passwords hashed with scrypt, sessions kept in the database and checked on every page, signed cookies, and our own rate limits on login and sign-up. Invites, moderator approval and `ADMIN_EMAILS` are Aranyam's own rules, in `src/lib/services/accounts.ts`
- Vitest and Playwright for tests

```
src/
  app/[lang]/(site)   public pages, login and sign-up
  app/[lang]/(app)    members' area: feed, blogs, news, events, groups, settings, moderation
  app/api             logout, calendar files, data export, health check
  lib/auth            Better Auth setup, sessions for pages and actions, rate limits
  components          shared interface pieces
  i18n                Tamil and English text
  lib/services        every database query, with the privacy rules
  lib/actions         form handlers
  lib/db              schema and connection (migrations live in drizzle/)
scripts/              migrate, seed and promote an admin
tests/                unit and browser tests
```
