import { expect, test } from "@playwright/test";
import { linkFromEmail, logIn, newEmail, openAs, people } from "./helpers";

test("a new family confirms their email and is welcomed in by a moderator", async ({ page, browser }) => {
  const email = newEmail("lakshmi");
  const password = "our daughter loves music";

  await page.goto("/en/register");
  await page.getByLabel("Your name in Aranyam").fill("Lakshmi Amma");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Tell us a little about your family").fill("We live in Madurai. Our daughter is five.");
  await page.getByLabel(/I will respect the privacy of other families/).check();
  await page.getByRole("button", { name: "Send my request" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto(await linkFromEmail(page, email));
  await expect(page.getByText("Your email address is confirmed")).toBeVisible();

  await logIn(page, email, password);
  await expect(page).toHaveURL(/\/en\/pending$/);
  await expect(page.getByRole("heading", { name: "Thank you for joining!" })).toBeVisible();

  // Nothing inside opens up while the request waits.
  await page.goto("/en/feed");
  await expect(page).toHaveURL(/\/en\/pending$/);

  const moderator = await openAs(browser, people.moderator);
  await moderator.page.goto("/en/admin/members");
  const request = moderator.page.getByTestId("member-row").filter({ hasText: email });
  await expect(request).toContainText("We live in Madurai");
  await request.getByRole("button", { name: "Welcome in" }).click();
  await expect(request).toHaveCount(0);
  await moderator.close();

  await page.goto("/en/feed");
  await expect(page.getByRole("heading", { name: "Vanakkam, Lakshmi" })).toBeVisible();
});

test("a family invited by a member skips the wait", async ({ page, browser }) => {
  const inviter = await openAs(browser, people.priya);
  await inviter.page.goto("/en/settings/invites");
  await inviter.page.getByLabel(/Who is this for/).fill("Kavitha from school");
  await inviter.page.getByRole("button", { name: "Create invite link" }).click();
  const inviteUrl = (await inviter.page.getByTestId("invite-url").textContent())!.trim();
  await inviter.close();

  const email = newEmail("kavitha");
  await page.goto(inviteUrl);
  await expect(page.getByText("Priya Amma invited you to Aranyam.")).toBeVisible();
  await page.getByLabel("Your name in Aranyam").fill("Kavitha");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("tea and good books");
  await page.getByLabel(/I will respect the privacy of other families/).check();
  await page.getByRole("button", { name: "Send my request" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto(await linkFromEmail(page, email));
  await logIn(page, email, "tea and good books");
  await expect(page).toHaveURL(/\/en\/feed$/);
});

test("logging in takes people back to the page they wanted", async ({ page }) => {
  await page.goto("/en/events");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fevents$/);
  await expect(page.getByText("Please log in to see this page. It is only for members.")).toBeVisible();

  await page.getByLabel("Email address").fill(people.priya);
  await page.getByLabel("Password", { exact: true }).fill("not the password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
  // The email stays filled in after a mistake.
  await expect(page.getByLabel("Email address")).toHaveValue(people.priya);

  await page.getByLabel("Password", { exact: true }).fill("aranyam-demo-2026");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/events$/);
  await expect(page.getByRole("heading", { name: "Family events" })).toBeVisible();
});

test("a forgotten password can be reset by email", async ({ page }) => {
  await page.goto("/en/forgot-password");
  await page.getByLabel("Email address").fill(people.ravi);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists for that email")).toBeVisible();

  await page.goto(await linkFromEmail(page, people.ravi));
  await page.getByLabel("New password", { exact: true }).fill("a new start in the morning");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your password has been changed. Please log in again.")).toBeVisible();

  await logIn(page, people.ravi, "a new start in the morning");
  await expect(page).toHaveURL(/\/en\/feed$/);
});

test("logging out ends the session", async ({ page }) => {
  await logIn(page, people.arun);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByText("You have been logged out.")).toBeVisible();
  await page.goto("/en/feed");
  await expect(page).toHaveURL(/\/en\/login/);
});
