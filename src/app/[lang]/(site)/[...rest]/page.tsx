import { notFound } from "next/navigation";

// Any unknown path under /en or /ta shows the translated "not found" page.
export default function CatchAll() {
  notFound();
}
