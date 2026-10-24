import type { ReactNode } from "react";

/** Layout for the public reading pages: about, privacy and guidelines. */
export function ContentPage({
  title,
  intro,
  sections,
  banner,
  children,
}: {
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
  /** Shown above the title, for example the page's slideshow. */
  banner?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      {banner ? <div className="mb-10 sm:mb-12">{banner}</div> : null}
      <h1 className="text-3xl text-ink sm:text-4xl">{title}</h1>
      <p className="mt-4 text-lg text-muted">{intro}</p>
      <div className="mt-10 space-y-8">
        {sections.map((section, index) => (
          <section key={section.title} className="flex gap-4">
            <span
              className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display font-bold text-primary"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div>
              <h2 className="text-xl text-ink">{section.title}</h2>
              <p className="mt-1.5 text-ink/90">{section.body}</p>
            </div>
          </section>
        ))}
      </div>
      {children}
    </article>
  );
}
