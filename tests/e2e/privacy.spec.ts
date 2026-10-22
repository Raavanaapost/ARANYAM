import { expect, test } from "@playwright/test";
import { logIn, openAs, people } from "./helpers";

test("visitors only see public news, without names", async ({ page }) => {
  await page.goto("/en/news");
  await expect(page.getByRole("heading", { name: "UDID disability card: apply online" })).toBeVisible();
  await expect(page.getByText("Members see more news")).toBeVisible();
  // Members-only news and every author name stay hidden.
  await expect(page.getByText("Thank you for a wonderful first meetup")).toHaveCount(0);
  await expect(page.getByText("Meena Sundaram")).toHaveCount(0);

  for (const path of ["/en/feed", "/en/blogs", "/en/groups", "/en/events", "/en/members/anyone"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/login\?next=/);
  }
});

test("search engines are asked not to index member pages", async ({ page }) => {
  await logIn(page, people.priya);
  await page.goto("/en/feed");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("anonymous posts never show their author", async ({ page }) => {
  await logIn(page, people.arun);
  // "How do we tell relatives about our son's autism?", shared without a name.
  const post = page.getByTestId("post").filter({ hasText: "உறவினர்களிடம் எப்படிச் சொல்வது" });
  await expect(post).toBeVisible();
  await expect(post).toContainText("A parent");
  await expect(post.getByRole("link", { name: /Priya|Meena|Lakshmi|Fathima/ })).toHaveCount(0);
});

test("hidden groups and their events stay invisible to everyone outside", async ({ page, browser }) => {
  const member = await openAs(browser, people.arun);
  await member.page.goto("/en/groups");
  await member.page.getByRole("link", { name: "Dads' Circle" }).click();
  await expect(member.page).toHaveURL(/\/en\/groups\/\w+$/);
  await expect(member.page.getByRole("heading", { level: 1, name: "Dads' Circle" })).toBeVisible();
  const groupUrl = member.page.url();
  await member.close();

  await logIn(page, people.priya);
  await page.goto("/en/groups");
  await expect(page.getByText("Dads' Circle")).toHaveCount(0);
  await page.goto(groupUrl);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await page.goto("/en/events");
  await expect(page.getByText("Dads' cricket morning")).toHaveCount(0);
});

test("an event's address is shared only after responding", async ({ page }) => {
  await logIn(page, people.fathima);
  await page.goto("/en/events");
  await page.getByRole("link", { name: "Sensory-friendly morning at the park" }).click();
  await expect(page.getByText("The exact address or meeting link is shared with families who respond.")).toBeVisible();
  await expect(page.getByText("Anna Nagar Tower Park")).toHaveCount(0);

  const eventId = page.url().split("/").at(-1);
  const before = await (await page.request.get(`/api/events/${eventId}/ics`)).text();
  expect(before).toContain("LOCATION:Anna Nagar\\, Chennai");
  expect(before).not.toContain("Tower Park");

  await page.getByRole("button", { name: "Interested" }).click();
  await expect(page.getByText("Anna Nagar Tower Park, entrance near the 2nd Avenue gate.")).toBeVisible();
  const after = await (await page.request.get(`/api/events/${eventId}/ics`)).text();
  expect(after).toContain("Tower Park");
});

test("a member's data export holds only their own things", async ({ page }) => {
  await logIn(page, people.priya);
  const response = await page.request.get("/api/export");
  expect(response.headers()["content-disposition"]).toContain("attachment");
  const data = await response.json();
  expect(JSON.stringify(data)).toContain("Today my son said");
  expect(JSON.stringify(data)).not.toContain("herbal oil");
  expect(JSON.stringify(data)).not.toContain("passwordHash");

  await page.context().clearCookies();
  expect((await page.request.get("/api/export")).status()).toBe(401);
});
