"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

/** Friendly error message with a retry button, used by the error.tsx files. */
export function ErrorContent({ retry }: { retry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-2xl">{t.errors.errorTitle}</h1>
      <p className="mt-2 text-muted">{t.errors.errorBody}</p>
      <Button className="mt-8" onClick={() => retry()}>
        <RotateCcw className="size-4" aria-hidden="true" />
        {t.errors.tryAgain}
      </Button>
    </div>
  );
}
