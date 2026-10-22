import { expect, test, type Page } from "@playwright/test";
import { logIn, openAs, people } from "./helpers";

/** Accepts the "Are you sure?" questions the app asks before deleting things. */
function acceptConfirmations(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
}

test("sharing a post, reacting, replying and deleting it", async ({ page }) => {
  acceptConfirmations(page);
  await logIn(page, people.lakshmi);
  const text = `Does anyone know a good occupational therapist in Madurai? (${Date.now()})`;

  await page.getByPlaceholder("Share a thought, ask a question or celebrate a small victory…").fill(text);
  await page.getByRole("group", { name: "What kind of post is this?" }).getByText("Question").click();
  await expect(page.getByRole("radio", { name: "Question" })).toBeChecked();
  await page.getByRole("button", { name: "Share", exact: true }).click();

  const post = page.getByTestId("post").filter({ hasText: text });
  await expect(post).toBeVisible();
  await expect(post).toContainText("Question");

  await post.getByRole("button", { name: /Support/ }).click();
  await expect(post.getByRole("button", { name: /Support/ })).toHaveAttribute("aria-pressed", "true");

  await post.getByRole("link", { name: "Reply" }).click();
  await page.getByPlaceholder("Write a kind reply…").fill("Following, we need one too.");
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.getByTestId("comment").filter({ hasText: "Following, we need one too." })).toBeVisible();

  await page.getByTestId("post").getByRole("button", { name: "More actions" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/en\/feed$/);
  // Recently visited pages stay hidden in the page for the back button, so only count what is shown.
  await expect(page.getByTestId("post").filter({ hasText: text, visible: true })).toHaveCount(0);
});

test("posting without a name", async ({ page, browser }) => {
  await logIn(page, people.selvi);
  const text = `Some days I just need to cry in the bathroom. (${Date.now()})`;
  await page.getByPlaceholder("Share a thought, ask a question or celebrate a small victory…").fill(text);
  await page.getByLabel("Post without my name").check();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const mine = page.getByTestId("post").filter({ hasText: text });
  await expect(mine).toContainText("You (shared without your name)");

  const other = await openAs(browser, people.arun);
  const theirs = other.page.getByTestId("post").filter({ hasText: text });
  await expect(theirs).toContainText("A parent");
  await expect(theirs).not.toContainText("Selvi");
  await other.close();
});

test("organising an event", async ({ page }) => {
  await logIn(page, people.priya);
  await page.goto("/en/events/new");
  const title = `Music and movement for little ones ${Date.now()}`;
  await page.getByLabel("Event name").fill(title);
  await page.getByLabel("Description").fill("A gentle hour of songs and movement. Ear defenders welcome.");
  const date = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Date").fill(date);
  await page.getByLabel("Starts at").fill("10:30");
  await page.getByLabel("Ends at").fill("11:30");
  await page.getByLabel("City or area").fill("Velachery, Chennai");
  await page.getByLabel("Full address").fill("Community hall, 3rd floor, lift available");
  await page.getByText("Sensory-friendly", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Sensory-friendly" })).toBeChecked();
  await page.getByRole("button", { name: "Save event" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("You are organising this event.")).toBeVisible();
  await expect(page.getByText("Community hall, 3rd floor, lift available")).toBeVisible();
  await expect(page.getByText(/10:30\sam/).first()).toBeVisible();

  await page.goto("/en/events");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("writing a blog with a preview", async ({ page }) => {
  await logIn(page, people.fathima);
  await page.goto("/en/blogs/new");
  const title = `What our daughter taught me about patience ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Short summary").fill("Small lessons from a big year.");
  await page.getByRole("textbox", { name: "Your story" }).fill("We learned to **slow down**.\n\n- Celebrate small steps\n- Rest when you can");
  await page.getByLabel("Topics").fill("parenting, down syndrome");
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.locator("strong", { hasText: "slow down" })).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator("article li", { hasText: "Celebrate small steps" })).toBeVisible();
  await page.goto("/en/blogs");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("joining an open group and asking to join a private one", async ({ page, browser }) => {
  await logIn(page, people.vijay);
  await page.goto("/en/groups");
  await page.getByRole("link", { name: "Chennai Autism Parents" }).click();
  await page.getByRole("button", { name: "Join group" }).click();
  await expect(page.getByRole("link", { name: "Members" })).toBeVisible();

  await page.goto("/en/groups");
  await page.getByRole("link", { name: "Coimbatore Families" }).click();
  await page.getByLabel("A short note for the group admins").fill("We moved to Tiruppur last month.");
  await page.getByRole("button", { name: "Ask to join" }).click();
  await expect(page.getByText("Your request is waiting for a group admin.")).toBeVisible();
  const groupUrl = page.url();

  const owner = await openAs(browser, people.arun);
  await owner.page.goto(`${groupUrl}/manage`);
  const request = owner.page.getByRole("listitem").filter({ hasText: "We moved to Tiruppur last month." });
  await request.getByRole("button", { name: "Approve" }).click();
  await expect(request).toHaveCount(0);
  await owner.close();

  await page.reload();
  await expect(page.getByRole("link", { name: "Members" })).toBeVisible();
});

test("a moderator removes a harmful comment that was reported", async ({ page, browser }) => {
  acceptConfirmations(page);
  await logIn(page, people.moderator);
  await page.goto("/en/admin/reports");
  const report = page.getByTestId("report").filter({ hasText: "herbal oil" });
  await expect(report).toBeVisible();
  await report.getByRole("button", { name: "Remove content" }).click();
  await expect(report).toHaveCount(0);

  const member = await openAs(browser, people.priya);
  await member.page.goto("/en/feed");
  await expect(member.page.getByText("herbal oil")).toHaveCount(0);
  await member.close();

  await page.goto("/en/admin/audit");
  await expect(page.getByText(/Karthik Raman .*removed reported content/i)).toBeVisible();
});

test("notifications can be marked as read", async ({ page }) => {
  await logIn(page, people.priya);
  await page.goto("/en/notifications");
  await expect(page.getByTestId("notification-unread").first()).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByTestId("notification-unread")).toHaveCount(0);
});
