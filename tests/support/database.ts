import { eq } from "drizzle-orm";
import { createDatabase, db, setDatabaseContext, type DatabaseContext } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrate";
import { accounts, devEmails, users, type User } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/ids";
import { viewerFromUser, type Viewer } from "@/lib/auth/viewer";

/** A fresh in-memory PostgreSQL (PGlite) database with every migration applied. */
export async function openTestDatabase(): Promise<DatabaseContext> {
  const context = createDatabase({ url: "", pgliteDir: "memory" });
  await runMigrations(context);
  setDatabaseContext(context);
  return context;
}

export async function closeTestDatabase(context: DatabaseContext) {
  setDatabaseContext(undefined);
  await context.close();
}

type PersonOptions = {
  name?: string;
  role?: User["role"];
  status?: User["status"];
  verified?: boolean;
};

/** Adds an account straight to the database and returns it as a signed-in viewer. */
export async function addPerson(options: PersonOptions = {}): Promise<Viewer> {
  const id = newId();
  const [user] = await db
    .insert(users)
    .values({
      id,
      email: `${id}@example.test`,
      displayName: options.name ?? `Member ${id.slice(0, 4)}`,
      role: options.role ?? "member",
      status: options.status ?? "approved",
      emailVerified: options.verified !== false,
      approvedAt: (options.status ?? "approved") === "approved" ? new Date() : null,
    })
    .returning();
  return viewerFromUser(user, `session-${id}`);
}

/** Gives an account a password, stored the way Better Auth stores it. */
export async function setPassword(userId: string, password: string) {
  await db
    .insert(accounts)
    .values({ id: userId, accountId: userId, providerId: "credential", userId, password: await hashPassword(password) })
    .onConflictDoUpdate({ target: accounts.id, set: { password: await hashPassword(password) } });
}

/** Reloads a viewer after their account changed (for example after approval). */
export async function reloadViewer(viewer: Viewer): Promise<Viewer> {
  const [user] = await db.select().from(users).where(eq(users.id, viewer.id));
  return viewerFromUser(user, viewer.sessionId);
}

/** The link in the newest email sent to an address, from the development mailbox. */
export async function latestEmailLink(to: string): Promise<string | null> {
  const rows = await db.select().from(devEmails).where(eq(devEmails.to, to));
  const newest = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return newest?.text.match(/https?:\/\/\S+/)?.[0] ?? null;
}
