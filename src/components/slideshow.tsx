"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type FocusEvent, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { cn } from "@/lib/cn";

export type Slide = { title: string; body: string; art: ReactNode };

const SLIDE_MS = 7000;

function subscribeToMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the visitor asked their device for less movement. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/**
 * A calm slideshow: pictures fade slowly into each other with their words on
 * top. It moves on by itself every few seconds, but stops while the pointer or
 * keyboard is on it, when the visitor presses pause, and never starts on its
 * own for visitors who prefer less motion.
 *
 * "hero" is the large one on the front page; "banner" is a shorter one at the
 * top of other pages. `children` (for example buttons) stay under the words of
 * every slide.
 */
export function SlideShow({
  slides,
  variant = "banner",
  children,
  className,
}: {
  slides: Slide[];
  variant?: "hero" | "banner";
  children?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  // null until the visitor presses play or pause themselves.
  const [chosenPlaying, setChosenPlaying] = useState<boolean | null>(null);
  const [held, setHeld] = useState(false);
  const playing = chosenPlaying ?? !reducedMotion;
  const moving = playing && !held && slides.length > 1;
  const hero = variant === "hero";

  useEffect(() => {
    if (!moving) return;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [moving, index, slides.length]);

  const go = (next: number) => setIndex((next + slides.length) % slides.length);
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t.slides.label}
      className={cn("relative", className)}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={onBlur}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] bg-sunken shadow-[0_18px_50px_-30px_rgba(36,48,44,0.45)] ring-1 ring-line dark:brightness-[0.82]",
          hero ? "h-56 sm:h-80 md:h-[32rem]" : "h-44 sm:h-52 md:h-64",
        )}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(
              "absolute inset-0 transition-opacity duration-[1400ms] ease-in-out",
              i === index ? "opacity-100" : "opacity-0",
            )}
          >
            <div className={cn("size-full [&>svg]:size-full", i === index && "scene-drift")}>{slide.art}</div>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "relative mx-3 rounded-3xl border border-line/70 bg-surface/90 p-5 shadow-[0_12px_40px_-24px_rgba(36,48,44,0.5)] backdrop-blur-md",
          hero ? "-mt-10" : "-mt-5",
          "md:absolute md:inset-y-0 md:left-0 md:m-0 md:flex md:flex-col md:justify-center md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
          hero ? "md:w-[min(32rem,50%)] md:pl-10" : "md:w-[min(26rem,46%)] md:pl-6",
        )}
      >
        <div
          className={cn(
            "md:rounded-3xl md:border md:border-line/60 md:bg-surface/85 md:shadow-[0_12px_40px_-24px_rgba(36,48,44,0.5)] md:backdrop-blur-md",
            hero ? "md:p-8" : "md:p-5",
          )}
        >
          <div className="grid" aria-live={moving ? "off" : "polite"}>
            {slides.map((slide, i) => (
              <div
                key={i}
                role="group"
                aria-roledescription="slide"
                aria-label={format(t.slides.position, { number: i + 1, total: slides.length })}
                aria-hidden={i !== index}
                inert={i !== index}
                className={cn(
                  "[grid-area:1/1] transition-opacity duration-700 ease-in-out",
                  i === index ? "opacity-100" : "opacity-0",
                )}
              >
                <p
                  className={cn(
                    "font-display font-semibold text-ink",
                    hero
                      ? "text-2xl leading-snug sm:text-[2.1rem] sm:leading-tight sm:[:lang(ta)_&]:text-[1.7rem]"
                      : "text-lg leading-snug sm:text-xl",
                  )}
                >
                  {slide.title}
                </p>
                <p className={cn("mt-2 text-muted", hero ? "text-base sm:text-lg" : "text-sm sm:text-[0.95rem]")}>
                  {slide.body}
                </p>
              </div>
            ))}
          </div>

          {children ? <div className="mt-5">{children}</div> : null}

          {slides.length > 1 ? (
            <div className={cn("flex items-center gap-1", hero ? "mt-6" : "mt-3")}>
              <ControlButton label={t.slides.previous} onClick={() => go(index - 1)}>
                <ChevronLeft className="size-4" aria-hidden="true" />
              </ControlButton>
              <div className="flex items-center">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={format(t.slides.goTo, { number: i + 1 })}
                    aria-current={i === index ? "true" : undefined}
                    className="flex size-8 items-center justify-center rounded-full"
                  >
                    <span
                      className={cn(
                        "block h-2 rounded-full transition-all duration-500",
                        i === index ? "w-6 bg-primary" : "w-2 bg-line-strong",
                      )}
                    />
                  </button>
                ))}
              </div>
              <ControlButton label={t.slides.next} onClick={() => go(index + 1)}>
                <ChevronRight className="size-4" aria-hidden="true" />
              </ControlButton>
              <ControlButton
                label={playing ? t.slides.pause : t.slides.play}
                onClick={() => setChosenPlaying(!playing)}
                className="ml-auto"
              >
                {playing ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
              </ControlButton>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ControlButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-primary-soft hover:text-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}
