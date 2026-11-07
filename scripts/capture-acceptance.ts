import {chromium,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {PlatformPage} from '../tests/pages/platform';
async function main(){
 const mode=process.env.CAPTURE_PHASE||'before',baseURL=process.env.TEST_BASE_URL||'https://fairround.176.53.244.36.sslip.io';mkdirSync(`docs/screens/${mode}`,{recursive:true});
 const browser=await chromium.launch({channel:'chrome'});
 const screens=[['board','/','org'],['login','/login',''],['contests','/contests','org'],['contest','/contests/warmup','org'],['records','/records','org'],['replay','/replay/qualifier/u6','org'],['comparison','/replay/qualifier/u7','org'],['organizer','/org','org'],['teams','/teams','u3'],['duels','/duels','u1'],['duel-result','/matches/demo-duel','u1'],['invitation','/invite/demo-duel-invite','u2'],['arena','/arena/warmup','u1'],['team-arena','/arena/pairs','u3'],['design','/_design','']];
 for(const [name,path,role] of screens){const ctx=await browser.newContext({baseURL}),page=await ctx.newPage();if(role)await new PlatformPage(page).login(role as any);await page.goto(path);await expect(page.locator('h1,h2').first()).toBeVisible();await page.evaluate(()=>document.fonts.ready);await page.locator('.loading').waitFor({state:'hidden'}).catch(()=>{});
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===1440?900:844});await page.screenshot({path:`docs/screens/${mode}/${name}-${width}.png`,fullPage:true,animations:'disabled'});}
 if(name==='organizer')for(const [label,file] of [['Добавить задачу','problem-form'],['Создать контест','contest-form']]){await page.goto('/org');await page.getByRole('button',{name:label,exact:true}).first().click();for(const width of [1440,390]){await page.setViewportSize({width,height:width===1440?900:844});await page.screenshot({path:`docs/screens/${mode}/${file}-${width}.png`,fullPage:true});}}
 await ctx.close();}await browser.close();}
main().catch(e=>{console.error(e);process.exit(1)});

