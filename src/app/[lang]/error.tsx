"use client";

import { ErrorContent } from "@/components/shell/error-content";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <ErrorContent retry={retry} />
    </main>
  );
}
