import { Worker } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { runSandbox } from "./sandbox";
const db = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const worker = new Worker(
  "judge",
  async (job) => {
    const s = await db.submission.findUniqueOrThrow({
      where: { id: job.data.submissionId },
    });
    if (!["QUEUED", "RUNNING"].includes(s.status)) return;
    const p = await db.problem.findUniqueOrThrow({
      where: { id: s.problemId },
    });
    const c = await db.contest.findUnique({ where: { id: s.contextId } });
    await db.submission.update({
      where: { id: s.id },
      data: { status: "RUNNING" },
    });
    await redis.publish(
      "verdicts",
      JSON.stringify({
        contextId: s.contextId,
        userId: s.userId,
        status: "RUNNING",
      }),
    );
    let result;
    try {
      const tests = (p.tests as any[]).filter((t) => !s.sample || t.sample);
      result = tests.length
        ? await runSandbox({
            code: s.code,
            language: s.language,
            tests,
            timeMs: p.timeMs,
            memoryMb: p.memoryMb,
            checker: p.checker,
            scoring: c?.scoring || "ICPC",
          })
        : { status: "SE", score: 0, tests: [] };
    } catch (e: any) {
      console.error("Sandbox failure", e.message?.slice(0, 150));
      result = {
        status: "SE",
        score: 0,
        tests: [],
        message: "Среда проверки временно недоступна. Повторите отправку.",
      };
    }
    await db.submission.update({
      where: { id: s.id },
      data: { status: result.status, result, score: result.score || 0 },
    });
    await redis.publish(
      "verdicts",
      JSON.stringify({
        contextId: s.contextId,
        userId: s.userId,
        status: result.status,
        submissionId: s.id,
        problemId: s.problemId,
      }),
    );
  },
  {
    connection: redis as any,
    concurrency: Number(process.env.JUDGE_CONCURRENCY || 2),
  },
);
worker.on("failed", (job, e) =>
  console.error("Job failed", job?.id, e.message.slice(0, 150)),
);
console.log("FairRound judge started");
process.on("SIGTERM", async () => {
  await worker.close();
  await db.$disconnect();
  redis.disconnect();
  process.exit(0);
});
