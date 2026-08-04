import { expect, test } from "@playwright/test";

test("login stays keyboard-accessible and visually stable on mobile", async ({ page }) => {
  await page.goto("/login");
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });

  const main = page.locator("main");
  await expect(main).toBeVisible();
  const loginInput = page.getByRole("textbox", { name: "Логин" });
  const passwordInput = page.getByLabel("Пароль");
  const rememberCheckbox = page.getByRole("checkbox", { name: /Запомнить меня/ });

  await expect(loginInput).toHaveAccessibleName("Логин");
  await expect(passwordInput).toHaveAccessibleName("Пароль");
  await expect(rememberCheckbox).toBeChecked();
  await expect(loginInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(passwordInput).toBeFocused();

  await expect(main).toHaveScreenshot("login-mobile-light.png");
});
