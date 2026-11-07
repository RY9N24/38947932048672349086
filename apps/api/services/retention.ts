import {PrismaClient} from '@prisma/client';
export async function cleanupRecordings(db:PrismaClient,now=Date.now()){
 const cutoff=new Date(now-30*86400000);
 const contests=await db.contest.findMany({where:{startAt:{lt:cutoff}},select:{id:true,startAt:true,duration:true}});
 const matches=await db.match.findMany({where:{endsAt:{lt:cutoff}},select:{id:true}});
 const contextIds=[...contests.filter(c=>+c.startAt+c.duration*60000<+cutoff).map(c=>c.id),...matches.map(m=>m.id)];
 if(!contextIds.length)return {sessions:0,events:0};
 return db.$transaction(async tx=>{
  const sessions=await tx.editorSession.findMany({where:{contextId:{in:contextIds}},select:{id:true}});
  const deletedEvents=await tx.editorEvent.deleteMany({where:{sessionId:{in:sessions.map(s=>s.id)}}});
  await tx.integrityFlag.deleteMany({where:{contextId:{in:contextIds}}});
  await tx.review.deleteMany({where:{contextId:{in:contextIds}}});
  const deletedSessions=await tx.editorSession.deleteMany({where:{contextId:{in:contextIds}}});
  return {sessions:deletedSessions.count,events:deletedEvents.count};
 });
}
