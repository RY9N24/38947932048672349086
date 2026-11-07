import { test, expect } from "../fixtures/test";
import { PlatformPage } from "../pages/platform";
test.describe("Состав и права доступа", () => {
  test("S4: новая команда по ссылке, оба согласия, регистрация капитаном", async ({
    browser,
  }) => {
    const ca = await browser.newContext(),
      cb = await browser.newContext(),
      a = await ca.newPage(),
      b = await cb.newPage();
    const tag = Date.now();
    for (const [page, name, email] of [
      [a, "Капитан приёмки", `e2e-captain${tag}@demo.local`],
      [b, "Напарник приёмки", `e2e-partner${tag}@demo.local`],
    ] as const) {
      await page.goto("/login");
      await page
        .getByRole("button", { name: "Создать аккаунт", exact: true })
        .click();
      await page.getByLabel("Имя и фамилия").fill(name);
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Пароль", { exact: true }).fill("FairRound2026!");
      await page
        .getByRole("button", { name: "Зарегистрироваться", exact: true })
        .click();
      await expect(page).toHaveURL(/\/$/);
    }
    await a.goto("/teams");
    const name = "[E2E] Пара " + tag;
    await a.getByLabel("Название команды").fill(name);
    await a
      .getByRole("button", { name: "Создать команду", exact: true })
      .click();
    const invite = await a
      .getByRole("textbox", { name: "Пригласите напарника" })
      .inputValue();
    await b.goto(invite);
    await b
      .getByRole("button", { name: "Присоединиться", exact: true })
      .click();
    await expect(b.getByRole("heading", { name, exact: true })).toBeVisible();
    await a.goto("/contests/pairs");
    await b.goto("/contests/pairs");
    for (const page of [a, b]) {
      await page.getByRole("button", { name: "Согласие на запись" }).click();
      await new PlatformPage(page).consent();
    }
    await a
      .getByRole("combobox", { name: "Ваша команда" })
      .selectOption({ label: name });
    await a.getByRole("button", { name: "Записать команду" }).click();
    await expect(
      a.getByRole("button", { name: "Войти на арену" }),
    ).toBeVisible();
    await b.reload();
    await expect(
      b.getByRole("button", { name: "Войти на арену" }),
    ).toBeVisible();
    await ca.close();
    await cb.close();
  });
  test("участник не получает скрытые тесты, чужую запись и чужую отправку", async ({
    page,
  }) => {
    await new PlatformPage(page).login("u1");
    const problems = await page.request.get("/api/problems");
    const list = await problems.json();
    expect(list.every((p: any) => !("tests" in p))).toBe(true);
    const workspace = await page.request.get("/api/contexts/warmup/workspace");
    const data = await workspace.json();
    expect(
      data.problems.every((p: any) =>
        p.tests.every((t: any) => t.sample === true),
      ),
    ).toBe(true);
    expect(
      (await page.request.get("/api/integrity/qualifier/u6")).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post("/api/problems", {
          data: { title: "forbidden" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post("/api/contexts/warmup/editor", {
          data: {
            problemId: "paths",
            code: "print(1)",
            language: "python",
            seq: 1,
          },
        })
      ).status(),
    ).toBe(400);
  });
});
