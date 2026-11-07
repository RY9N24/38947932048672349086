import {PrismaClient} from '@prisma/client';
import {cleanupRecordings} from '../apps/api/services/retention';
import assert from 'node:assert/strict';
const db=new PrismaClient();
async function main(){const id='retention-test-'+Date.now();await db.contest.create({data:{id,title:'Retention test',authorId:'org',problemIds:['sum'],startAt:new Date(Date.now()-32*86400000),duration:1}});const s=await db.editorSession.create({data:{userId:'u1',contextId:id,problemId:'sum'}});await db.editorEvent.create({data:{sessionId:s.id,seq:1,type:'change',payload:{code:'test'},hash:'test',previousHash:''}});const activeBefore=await db.editorSession.count({where:{contextId:'warmup'}});await cleanupRecordings(db);assert.equal(await db.editorSession.count({where:{contextId:id}}),0);assert.equal(await db.editorEvent.count({where:{sessionId:s.id}}),0);assert.equal(await db.editorSession.count({where:{contextId:'warmup'}}),activeBefore);await db.contest.delete({where:{id}});console.log('Expired recordings deleted; active recordings preserved');}
main().finally(()=>db.$disconnect());
