import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";

/** The centred card used by the login, join and password screens. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full">
      <Card className="p-6 sm:p-8">
        <LogoMark className="mb-4 size-12" />
        <h1 className="text-2xl text-ink sm:text-[1.75rem]">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </Card>
      {footer ? <div className="mt-5 text-center text-[0.95rem] text-muted">{footer}</div> : null}
    </div>
  );
}

/** Reads a single value from page search params. */
export { firstParam } from "@/lib/params";

/** Placeholder for form fields while the page reads the request. */
export function AuthFormSkeleton({ fields }: { fields: number }) {
  return (
    <div className="space-y-5" aria-busy="true">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}

/** Placeholder for a whole card whose title depends on the request. */
export function AuthCardSkeleton({ fields }: { fields: number }) {
  return (
    <Card className="w-full p-6 sm:p-8" aria-busy="true">
      <Skeleton className="mb-4 size-12 rounded-full" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="mt-3 mb-8 h-4 w-full" />
      <AuthFormSkeleton fields={fields} />
    </Card>
  );
}
