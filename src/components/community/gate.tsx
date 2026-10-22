import type { ReactNode } from "react";
import { requireMember } from "@/lib/auth/dal";

/** Renders its children only for approved members; others are sent where they belong. */
export async function MemberOnly({ children }: { children: ReactNode }) {
  await requireMember();
  return children;
}
