"use client";

import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button";

type SubmitButtonProps = Omit<ComponentProps<"button">, "type"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pendingLabel?: ReactNode;
  /** Ask before submitting, e.g. for deletions. */
  confirm?: string;
};

/** A submit button that shows progress and prevents double submissions. */
export function SubmitButton({
  variant,
  size,
  className,
  children,
  pendingLabel,
  confirm,
  onClick,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-disabled={pending || undefined}
      disabled={disabled}
      className={buttonClasses(variant, size, className)}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        if (confirm && !window.confirm(confirm)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & { invalid?: boolean };

export function PasswordInput({ invalid = false, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-12 w-full rounded-xl border bg-surface pr-12 pl-3.5 text-ink focus:outline-none focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-1",
          invalid ? "border-danger" : "border-line-strong hover:border-muted",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-1 my-1 flex w-10 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
        aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className={buttonClasses("secondary", "sm", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard access can be blocked; the link is still visible to copy by hand.
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? t.common.copied : t.common.copy}</span>
    </button>
  );
}

/**
 * A small pop-over menu. It closes on outside click, Escape, and when the page
 * is hidden by a navigation (pages stay mounted in the background).
 */
export function Dropdown({
  label,
  trigger,
  children,
  align = "right",
  className,
  triggerClassName,
}: {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => () => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <div
        id={menuId}
        hidden={!open}
        onClick={(event) => {
          // Close after choosing a link or a menu command; keep open while typing in a form inside.
          if ((event.target as HTMLElement).closest("a, [data-close-menu]")) setOpen(false);
        }}
        className={cn(
          "absolute z-40 mt-2 min-w-56 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-xl",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export const menuItemClass =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[0.95rem] text-ink hover:bg-sunken";
