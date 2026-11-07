import { test, expect } from "../fixtures/test";
import { PlatformPage } from "../pages/platform";
test.describe("Инструменты организатора", () => {
  test("эталон проверяется настоящим воркером", async ({ page }) => {
    await new PlatformPage(page).login("org");
    await page.getByRole("button", { name: /Банк задач/ }).click();
    await page
      .locator(".problem-row")
      .filter({ hasText: "Сумма двух чисел" })
      .getByRole("button", { name: "Проверить эталоном" })
      .click();
    await page
      .getByRole("button", { name: "Запустить проверку", exact: true })
      .click();
    await expect(page.locator(".validation-result")).toContainText(
      "OK · Верно",
    );
    await expect(page.locator(".validation-result")).toContainText("Тест 3");
  });
  test("пара решений: сходство и отдельные записи; дисквалификация пересчитывает протокол", async ({
    page,
  }) => {
    await new PlatformPage(page).login("org");
    await page.goto("/replay/qualifier/u7");
    await expect(
      page.getByRole("heading", { name: "Похожие решения",level:2 }),
    ).toBeVisible();
    await page.locator(".comparison").filter({hasText:"Олег Зотов"}).first().locator("summary").click();
    await expect(page.locator(".comparison[open] .code-comparison")).toContainText("balance");
    await expect(page.locator(".comparison[open] .code-comparison")).toContainText("depth");
    await page
      .getByRole("button", { name: "Проверить целостность записи" })
      .click();
    await expect(page.getByText(/Цепочка цела:/)).toBeVisible();
    await page
      .getByRole("combobox", { name: "Статус", exact: true })
      .selectOption("DISQUALIFIED");
    await page
      .getByRole("textbox", { name: "Комментарий", exact: true })
      .fill("[E2E] Демонстрационная дисквалификация для приёмки.");
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Зафиксировать решение" }).click();
    await expect(page.locator(".review-history").first()).toContainText(
      "Дисквалифицирован",
    );
    await page.goto("/contests/qualifier");
    await expect(page.locator("tr.disqualified")).toContainText("Ольга Белова");
    await page.goto("/replay/qualifier/u7");
    await page
      .getByRole("combobox", { name: "Статус", exact: true })
      .selectOption("UNREVIEWED");
    await page.getByRole("button", { name: "Зафиксировать решение" }).click();
    await expect(page.locator(".review-history").first()).toContainText(
      "Не проверен",
    );
  });
});
