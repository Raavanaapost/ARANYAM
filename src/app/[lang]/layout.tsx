import "@fontsource/mukta-malar/400.css";
import "@fontsource/mukta-malar/500.css";
import "@fontsource/mukta-malar/600.css";
import "@fontsource/mukta-malar/700.css";
import "@fontsource-variable/baloo-thambi-2/index.css";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/i18n/client";
import { locales } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.meta.siteName, template: `%s · ${t.meta.siteName}` },
    description: t.meta.description,
    applicationName: "Aranyam",
    icons: {
      icon: [
        { url: "/brand/icon-64.png", sizes: "64x64", type: "image/png" },
        { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/apple-icon.png",
    },
    // Pages are private unless a public page says otherwise.
    robots: { index: false, follow: false },
    referrer: "same-origin",
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#101814" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const { locale, t } = await getI18n();
  return (
    <html lang={locale} className="h-full">
      <body className="flex min-h-full flex-col antialiased">
        <a href="#main" className="skip-link">
          {t.common.skipToContent}
        </a>
        <I18nProvider locale={locale} dictionary={t}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
