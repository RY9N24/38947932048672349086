import { Page, expect } from "@playwright/test";
export class PlatformPage {
  constructor(readonly page: Page) {}
  async login(role: "org" | "u1" | "u2" | "u3" | "u4") {
    await this.page.goto("/login");
    const label =
      role === "org"
        ? "Организатор ↗"
        : {
            u1: "Участник 1 · Иван ↗",
            u2: "Участник 2 · Анна ↗",
            u3: "Участник 3 · Дарья ↗",
            u4: "Участник 4 · Михаил ↗",
          }[role];
    await this.page.getByRole("button", { name: label, exact: true }).click();
    await expect(this.page).toHaveURL(role === "org" ? /\/org$/ : /\/$/);
  }
  async simpleEditor() {
    await expect(this.page.locator(".code-pane")).toBeVisible();
    const button = this.page.getByRole("button", {
      name: "Простой редактор",
      exact: true,
    });
    if (await button.isVisible()) await button.click();
    return this.page.locator('textarea[aria-label="Код решения"]');
  }
  async send(code: string) {
    const editor = await this.simpleEditor();
    await editor.fill(code);
    const response=this.page.waitForResponse(r=>r.url().endsWith('/api/submissions')&&r.request().method()==='POST');
    await this.page.getByRole('button',{name:'Отправить решение',exact:true}).click();
    const result=await (await response).json();
    expect(result.id,result.message).toBeTruthy();
    await expect(this.page.locator('.attempt').first()).toHaveAttribute('data-submission-id',result.id);
  }
  async consent() {
    await this.page
      .getByRole("checkbox", { name: "Понятно, участвую" })
      .check();
    await this.page
      .getByRole("button", { name: "Подтвердить согласие" })
      .click();
  }
}
