import { AppHeader, SiteFooter } from "@/components/shell/headers";

/** The member area. Each page checks membership itself through the data access layer. */
export default function AppLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <>
      <AppHeader />
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-6 pb-10">
        {children}
      </main>
      <SiteFooter compact />
    </>
  );
}
