import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-xl border bg-surface px-3.5 text-ink placeholder:text-muted/80 transition-colors focus:outline-none focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-1 disabled:opacity-60";

function controlClasses(invalid: boolean, className?: string) {
  return cn(controlBase, invalid ? "border-danger" : "border-line-strong hover:border-muted", className);
}

type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | string[];
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
};

/** Label, control, hint and error, wired together for screen readers. */
export function Field({ id, label, hint, error, optionalLabel, children, className }: FieldProps) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block font-semibold text-ink">
        {label}
        {optionalLabel ? (
          <>
            {" "}
            <span className="ml-0.5 text-sm font-normal text-muted">({optionalLabel})</span>
          </>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {message ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: unknown, error?: unknown) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

type InputProps = ComponentProps<"input"> & { invalid?: boolean };

export function Input({ invalid = false, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, cn("h-12", className))}
      {...props}
    />
  );
}

type TextareaProps = ComponentProps<"textarea"> & { invalid?: boolean };

export function Textarea({ invalid = false, className, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, cn("min-h-28 py-3 leading-relaxed", className))}
      {...props}
    />
  );
}

type SelectProps = ComponentProps<"select"> & { invalid?: boolean };

export function Select({ invalid = false, className, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, cn("h-12 pr-9", className))}
      {...props}
    />
  );
}

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & {
  label: ReactNode;
  hint?: ReactNode;
};

export function Checkbox({ id, label, hint, className, ...props }: CheckboxProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-5 shrink-0 rounded border-line-strong accent-primary"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      <div>
        <label htmlFor={id} className="font-medium text-ink">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-sm text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
