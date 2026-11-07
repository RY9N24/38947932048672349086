import { test, expect } from "../fixtures/test";
import AxeBuilder from "@axe-core/playwright";
import { PlatformPage } from "../pages/platform";
import { mkdirSync, writeFileSync } from "node:fs";
test.describe("Дизайн и доступность", () => {
  test("экраны в пяти размерах, шрифты, переполнения и axe", async ({
    browser,
  }) => {
    test.setTimeout(240000);
    mkdirSync("docs/screens", { recursive: true });
    const violations: any[] = [];
    const screens:any[] = [
      { path: "/", role: "u1", name: "board", heading: "Табло" },
      { path: "/login", role: null, name: "login", heading: "Допуск к соревнованию" },
      {
        path: "/contests",
        role: "u1",
        name: "contests",
        heading: "Выберите раунд",
      },
      {
        path: "/contests/warmup",
        role: "u1",
        name: "contest",
        heading: "Разминка. Первый раунд",
      },
      { path: "/duels", role: "u1", name: "duels", heading: "Дуэли" },
      { path: "/teams", role: "u3", name: "teams", heading: "Команды из двух" },
      {
        path: "/records",
        role: "org",
        name: "records",
        heading: "Видеоповторы",
      },
      { path: "/org", role: "org", name: "organizer", heading: "Судейская" },
      {
        path: "/replay/qualifier/u6",
        role: "org",
        name: "replay",
        heading: "Сергей Климов",
      },
      {
        path: "/arena/warmup",
        role: "u1",
        name: "arena",
        heading: "A. Сумма двух чисел",
      },
      {
        path: "/arena/pairs",
        role: "u3",
        name: "team-arena",
        heading: "A. Сумма двух чисел",
      },
      {path:'/org',role:'org',name:'problem-form',heading:'Условие и проверка',action:'Добавить задачу'},
      {path:'/org',role:'org',name:'contest-form',heading:'Новый контест',action:'Создать контест'},
      {path:'/matches/demo-duel',role:'u1',name:'duel-result',heading:'Ничья'},
      {path:'/invite/demo-duel-invite',role:'u2',name:'invitation',heading:'Иван Соколов'},
      {path:'/contests/evening',role:'u1',name:'consent',heading:'Записываем путь к решению',action:'Согласие на запись'},
      {path:'/replay/qualifier/u7',role:'org',name:'comparison',heading:'Ольга Белова'},
      {path:'/duels',role:'u1',name:'duel-lobby',heading:'Дождитесь сигнала',action:'Создать дуэль'},
      {
        path: "/_design",
        role: null,
        name: "design",
        heading: "Судейский протокол",
      },
    ];
    for (const screen of screens) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      if (screen.role) await new PlatformPage(page).login(screen.role as any);
      await page.goto(screen.path);
      if(screen.action)await page.getByRole("button",{name:screen.action,exact:true}).first().click();
      await expect(
        page
          .getByRole("heading", { name: screen.heading, exact: true })
          .first(),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if(screen.name.includes('arena'))await expect(page.locator('.monaco-editor')).toBeVisible();
      if(screen.name==='comparison')await page.locator('.comparison summary').first().click();
      const headingFonts=await page.evaluate(async()=>{const style=getComputedStyle(document.querySelector('h1')!);const faces=await document.fonts.load(style.fontWeight+' 16px '+style.fontFamily,'Честный раунд');return faces.map(f=>({family:f.family,status:f.status}));});
      expect(headingFonts.length,'Local heading face must exist').toBeGreaterThan(0);
      expect(headingFonts.every(f=>f.status==='loaded')).toBe(true);
      for (const [width, height] of [
        [1280, 800],
        [1440, 900],
        [1920, 1080],
        [768, 1024],
        [390, 844],
      ]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({
          path: `docs/screens/${screen.name}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${screen.name} horizontal overflow at ${width}`,
        ).toBe(true);
        const overflow = await page
          .locator("h1,h2,h3,p,button,label")
          .evaluateAll((nodes) =>
            nodes
              .filter((e) => {
                const h = e as HTMLElement;
                return (
                  !!e.textContent?.trim() &&
                  h.offsetWidth > 0 &&
                  h.scrollWidth > h.clientWidth + 2 &&
                  getComputedStyle(h).overflowX === "visible"
                );
              })
              .map((e) => e.textContent?.slice(0, 80)),
          );
        expect(overflow, `${screen.name} text overflow ${width}`).toEqual([]);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      const result = await new AxeBuilder({ page })
        .include(".app")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      violations.push(
        ...result.violations.map((x) => ({
          screen: screen.name,
          id: x.id,
          impact: x.impact,
          nodes: x.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      );
      expect(errors, screen.name + " runtime errors").toEqual([]);
      await ctx.close();
    }
    writeFileSync(
      "docs/screens/axe-report.json",
      JSON.stringify(violations, null, 2),
    );
    expect(violations).toEqual([]);
  });
  test("состояния загрузки, ошибки, пустого списка и согласия", async ({
    browser,
  }) => {
    const c = await browser.newContext();
    const page = await c.newPage();
    await page.goto("/_design");
    await expect(
      page.getByRole("heading", { name: "Судейский протокол" }),
    ).toBeVisible();
    await page.screenshot({ path: "docs/screens/states.png", fullPage: true });
    await c.close();
  });
});
