import {test as base,expect,BrowserContext,Response} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
// Production runs must be explicit and leave an auditable list of created IDs.
export const test=base.extend<{_manifest:void}>({_manifest:[async({browser,context},use,info)=>{
 const target=String(info.project.use.baseURL||'');if(!/localhost|127\.0\.0\.1/.test(target)&&process.env.TEST_ALLOW_PRODUCTION!=='1')throw Error('Production E2E requires TEST_ALLOW_PRODUCTION=1 and manifest cleanup. Use local Compose by default.');
 const created:{table:string,id:string}[]=[],pending:Promise<void>[]=[];
 const receive=(response:Response)=>{const p=(async()=>{if(response.request().method()!=='POST'||!response.ok())return;const pathname=new URL(response.url()).pathname;const tables:Record<string,string>={'/api/contests':'Contest','/api/problems':'Problem','/api/matches':'Match','/api/teams':'Team','/api/auth/register':'User','/api/submissions':'Submission'};const table=tables[pathname]||(/^\/api\/problems\/[^/]+\/verify$/.test(pathname)?'Submission':undefined);if(!table)return;const data=await response.json().catch(()=>null);if(data?.id)created.push({table,id:data.id});})();pending.push(p);};
 const attach=(ctx:BrowserContext)=>ctx.on('response',receive);attach(context);
 const original=browser.newContext.bind(browser);browser.newContext=async(options)=>{const ctx=await original(options);attach(ctx);return ctx;};
 try{await use();}finally{browser.newContext=original;await Promise.allSettled(pending);mkdirSync('artifacts/test-manifests',{recursive:true});writeFileSync(`artifacts/test-manifests/${Date.now()}-${info.testId.replace(/[^a-z0-9]/gi,'')}.json`,JSON.stringify({target,test:info.title,created},null,2));}
 },{auto:true}]});
export {expect};
