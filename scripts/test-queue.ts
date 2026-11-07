import {PrismaClient} from '@prisma/client';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const requireApi=createRequire(resolve('apps/api/package.json'));
const {Queue}=requireApi('bullmq');const Redis=requireApi('ioredis');
const db=new PrismaClient();const redis=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:null});const queue=new Queue('judge',{connection:redis});
const contextId='loadtest:'+randomUUID();
async function main(){
 const start=Date.now();const health=process.env.HEALTH_URL||'http://localhost:3001/api/health';let maxHealthMs=0,healthChecks=0;
 const ids:string[]=[];for(let i=0;i<21;i++){const s=await db.submission.create({data:{userId:'u1',contextId,problemId:'sum',language:'python',code:i===20?'a,b=map(int,input().split());print(a+b)':'while True: pass'}});ids.push(s.id);}
 await queue.addBulk(ids.map(id=>({name:'judge',data:{submissionId:id},opts:{jobId:id,priority:2,removeOnComplete:true,removeOnFail:10}})));
 while(Date.now()-start<150000){const before=Date.now();const response=await fetch(health,{signal:AbortSignal.timeout(5000)});assert.equal(response.status,200);healthChecks++;maxHealthMs=Math.max(maxHealthMs,Date.now()-before);const remaining=await db.submission.count({where:{contextId,status:{in:['QUEUED','RUNNING']}}});if(!remaining)break;await new Promise(r=>setTimeout(r,500));}
 const results=await db.submission.findMany({where:{contextId},orderBy:{createdAt:'asc'}});assert.equal(results.filter(r=>r.status==='TLE').length,20,JSON.stringify(results.map(r=>r.status)));assert.equal(results.find(r=>r.id===ids[20])?.status,'OK');
 const report={submitted:21,tle:20,recovery:'OK',healthChecks,maxHealthMs,elapsedMs:Date.now()-start};console.log(JSON.stringify(report));
 await db.submission.deleteMany({where:{contextId}});
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{await queue.close();redis.disconnect();await db.$disconnect();});
