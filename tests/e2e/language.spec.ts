import { expect, test } from "@playwright/test";
import { linkFromEmail, logIn, people } from "./helpers";

test("a Tamil browser opens the Tamil site", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ta-IN" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/ta$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ta");
  await expect(page.getByRole("link", { name: "English" })).toBeVisible();
  await context.close();
});

test("switching language keeps the same page and is remembered", async ({ page }) => {
  await page.goto("/en/about");
  await page.getByRole("link", { name: "தமிழ்" }).click();
  await expect(page).toHaveURL(/\/ta\/about$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ta");

  // The choice sticks for addresses without a language.
  await page.goto("/privacy");
  await expect(page).toHaveURL(/\/ta\/privacy$/);
});

test("the language button works even before the page has finished loading", async ({ page, baseURL }) => {
  // Until the page knows its address, the button points at /ta/language.
  await page.goto("/ta/language", { referer: `${baseURL}/en/guidelines` });
  await expect(page).toHaveURL(/\/ta\/guidelines$/);
  // A link from another site never decides where people end up.
  await page.goto("/en/language", { referer: "https://example.com/en/privacy" });
  await expect(page).toHaveURL(/\/en$/);
});

test("members can use the whole site in Tamil", async ({ page }) => {
  await logIn(page, people.lakshmi);
  await page.goto("/ta/feed");
  const nav = page.getByRole("navigation", { name: "முதன்மை வழிசெலுத்தல்" }).first();
  await expect(nav.getByRole("link", { name: "குழுக்கள்" })).toBeVisible();
  await expect(page.getByRole("button", { name: "பகிர்" })).toBeVisible();

  await page.goto("/ta/events");
  await expect(page.getByRole("heading", { name: "குடும்ப நிகழ்வுகள்" })).toBeVisible();
});

test("emails arrive in each family's own language", async ({ page }) => {
  // Selvi chose Tamil, so her reset link opens the Tamil page even when asked from English.
  await page.goto("/en/forgot-password");
  await page.getByLabel("Email address").fill(people.selvi);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists for that email")).toBeVisible();
  expect(await linkFromEmail(page, people.selvi)).toMatch(/\/ta\/reset-password\//);
});
