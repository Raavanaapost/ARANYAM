import { expect, type Browser, type Page } from "@playwright/test";

/** Every demo account uses this password (see scripts/seed.ts). */
export const DEMO_PASSWORD = "aranyam-demo-2026";

export const people = {
  admin: "meena@aranyam.local",
  moderator: "karthik@aranyam.local",
  priya: "priya@aranyam.local",
  lakshmi: "lakshmi@aranyam.local",
  arun: "arun@aranyam.local",
  fathima: "fathima@aranyam.local",
  selvi: "selvi@aranyam.local",
  ravi: "ravi@aranyam.local",
  vijay: "vijay@aranyam.local",
};

export async function logIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/en/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A separate browser session for a second person in the same test. */
export async function openAs(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await logIn(page, email);
  return { page, close: () => context.close() };
}

/** A unique email address for people who sign up during a test. */
export function newEmail(name: string) {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
}

/** The first link in the newest email to an address, read from the development mailbox. */
export async function linkFromEmail(page: Page, to: string): Promise<string> {
  await page.goto("/en/dev/mailbox");
  const message = page.getByTestId("dev-email").filter({ has: page.getByTestId("dev-email-to").getByText(to, { exact: true }) });
  const href = await message.first().getByRole("link").first().getAttribute("href");
  expect(href).toBeTruthy();
  return href!;
}
