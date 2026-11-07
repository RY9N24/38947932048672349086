import { test, expect } from "../fixtures/test";
import { PlatformPage } from "../pages/platform";
test.describe("Обязательные сценарии жюри", () => {
  test("S1 + S2 + S6: новый контест, WA, OK и безопасный TLE", async ({
    browser,
  }) => {
    const orgContext = await browser.newContext(),
      participantContext = await browser.newContext();
    const org = await orgContext.newPage(),
      participant = await participantContext.newPage();
    const o = new PlatformPage(org),
      p = new PlatformPage(participant);
    await o.login("org");
    await org
      .getByRole("button", { name: "Добавить задачу", exact: true })
      .click();
    const title = "[E2E] Квадрат " + Date.now();
    await org.getByLabel("Название", { exact: true }).fill(title);
    await org
      .getByRole("button", { name: "Сохранить задачу", exact: true })
      .click();
    await expect(
      org.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await org
      .getByRole("button", { name: "Создать контест", exact: true })
      .click();
    const contest = "[E2E] Контест " + Date.now();
    await org.getByLabel("Название", { exact: true }).fill(contest);
    await org.getByRole("checkbox", { name: title, exact: true }).check();
    await org.getByRole("button", { name: "Опубликовать контест" }).click();
    await org
      .getByRole("link")
      .filter({ has: org.getByRole("heading", { name: contest, exact: true }) })
      .click();
    await expect(org).toHaveURL(/\/contests\//);
    const url = new URL(org.url()).pathname;
    await p.login("u1");
    await participant.goto(url);
    await participant
      .getByRole("button", { name: "Согласие на запись" })
      .click();
    await p.consent();
    await participant.getByRole("button", { name: "Войти на арену" }).click();
    await expect(
      participant.getByRole("heading", { name: /A\. \[E2E\] Квадрат/ }),
    ).toBeVisible();
    await p.send("print(4)");
    await expect(participant.locator(".attempt").first()).toContainText(
      "WA · Неверный ответ",
    );
    await expect(async () => {
      await p.send("n=int(input())\nprint(n*n)");
      await expect(participant.locator(".attempt").first()).toContainText(
        "OK · Верно",
        { timeout: 15000 },
      );
    }).toPass({ intervals: [5500], timeout: 25000 });
    await expect(org.getByRole("table")).toContainText("Иван Соколов");
    await expect(
      org.locator("tbody tr").filter({ hasText: "Иван Соколов" }),
    ).toContainText("+");
    await expect(async () => {
      await p.send("while True: pass");
      await expect(participant.locator(".attempt").first()).toContainText(
        "TLE · Время вышло",
        { timeout: 15000 },
      );
    }).toPass({ intervals: [5500], timeout: 30000 });
    await expect(async () => {
      await p.send("n=int(input())\nprint(n*n)");
      await expect(participant.locator(".attempt").first()).toContainText(
        "OK · Верно",
        { timeout: 15000 },
      );
    }).toPass({ intervals: [5500], timeout: 25000 });
    await orgContext.close();
    await participantContext.close();
  });
  test("S3: приглашение, готовность двух участников, сохранение кода, победитель", async ({
    browser,
  }) => {
    const ca = await browser.newContext(),
      cb = await browser.newContext();
    const a = await ca.newPage(),
      b = await cb.newPage();
    const pa = new PlatformPage(a),
      pb = new PlatformPage(b);
    await pa.login("u1");
    await pb.login("u2");
    await a.goto("/duels");
    await a.getByRole("button", { name: "Создать дуэль", exact: true }).click();
    await expect(a).toHaveURL(/\/matches\//);
    const matchUrl = new URL(a.url()).pathname;
    const invite = await a
      .getByRole("textbox", { name: "Ссылка сопернику" })
      .inputValue();
    await b.goto(invite);
    await b.getByRole("button", { name: "Принять вызов" }).click();
    await expect(b).toHaveURL(/\/matches\//);
    await pa.consent();
    await pb.consent();
    await a.getByRole("button", { name: "Готов к раунду" }).click();
    await b.getByRole("button", { name: "Готов к раунду" }).click();
    await expect(
      a.getByRole("heading", { name: "A. Сумма двух чисел" }),
    ).toBeVisible();
    await expect(
      b.getByRole("heading", { name: "A. Сумма двух чисел" }),
    ).toBeVisible();
    await pa.send("a,b=map(int,input().split())\nprint(a+b)");
    await expect(a.locator(".attempt").first()).toContainText("OK · Верно");
    await expect(b.locator(".arena-score")).toContainText("1");
    const editor = await pb.simpleEditor();
    await editor.fill("# Сохранённый черновик\n");
    await expect(
      b.getByText("Изменения сохранены", { exact: true }),
    ).toBeVisible();
    await b.reload();
    const restored = await pb.simpleEditor();
    await expect(restored).toHaveValue("# Сохранённый черновик\n");
    b.on("dialog", (d) => d.accept());
    await b.getByRole("button", { name: "Сдаться", exact: true }).click();
    await expect(
      b.getByRole("heading", { name: "Иван Соколов", exact: true }).first(),
    ).toBeVisible();
    await a.goto(matchUrl);
    await expect(a.getByText(/Протокол заверен: sha256/)).toBeVisible();
    await ca.close();
    await cb.close();
  });
  test("S4: команда, приглашение, согласие двух участников и общий результат", async ({
    browser,
  }) => {
    const ca = await browser.newContext(),
      cb = await browser.newContext();
    const a = await ca.newPage(),
      b = await cb.newPage();
    const pa = new PlatformPage(a),
      pb = new PlatformPage(b);
    await pa.login("u3");
    await pb.login("u4");
    await a.goto("/teams");
    await expect(
      a.getByRole("heading", { name: "Две переменные", exact: true }),
    ).toBeVisible();
    await a.goto("/contests/pairs");
    await b.goto("/contests/pairs");
    await a.getByRole("button", { name: "Войти на арену" }).click();
    await b.getByRole("button", { name: "Войти на арену" }).click();
    await expect(a.locator('.partner-summary')).toBeVisible();
    const release=a.getByRole('button',{name:'Отдать задачу',exact:true});
    if(await release.isVisible())await release.click();
    await a.getByRole('button',{name:'Взять задачу',exact:true}).click();
    await expect(
      b.getByText("Задача у напарника", { exact: true }),
    ).toBeVisible();
    const edit = await pa.simpleEditor();
    await edit.fill("a,b=map(int,input().split())\nprint(a+b)");
    await b.getByRole("button", { name: "Код напарника", exact: true }).click();
    await expect(async () => {
      await expect(b.locator(".monaco-editor")).toContainText("a+b");
    }).toPass({ timeout: 15000 });
    await a
      .getByRole("button", { name: "Отправить решение", exact: true })
      .click();
    await expect(b.locator(".attempt").first()).toContainText("OK · Верно");
    const message='[E2E] Беру B после суммы '+Date.now();
    await a.getByRole('textbox',{name:'Сообщение напарнику'}).fill(message);
    await a.getByRole("button", { name: "Отправить сообщение" }).click();
    await expect(b.getByText(message)).toBeVisible();
    await a.getByRole("button", { name: "Протокол", exact: true }).click();
    await expect(a.getByRole("table")).toContainText("Две переменные");
    await ca.close();
    await cb.close();
  });
  test("S5: повтор, переход к вставке, проверка цепочки и решение организатора", async ({
    page,
  }) => {
    const p = new PlatformPage(page);
    await p.login("org");
    await page.getByRole("link", { name: "Видеоповторы", exact: true }).click();
    await page
      .getByRole("link")
      .filter({ hasText: "Сергей Климов" })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Внешняя вставка" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "К моменту", exact: true })
      .last()
      .click();
    await expect(page.locator(".replay-code pre")).toContainText("solve");
    await page
      .getByRole("button", { name: "Проверить целостность записи" })
      .click();
    await expect(page.getByText(/Цепочка цела:/)).toBeVisible();
    await page.getByLabel("Статус", { exact: true }).selectOption("SUSPICIOUS");
    await page
      .getByLabel("Комментарий", { exact: true })
      .fill("[E2E] Нужен разбор внешней вставки.");
    await page.getByRole("button", { name: "Зафиксировать решение" }).click();
    await expect(page.locator(".review-history").first()).toContainText(
      "Требуется разбор",
    );
  });
});
