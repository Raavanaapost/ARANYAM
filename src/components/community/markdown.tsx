import type { ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

function SafeLink({ href, children }: ComponentProps<"a">) {
  const isInternal = typeof href === "string" && href.startsWith("/") && !href.startsWith("//");
  const isWeb = typeof href === "string" && /^https?:\/\//i.test(href);
  if (!isInternal && !isWeb) return <span>{children}</span>;
  return isInternal ? (
    <a href={href}>{children}</a>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
      {children}
    </a>
  );
}

const components: Components = {
  a: SafeLink,
  // Pictures are left out on purpose: no faces of children, and nothing loaded from other sites.
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
};

/** Renders blog and news text written in Markdown. Raw HTML is ignored. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-aranyam", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
