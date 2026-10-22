import "@fontsource/mukta-malar/400.css";
import "@fontsource/mukta-malar/700.css";
import "@fontsource-variable/baloo-thambi-2/index.css";
import "./globals.css";
import type { Metadata } from "next";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = {
  title: "Page not found · Aranyam",
  robots: { index: false, follow: false },
};

/** Shown for URLs that match no route at all. Bilingual, since no language is known. */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center px-4">
        <main className="max-w-md text-center">
          <LogoMark className="mx-auto size-16" />
          <h1 className="mt-6 text-2xl">We couldn&apos;t find that page</h1>
          <p lang="ta" className="mt-1 text-lg text-muted">
            அந்தப் பக்கம் கிடைக்கவில்லை
          </p>
          {/* This page has its own document, so plain links that load a fresh page are right here. */}
          <div className="mt-8 flex justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/en" className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary">
              Home
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/ta"
              lang="ta"
              className="rounded-full border border-line-strong px-5 py-2.5 font-semibold text-ink"
            >
              முகப்பு
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
