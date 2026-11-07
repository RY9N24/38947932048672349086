import {PrismaClient} from '@prisma/client';
import {eventHash} from '../packages/shared';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import bcrypt from 'bcryptjs';
const references:Record<string,string>={sum:'a, b = map(int, input().split())\nprint(a + b)\n',max:'n = int(input())\nvalues = list(map(int, input().split()))\nprint(max(values))\n',brackets:"sequence = input().strip()\nbalance = 0\nvalid = True\nfor bracket in sequence:\n    balance += 1 if bracket == '(' else -1\n    if balance < 0:\n        valid = False\n        break\nprint('YES' if valid and balance == 0 else 'NO')\n",paths:'n, m = map(int, input().split())\ndp = [[1] * m for _ in range(n)]\nfor r in range(1, n):\n    for c in range(1, m):\n        dp[r][c] = dp[r-1][c] + dp[r][c-1]\nprint(dp[-1][-1])\n'};
export async function refreshDemo(db:PrismaClient){
 const now=Date.now();
 const tz=process.env.DISPLAY_TZ||'Europe/Samara';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const offset=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second)-Math.floor(now/1000)*1000;
 let daytime=Date.UTC(+parts.year,+parts.month-1,+parts.day,10)-offset;if(daytime>now)daytime-=86400000;
 for(const id of ['warmup','pairs']){const c=await db.contest.findUnique({where:{id}});if(c){const hour=+new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',hourCycle:'h23'}).format(c.startAt);if(hour<8||hour>20)await db.contest.update({where:{id},data:{startAt:new Date(daytime),duration:Math.ceil((now-daytime)/60000)+14*1440}});}}

 // Extend only designated demonstration contests. Preserve their original start
 // and submission times after the one-time daytime correction.
 for(const id of ['warmup','pairs']){const c=await db.contest.findUnique({where:{id}});if(c&&+c.startAt+c.duration*60000-now<3*86400000)await db.contest.update({where:{id},data:{duration:Math.ceil((now-+c.startAt)/60000)+14*1440}});}
 const evening=await db.contest.findUnique({where:{id:'evening'}});
 if(evening&&+evening.startAt<now){const date=new Date(now+86400000);date.setUTCHours(14,0,0,0);await db.contest.update({where:{id:'evening'},data:{startAt:date}});}
 const password=await bcrypt.hash('FairRound2026!',12);
 for(const [id,name] of [['bg9','Никита Волков'],['bg10','Мария Фомина']])await db.user.upsert({where:{id},create:{id,name,email:id+'@demo.local',password},update:{}});
 const background=['u5','u6','u7','u8','u9','u10','u11','u12','bg9','bg10'];
 const warmup=await db.contest.findUniqueOrThrow({where:{id:'warmup'}});
 for(const [i,userId] of background.entries()){
  await db.entry.upsert({where:{contestId_userId:{contestId:'warmup',userId}},create:{contestId:'warmup',userId},update:{}});
  await db.consent.upsert({where:{userId_contextId:{userId,contextId:'warmup'}},create:{userId,contextId:'warmup'},update:{}});
  for(let n=0;n<1+i%3;n++){const problemId=['sum','max','brackets'][n];const id=`demo-background-${userId}-${problemId}`;const createdAt=new Date(Math.min(now-60000,+warmup.startAt+(2+i+n*2)*60000));await db.submission.upsert({where:{id},create:{id,userId,contextId:'warmup',problemId,language:'python',code:references[problemId],status:n===2&&i%2?'WA':'OK',score:100,result:{synthetic:true,tests:[]},createdAt},update:{}});}
 }
 await db.team.upsert({where:{id:'demo-team-background'},create:{id:'demo-team-background',token:'demo-background-invite',name:'Без переполнения',captainId:'bg9',memberIds:['bg9','bg10']},update:{}});
 for(const [teamId,members] of [['demo-team',['u3','u4']],['demo-team-background',['bg9','bg10']]] as const){
  for(const userId of members){await db.entry.upsert({where:{contestId_userId:{contestId:'pairs',userId}},create:{contestId:'pairs',userId,teamId},update:{}});await db.consent.upsert({where:{userId_contextId:{userId,contextId:'pairs'}},create:{userId,contextId:'pairs'},update:{}});}
  for(const [n,problemId] of ['sum','max'].entries()){const id=`demo-pairs-${teamId}-${problemId}`;await db.submission.upsert({where:{id},create:{id,userId:members[n],teamId,contextId:'pairs',problemId,language:'python',code:references[problemId],status:'OK',score:100,result:{synthetic:true},createdAt:new Date(+warmup.startAt+(4+n*3)*60000)},update:{}});}
 }
 // A one-time versioned correction to synthetic histories; never rewrite real recordings.
 if(!await db.editorEvent.findUnique({where:{id:'demo-v3-u6-1'}})){
  const contest=await db.contest.findUniqueOrThrow({where:{id:'qualifier'}}),start=+contest.startAt;
  const pasted=readFileSync(resolve('demo/reference/sergey_sum.py'),'utf8').replaceAll('\r\n','\n');if(pasted.length!==912)throw Error('Demo paste must contain exactly 912 characters');
  for(let n=1;n<=12;n++){
   const userId='u'+n;const session=await db.editorSession.findUnique({where:{userId_contextId_problemId:{userId,contextId:'qualifier',problemId:'sum'}}});if(!session)continue;
   await db.editorEvent.deleteMany({where:{sessionId:session.id}});
   let previous='',seq=0;const code=n===6?pasted:references.sum;
   const events=n===6?[{type:'change',code:'# Черновик\n',ms:60000},{type:'blur',code:'# Черновик\n',ms:120000},{type:'focus',code:'# Черновик\n',ms:360000},{type:'paste',code,ms:366000},{type:'submit',code,ms:396000}]:Array.from({length:code.length},(_,i)=>({type:'change',code:code.slice(0,i+1),ms:60000+i*700+Math.floor(i/13)*2000})).sort((a,b)=>a.ms-b.ms);
   for(const e of events){const receivedAt=new Date(start+e.ms).toISOString(),payload={type:e.type,code:e.code,language:'python',meta:e.type==='paste'?{length:912,internal:false}:{},receivedAt};const hash=eventHash(previous,payload);await db.editorEvent.create({data:{id:`demo-v3-${userId}-${++seq}`,sessionId:session.id,seq,type:e.type,payload,previousHash:previous,hash,createdAt:new Date(receivedAt)}});previous=hash;}
   await db.editorSession.update({where:{id:session.id},data:{seq,hash:previous,code}});
   await db.submission.updateMany({where:{contextId:'qualifier',userId,problemId:'sum'},data:{code,createdAt:new Date(start+(n===6?396000:(8+n*3)*60000))}});
   if(n===6){await db.integrityFlag.updateMany({where:{contextId:'qualifier',userId,type:'EXTERNAL_PASTE'},data:{eventId:'demo-v3-u6-4',explanation:'Вставлено 912 символов извне редактора. Требуется ручная проверка.',createdAt:new Date(start+366000)}});await db.integrityFlag.updateMany({where:{contextId:'qualifier',userId,type:'AWAY_THEN_SOLVE'},data:{eventId:'demo-v3-u6-5',explanation:'Четыре минуты вне вкладки, затем вставка; OK через 30 секунд. Сигнал требует разбора.',createdAt:new Date(start+396000)}});}
  }
  await db.submission.deleteMany({where:{contextId:'qualifier',userId:{in:['u7','u8']},problemId:'brackets',id:{notIn:['demo-sim-u7','demo-sim-u8']}}});
  // Use the reference solution for each synthetic submission.
  for(const [problemId,code] of Object.entries(references))if(problemId!=='sum')await db.submission.updateMany({where:{contextId:'qualifier',problemId,id:{notIn:['demo-sim-u7','demo-sim-u8']}},data:{code}});
 }
}
