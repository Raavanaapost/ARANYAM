import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(29,43,37,0.04)]", className)}
      {...props}
    />
  );
}

export function CardSection({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function SectionTitle({
  children,
  action,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1", className)}>
      <Tag className="text-lg text-ink">{children}</Tag>
      {action ? <div className="shrink-0 whitespace-nowrap">{action}</div> : null}
    </div>
  );
}
