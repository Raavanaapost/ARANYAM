import { expect, test } from "@playwright/test";

test("the front page welcomes families with a slideshow they can control", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("link", { name: /Aranyam Together/ }).first()).toBeVisible();

  const slideshow = page.getByRole("region", { name: "Pictures and words of welcome" });
  await expect(slideshow.getByRole("group", { name: "1 of 3" })).toContainText("You don't have to walk this road alone");

  await slideshow.getByRole("button", { name: "Next picture" }).click();
  await expect(slideshow.getByRole("group", { name: "2 of 3" })).toContainText("Hope grows when we share it");
  // Only the slide that is showing can be read or reached.
  await expect(slideshow.getByRole("group")).toHaveCount(1);

  await slideshow.getByRole("button", { name: "Show picture 3" }).click();
  await expect(slideshow.getByRole("group", { name: "3 of 3" })).toBeVisible();

  await slideshow.getByRole("button", { name: "Pause the slideshow" }).click();
  await expect(slideshow.getByRole("button", { name: "Play the slideshow" })).toBeVisible();

  // Joining stays one tap away on every slide.
  await expect(slideshow.getByRole("link", { name: "Request to join" })).toBeVisible();
});

test("visitors who prefer less motion get a still slideshow", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/en/about");
  const slideshow = page.getByRole("region", { name: "Pictures and words of welcome" });
  await expect(slideshow.getByRole("button", { name: "Play the slideshow" })).toBeVisible();
  await page.waitForTimeout(8000);
  await expect(slideshow.getByRole("group", { name: "1 of 3" })).toBeVisible();
  await context.close();
});
