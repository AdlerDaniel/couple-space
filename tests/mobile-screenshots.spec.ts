import { expect, test } from "@playwright/test";

const routes = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
  { name: "questions", path: "/questions" },
  { name: "questions-today", path: "/questions/today" },
  { name: "quizzes", path: "/quizzes" },
  { name: "chat", path: "/chat" },
  { name: "memories", path: "/memories" },
  { name: "dashboard", path: "/dashboard" },
  { name: "profile", path: "/profile" },
];

for (const route of routes) {
  test(`mobile screenshot: ${route.name}`, async ({ page }) => {
    await page.goto(route.path);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({
      path: `test-results/mobile-${route.name}.png`,
      fullPage: true,
    });
  });
}
