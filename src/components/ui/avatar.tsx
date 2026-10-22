import { Leaf } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

const sizes = {
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-14 text-xl",
  xl: "size-20 text-3xl",
};

/** First letter of up to two words, keeping Tamil letters and vowel signs together. */
export function initials(name: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words
    .map((word) => segmenter.segment(word)[Symbol.iterator]().next().value?.segment ?? "")
    .join("")
    .toUpperCase();
}

type AvatarProps = {
  name: string;
  hue: number;
  size?: keyof typeof sizes;
  className?: string;
};

/**
 * Members are shown with coloured initials instead of photos, which keeps
 * faces (including children's) out of the community by default.
 */
export function Avatar({ name, hue, size = "md", className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "hue-tile inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold leading-none",
        sizes[size],
        className,
      )}
      style={{ "--hue": hue } as CSSProperties}
    >
      {initials(name)}
    </span>
  );
}

export function AnonymousAvatar({ size = "md", className }: { size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-sunken text-muted",
        sizes[size],
        className,
      )}
    >
      <Leaf className="size-[45%]" />
    </span>
  );
}
