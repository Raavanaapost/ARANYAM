import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "primary" | "accent" | "info" | "danger" | "warning" | "heart";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-muted",
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent",
  info: "bg-info-soft text-info",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  heart: "bg-heart-soft text-heart",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.8rem] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
