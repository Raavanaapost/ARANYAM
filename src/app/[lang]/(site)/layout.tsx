import { SiteFooter, SiteHeader } from "@/components/shell/headers";

/** Public pages: the introduction, privacy promise, guidelines and the login screens. */
export default function SiteLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
