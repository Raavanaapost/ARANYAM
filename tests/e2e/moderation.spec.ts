import { expect, test } from "@playwright/test";
import { logIn, people } from "./helpers";

test("members cannot open the moderation pages", async ({ page }) => {
  await logIn(page, people.priya);
  for (const path of ["/en/admin", "/en/admin/members", "/en/admin/reports", "/en/admin/groups", "/en/admin/audit"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  }
});

test("admins can open every moderation page", async ({ page }) => {
  await logIn(page, people.admin);

  await page.goto("/en/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Moderation" })).toBeVisible();

  await page.goto("/en/admin/members");
  await expect(page.getByTestId("member-row").filter({ hasText: "Divya Prakash" })).toBeVisible();

  await page.goto("/en/admin/reports");
  await expect(page.getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "page");

  // Admins look after every group, hidden ones included.
  await page.goto("/en/admin/groups");
  const main = page.getByRole("main");
  await expect(main.getByText("Dads' Circle")).toBeVisible();
  await expect(main.getByText("Coimbatore Families")).toBeVisible();

  await page.goto("/en/admin/audit");
  await expect(page.getByRole("link", { name: "Activity log" })).toHaveAttribute("aria-current", "page");
});
