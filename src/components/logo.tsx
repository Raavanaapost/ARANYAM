import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The round Aranyam Together emblem: a home sheltered by trees and caring hands, with a
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

/** The name as the logo writes it: "Aranyam" in green, "Together" in warm orange. */
export function Logo({ motto, className }: { motto: string; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {/* On the smallest phones only the emblem shows; the name stays for screen readers. */}
      <span className="flex flex-col leading-none max-[359px]:sr-only">
        <span className="font-display text-[1.15rem] font-semibold tracking-tight sm:text-[1.3rem]">
          <span className="text-primary">Aranyam</span> <span className="text-together">Together</span>
        </span>
        <span className="mt-1 text-[0.7rem] font-medium tracking-wide text-muted">{motto}</span>
      </span>
    </span>
  );
}
