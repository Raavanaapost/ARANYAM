import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth/auth-card";
import { getLocale } from "@/i18n/server";

type Params = PageProps<"/[lang]/join/[code]">["params"];

/** Short invite links (/en/join/abc…) lead to the sign-up form with the invite filled in. */
export default function JoinPage({ params }: PageProps<"/[lang]/join/[code]">) {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={3} />}>
      <JoinRedirect params={params} />
    </Suspense>
  );
}

async function JoinRedirect({ params }: { params: Params }): Promise<never> {
  const locale = await getLocale();
  const { code } = await params;
  redirect(`/${locale}/register?invite=${encodeURIComponent(code.slice(0, 40))}`);
}
