"use client";

import { ErrorContent } from "@/components/shell/error-content";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorContent retry={retry} />;
}
