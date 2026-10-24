import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The round Aranyam emblem: a home sheltered by trees and caring hands, with a
 * family around a child in a wheelchair. Its own cream circle keeps it clear
 * on light and dark backgrounds. Decorative: the name is always written next
 * to it or in the page heading.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/icon-192.png"
      alt=""
      width={192}
      height={192}
      className={cn("size-10 shrink-0 rounded-full", className)}
      priority
    />
  );
}

export function Logo({
  primary,
  secondary,
  className,
}: {
  primary: string;
  secondary: string;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {/* On the smallest phones only the tree shows; the name stays for screen readers. */}
      <span className="flex flex-col leading-none max-[359px]:sr-only">
        <span className="font-display text-[1.2rem] font-bold text-primary sm:text-[1.35rem]">{primary}</span>
        <span className="mt-0.5 text-xs font-medium text-muted">{secondary}</span>
      </span>
    </span>
  );
}
