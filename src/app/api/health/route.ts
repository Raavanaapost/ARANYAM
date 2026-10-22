import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/lib/db";

/** For uptime checks and container health probes. */
export async function GET() {
  await connection();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
