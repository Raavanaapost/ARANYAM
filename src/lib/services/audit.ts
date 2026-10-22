import { db, type Executor } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export type AuditAction =
  | "user.approve"
  | "user.decline"
  | "user.suspend"
  | "user.reinstate"
  | "user.role"
  | "user.verify"
  | "user.reset_link"
  | "report.remove"
  | "report.dismiss"
  | "report.reveal"
  | "content.remove"
  | "group.delete";

/** Records a moderator action. Details must never contain message contents. */
export async function audit(
  actorId: string,
  action: AuditAction,
  target: { type: string; id: string },
  details: Record<string, string | number | boolean | null> = {},
  executor: Executor = db,
) {
  await executor.insert(auditLogs).values({
    id: newId(),
    actorId,
    action,
    targetType: target.type,
    targetId: target.id,
    details,
  });
}
