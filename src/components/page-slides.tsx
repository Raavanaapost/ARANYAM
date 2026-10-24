import type { ReactNode } from "react";
import { getI18n } from "@/i18n/server";
import { Scene, type Motif, type Mood } from "./scenes";
import { SlideShow } from "./slideshow";

/** The three pictures for each page, in the same order as its words in `t.slides`. */
const PAGE_SCENES = {
  landing: [
    ["path", "dawn"],
    ["kite", "golden"],
    ["gathering", "dusk"],
  ],
  about: [
    ["forest", "mist"],
    ["circle", "morning"],
    ["sunrise", "dawn"],
  ],
  feed: [
    ["home", "golden"],
    ["sapling", "mist"],
    ["bench", "dusk"],
  ],
  groups: [
    ["circle", "golden"],
    ["family", "dawn"],
    ["bridge", "dawn"],
  ],
  events: [
    ["gathering", "golden"],
    ["lake", "mist"],
    ["stars", "night"],
  ],
  blogs: [
    ["book", "morning"],
    ["path", "golden"],
    ["lanterns", "night"],
  ],
  news: [
    ["birds", "mist"],
    ["sunrise", "golden"],
    ["kite", "morning"],
  ],
} satisfies Record<string, [Motif, Mood][]>;

export type SlidePage = keyof typeof PAGE_SCENES;

/** The slideshow at the top of a page, with that page's pictures and words. */
export async function PageSlides({
  page,
  variant = "banner",
  className,
  children,
}: {
  page: SlidePage;
  variant?: "hero" | "banner";
  className?: string;
  children?: ReactNode;
}) {
  const { t } = await getI18n();
  const slides = t.slides[page].map((words, i) => {
    const [motif, mood] = PAGE_SCENES[page][i];
    return { ...words, art: <Scene motif={motif} mood={mood} uid={`${page}-${i}`} keepGround={variant === "banner"} /> };
  });
  return (
    <SlideShow slides={slides} variant={variant} className={className}>
      {children}
    </SlideShow>
  );
}
