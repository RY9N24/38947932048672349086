import {PrismaClient} from '@prisma/client';
import {readFileSync} from 'node:fs';
const db=new PrismaClient();
async function main(){
 const manifestPath=process.argv.find(a=>a.startsWith('--manifest='))?.split('=')[1];
 const manifest=manifestPath?JSON.parse(readFileSync(manifestPath==='-'?0:manifestPath,'utf8')):{created:[]};
 const get=(table:string)=>manifest.created.filter((r:any)=>r.table===table).map((r:any)=>r.id) as string[];
 const contests=new Set(get('Contest')),matches=new Set(get('Match')),users=new Set(get('User')),teams=new Set(get('Team')),problems=new Set(get('Problem'));
 if(process.argv.includes('--legacy')){
  for(const c of await db.contest.findMany())if(/^(Приёмка \d{13}|\[E2E\])/.test(c.title))contests.add(c.id);
  for(const u of await db.user.findMany())if(/^(captain|partner)\d{13}@demo\.local$/.test(u.email)||u.email.startsWith('e2e-'))users.add(u.id);
  for(const t of await db.team.findMany())if(/^Пара приёмки \d{13}$/.test(t.name)||t.name.startsWith('[E2E]'))teams.add(t.id);
  for(const p of await db.problem.findMany())if(/^Квадрат E2E \d{13}$/.test(p.title)||p.title.startsWith('[E2E]'))problems.add(p.id);
 }
 if(process.argv.includes('--legacy')){const drafts=await db.editorSession.findMany({where:{code:'# Сохранённый черновик\n',userId:'u2'}});for(const m of await db.match.findMany({where:{hostId:'u1',guestId:'u2',surrenderedId:'u2'}}))if(drafts.some(s=>s.contextId===m.id))matches.add(m.id);}
 const contexts=[...contests,...matches],userIds=[...users],teamIds=[...teams];
 const testReviewIds:string[]=[];const testChatIds:string[]=[];
 if(process.argv.includes('--legacy'))for(const chat of await db.chat.findMany())if(/^Беру B после суммы(?: \d{13})?$/.test(chat.text))testChatIds.push(chat.id);

 if(process.argv.includes('--legacy')){const reviews=await db.review.findMany({where:{contextId:'qualifier'},orderBy:{createdAt:'asc'}});for(let i=0;i<reviews.length;i++){const r=reviews[i];if(/Проверка E2E|\[E2E\]|Демонстрационная дисквалификация для приёмки/.test(r.comment)){testReviewIds.push(r.id);const next=reviews[i+1];if(next&&next.userId===r.userId&&next.decision==='CLEAN'&&!next.comment&&+next.createdAt-+r.createdAt<60000)testReviewIds.push(next.id);}}}

 console.log(JSON.stringify({contexts,userIds,teamIds,problems:[...problems],submissions:get('Submission')},null,2));
 if(!process.argv.includes('--apply'))return;
 await db.$transaction(async tx=>{
  const where={OR:[{contextId:{in:contexts}},{userId:{in:userIds}}]};
  const sessions=await tx.editorSession.findMany({where});await tx.editorEvent.deleteMany({where:{sessionId:{in:sessions.map(s=>s.id)}}});await tx.editorSession.deleteMany({where});
  await tx.integrityFlag.deleteMany({where});await tx.review.deleteMany({where:{OR:[...where.OR,{comment:{contains:'Проверка E2E'}},{comment:{startsWith:'[E2E]'}},{id:{in:testReviewIds}}]}});
  await tx.submission.deleteMany({where:{OR:[...where.OR,{id:{in:get('Submission')}}]}});
  await tx.consent.deleteMany({where});await tx.entry.deleteMany({where:{OR:[{contestId:{in:contexts}},{userId:{in:userIds}},{teamId:{in:teamIds}}]}});
  await tx.claim.deleteMany({where:{OR:[{contextId:{in:contexts}},{userId:{in:userIds}},{teamId:{in:teamIds}}]}});
  await tx.chat.deleteMany({where:{OR:[{userId:{in:userIds}},{teamId:{in:teamIds}},{text:{startsWith:'[E2E]'}},{id:{in:testChatIds}}]}});
  await tx.match.deleteMany({where:{id:{in:[...matches]}}});await tx.contest.deleteMany({where:{id:{in:[...contests]}}});await tx.team.deleteMany({where:{id:{in:teamIds}}});await tx.user.deleteMany({where:{id:{in:userIds}}});
  // Only unreferenced test problems can be removed.
  const remaining=await tx.contest.findMany({select:{problemIds:true}}),otherMatches=await tx.match.findMany({select:{problemIds:true}}),used=new Set([...remaining,...otherMatches].flatMap(c=>c.problemIds));
  await tx.problem.deleteMany({where:{id:{in:[...problems].filter(id=>!used.has(id))}}});
 });console.log('Exact test objects removed');
}
main().finally(()=>db.$disconnect());
