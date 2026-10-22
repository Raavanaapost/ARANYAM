import { LogOut } from "lucide-react";
import { buttonClasses, type ButtonVariant } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

/**
 * Logging out is a normal form post (not a Server Action), so the browser
 * loads a fresh page afterwards and nothing from the session stays in memory.
 */
export function LogoutButton({
  locale,
  label,
  variant = "ghost",
  className,
}: {
  locale: Locale;
  label: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <form action="/api/auth/logout" method="post" className={className}>
      <input type="hidden" name="lang" value={locale} />
      <button type="submit" className={buttonClasses(variant, "sm")}>
        <LogOut className="size-4" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}
