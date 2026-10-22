import { eq } from "drizzle-orm";
import { createDatabase, db, setDatabaseContext, type DatabaseContext } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrate";
import { devEmails, users, type User } from "@/lib/db/schema";
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
      // Not a real hash: these accounts never log in with a password.
      passwordHash: "test",
      displayName: options.name ?? `Member ${id.slice(0, 4)}`,
      role: options.role ?? "member",
      status: options.status ?? "approved",
      emailVerifiedAt: options.verified === false ? null : new Date(),
      approvedAt: (options.status ?? "approved") === "approved" ? new Date() : null,
    })
    .returning();
  return viewerFromUser(user, `session-${id}`);
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
