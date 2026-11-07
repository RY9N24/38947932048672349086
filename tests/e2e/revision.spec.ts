import {test,expect} from '../fixtures/test';
import {readFileSync} from 'node:fs';
import {PlatformPage} from '../pages/platform';
test('demo access is present in raw server HTML; timezone is explicit',async({request,page})=>{
 const html=await (await request.get('/login')).text();expect(html).toContain('Демо-доступ');expect(html).toContain('Иван Соколов');
 await page.goto('/login');await expect(page.getByRole('heading',{name:'Допуск к соревнованию'})).toBeVisible();await expect(page.locator('.server-clock')).toContainText('САМ');
 const warmup=await (await request.get('/api/contests/warmup')).json();expect(+new Date(warmup.startAt)+warmup.duration*60000-Date.now()).toBeGreaterThan(13*86400000);expect(warmup.entries).toBeGreaterThanOrEqual(14);
});
test('risk filter, honest review default, multitrack seek and mobile organizer navigation',async({page})=>{
 await new PlatformPage(page).login('org');await page.goto('/records');await page.getByRole('checkbox',{name:'Только высокий риск'}).check();await expect(page.locator('.register-row')).not.toHaveCount(0);expect(await page.locator('.risk-reading.low,.risk-reading.medium').count()).toBe(0);
 await page.goto('/replay/qualifier/u5');await expect(page.getByRole('combobox',{name:'Статус',exact:true})).toHaveValue('UNREVIEWED');await page.goto('/replay/qualifier/u6');await page.locator('.track-event.paste').click();await expect(page.locator('.paste-highlight')).toContainText('def solve');await expect(page.locator('.away-segment')).toBeVisible();await expect(page.locator('.review-journal')).not.toContainText('Проверка E2E');
 await page.setViewportSize({width:390,height:844});const org=page.getByRole('navigation',{name:'Основная навигация'}).getByRole('link',{name:'Судейская'});await org.scrollIntoViewIfNeeded();await org.click();await expect(page).toHaveURL(/\/org$/);
});

test('synthetic history is chronological and the 912-character program passes real sandbox tests',async({page})=>{
 await new PlatformPage(page).login('org');const replay=await (await page.request.get('/api/integrity/qualifier/u6')).json();const paste=replay.events.find((e:any)=>e.type==='paste'),blur=replay.events.find((e:any)=>e.type==='blur'),focus=replay.events.find((e:any)=>e.type==='focus'),submit=replay.events.find((e:any)=>e.type==='submit');expect(paste.payload.code.length).toBe(912);expect(+new Date(focus.createdAt)-+new Date(blur.createdAt)).toBe(240000);expect(+new Date(submit.createdAt)-+new Date(paste.createdAt)).toBe(30000);
 const natural=await (await page.request.get('/api/integrity/qualifier/u1')).json();const changes=natural.events.filter((e:any)=>e.type==='change'&&e.sessionId===natural.sessions.find((s:any)=>s.problemId==='sum').id);for(let i=1;i<changes.length;i++)expect(changes[i].payload.code.length).toBeGreaterThanOrEqual(changes[i-1].payload.code.length);
 await page.goto('/org');await page.getByRole('button',{name:/Банк задач/}).click();await page.locator('.problem-row').filter({hasText:'Сумма двух чисел'}).getByRole('button',{name:'Проверить эталоном'}).click();await page.getByRole('textbox',{name:'Код эталона'}).fill(readFileSync('demo/reference/sergey_sum.py','utf8').replaceAll('\r\n','\n'));await page.getByRole('button',{name:'Запустить проверку',exact:true}).click();await expect(page.locator('.validation-result')).toContainText('OK · Верно');await expect(page.locator('.validation-result')).toContainText('Тест 3');
});
