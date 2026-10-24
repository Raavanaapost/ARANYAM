import { expect, test } from "@playwright/test";

test("joining with Google needs the agreement, then hands over to Google", async ({ page }) => {
  let googleUrl: URL | null = null;
  await page.route("https://accounts.google.com/**", async (route) => {
    googleUrl = new URL(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Google</h1>" });
  });

  await page.goto("/en/register");
  // Facebook has no keys in the test server, so it is not offered.
  await expect(page.getByRole("button", { name: "Continue with Facebook" })).toHaveCount(0);

  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByText("Please agree to the community guidelines to continue.")).toBeVisible();
  expect(googleUrl).toBeNull();

  await page.getByLabel(/I will respect the privacy of other families/).check();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("heading", { name: "Google" })).toBeVisible();

  const url = googleUrl as URL | null;
  expect(url?.searchParams.get("client_id")).toBe("e2e-google-app");
  expect(url?.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/callback\/google$/);
  expect(url?.searchParams.get("scope")).toContain("email");
});

test("a family sent back by Google is told why", async ({ page }) => {
  await page.goto("/en/login?social=google&error=signup_disabled");
  await expect(page.getByText("There is no account for that Google email address yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("Google's return address answers only for providers that are set up", async ({ request }) => {
  expect((await request.get("/api/auth/callback/facebook")).status()).toBe(404);
  expect((await request.get("/api/auth/sign-in/social")).status()).toBe(404);
});
