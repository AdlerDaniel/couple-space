import { expect, test } from "@playwright/test";

test("login stays keyboard-accessible and visually stable on mobile", async ({ page }) => {
  await page.goto("/login");
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });

  const loginInput = page.getByRole("textbox", { name: "Логин" });
  const passwordInput = page.getByLabel("Пароль");
  const rememberCheckbox = page.getByRole("checkbox", { name: /Запомнить меня/ });
  const submitButton = page.getByRole("button", { name: "Войти" });
  const main = page.getByRole("main").filter({ has: loginInput });

  await expect(main).toBeVisible();
  expect(await main.boundingBox()).toMatchObject({ width: 390, height: 904 });

  await expect(loginInput).toHaveAccessibleName("Логин");
  await expect(passwordInput).toHaveAccessibleName("Пароль");
  await expect(rememberCheckbox).toBeChecked();
  await expect(submitButton).toBeVisible();
  await expect(loginInput).toBeFocused();
  await passwordInput.focus();
  await expect(passwordInput).toBeFocused();

  await expect(main).toHaveScreenshot("login-mobile-light.png");
});
