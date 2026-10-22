import { test, expect } from "@playwright/test";
import { answerApi, SMALL_SCALE } from "../perf/fixtures";

// Review the actual production UI with synthetic responses. Every API request is
// intercepted so these checks cannot create backups or change a live database.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("access_token", "admin-ui-review-fixture"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/notifications/stream") {
      await route.fulfill({ contentType: "text/event-stream", body: ": keepalive\n\n" });
      return;
    }
    const answer = answerApi(request.method(), url, { identity: "ADMINISTRATOR", scale: SMALL_SCALE });
    if (answer) {
      const response = JSON.parse(answer.body);
      if (url.pathname.endsWith("/maintenance/backups")) response.data[0].displayName = "Before October hiring";
      if (url.pathname.endsWith("/audit-logs")) response.data[0].action = "MFA_CHALLENGE_FAILED";
      await route.fulfill({ status: answer.status, contentType: "application/json", body: JSON.stringify(response) });
    } else if (request.method() === "PUT" && url.pathname.endsWith("/candidate-scoring/configuration")) {
      await route.fulfill({ json: { success: true, data: request.postDataJSON() } });
    } else if (request.method() === "PATCH" && url.pathname.endsWith("/rename")) {
      await route.fulfill({ json: { success: true, data: { id: "perf-backup-0001", displayName: request.postDataJSON().name, createdAt: "2026-10-22T12:00:00Z" } } });
    } else {
      await route.fulfill({ status: 404, json: { success: false, message: "No review fixture" } });
    }
  });
});

test("overview shares TA typography and shows only backup status and creation date", async ({ page }, testInfo) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administration overview" })).toBeVisible();
  const panel = page.getByRole("region", { name: "Backups", exact: true });
  await expect(panel.getByText("Latest backup status")).toBeVisible();
  await expect(panel.getByText("Creation date")).toBeVisible();
  await expect(panel.getByText("Completed", { exact: true })).toBeVisible();
  await expect(panel).not.toContainText("AES-256");
  await expect(panel).not.toContainText("Protection");
  await expect(page.locator(".admin-portal")).toHaveCSS("font-family", /Archivo/);
  await expect(page.locator(".admin-nav-link[data-status=active]")).toHaveCSS("border-left-color", "rgb(200, 16, 46)");
  await page.screenshot({ path: testInfo.outputPath("overview.png"), fullPage: true });
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await expect(page.locator("aside").last()).toHaveCSS("width", "64px");
  const toggle = await page.getByRole("button", { name: "Expand navigation" }).boundingBox();
  expect(toggle!.x + toggle!.width).toBeLessThanOrEqual(64);
});

test("slider changes stay at 100% and save those same values", async ({ page }, testInfo) => {
  await page.goto("/admin/scoring");
  const slider = page.getByRole("slider", { name: "Skills weight", exact: true });
  await expect(slider).toHaveValue("30");
  for (const value of [100, 0, 65, 99.99]) {
    await slider.fill(String(value));
    const values = await page.locator('input[id$="-weight"]').evaluateAll((inputs) => inputs.map((input) => Number((input as HTMLInputElement).value)));
    expect(values.reduce((sum, weight) => sum + Math.round(weight * 100), 0)).toBe(10000);
    expect(values[0]).toBe(value);
    await expect(page.getByText("100% ✓ Ready", { exact: true })).toBeVisible();
  }
  const saved = page.waitForRequest((request) => request.method() === "PUT" && request.url().includes("/candidate-scoring/configuration"));
  await page.getByRole("button", { name: "Save matching settings" }).click();
  const weights = (await saved).postDataJSON().weights as Record<string, number>;
  expect(Object.values(weights).reduce((sum, weight) => sum + Math.round(weight * 100), 0)).toBe(10000);
  await page.screenshot({ path: testInfo.outputPath("matching-settings.png"), fullPage: true });
});

test("activity history capitalizes MFA", async ({ page }) => {
  await page.goto("/admin/audit");
  await expect(page.getByText("MFA Challenge Failed", { exact: true }).last()).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Mfa");
});

test("backup table and rename dialog use the custom name", async ({ page }, testInfo) => {
  await page.goto("/admin/maintenance");
  await expect(page.getByText("Before October hiring", { exact: true }).last()).toBeVisible();
  await expect(page.locator("main")).not.toContainText("megs-backup-perf");
  await page.getByRole("button", { name: "Actions for Before October hiring" }).last().click();
  await page.getByRole("menuitem", { name: "Rename backup" }).click();
  await expect(page.getByLabel("Backup name", { exact: true })).toHaveValue("Before October hiring");
  await page.getByLabel("Backup name", { exact: true }).fill("October checkpoint");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Saved as October checkpoint.", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("backups.png"), fullPage: true });
});

test("mobile layout has no horizontal overflow and navigation is keyboard accessible", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/scoring");
  await expect(page.getByRole("slider", { name: "Skills weight", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Admin navigation" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS("background-color", "rgb(8, 29, 56)");
  await expect(drawer).toHaveCSS("border-top-color", "rgb(200, 16, 46)");
  await page.screenshot({ path: testInfo.outputPath("mobile-navigation.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeFocused();
});
