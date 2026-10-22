import { cn } from "@/lib/cn";

/** A tree with a wide, sheltering canopy: Aranyam means "forest". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-10", className)} aria-hidden="true">
      <path d="M8 55c13-7 35-7 48 0" fill="none" stroke="#c98a2e" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M32 54V35" stroke="#7a5233" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M32 42l-6-5M32 39l6-5" stroke="#7a5233" strokeWidth="3" strokeLinecap="round" />
      <circle cx="20.5" cy="29" r="11" fill="#4f9c7c" />
      <circle cx="43.5" cy="29" r="11" fill="#2f7a5f" />
      <circle cx="32" cy="20" r="13.5" fill="#23634f" />
      <circle cx="26" cy="15.5" r="3.2" fill="#ffffff" opacity="0.18" />
      <circle cx="40" cy="31" r="2.2" fill="#f2b84b" />
      <circle cx="23" cy="32" r="2.2" fill="#f2b84b" />
      <circle cx="33" cy="25" r="2.2" fill="#f2b84b" />
    </svg>
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
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] font-bold text-primary">{primary}</span>
        <span className="mt-0.5 text-xs font-medium text-muted">{secondary}</span>
      </span>
    </span>
  );
}
