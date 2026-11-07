import { db, route, fail, authorizeContext, emit } from "../main";
import { eventHash, riskWeight, similarity } from "../../../packages/shared";
import { z } from "zod";
async function access(contextId: string, target: string, u: any) {
  if (u.id === target) return;
  const ctx = await authorizeContext(contextId, u);
  if (u.role !== "ORGANIZER" || (ctx.contest && ctx.contest.authorId !== u.id))
    fail("Запись доступна участнику и организатору", 403);
}
export function registerIntegrity(r: any) {
  route(
    r,
    "post",
    "/contexts/:id/editor",
    async (req: any, __: any, u: any) => {
      const ctx = await authorizeContext(req.params.id, u);
      if (
        !ctx.startAt ||
        Date.now() < +ctx.startAt ||
        (ctx.endsAt && Date.now() >= +ctx.endsAt) ||
        ctx.match?.surrenderedId
      )
        fail("Запись событий завершена");
      const data = z
        .object({
          problemId: z.string(),
          language: z.enum(["python", "cpp"]).default("python"),
          code: z.string().max(50000),
          type: z
            .enum([
              "change",
              "paste",
              "copy",
              "cut",
              "blur",
              "focus",
              "run",
              "submit",
              "reconnect",
            ])
            .default("change"),
          seq: z.number().int().nonnegative(),
          meta: z.record(z.string(), z.unknown()).optional(),
        })
        .safeParse(req.body);
      if (!data.success) fail("Неверное событие редактора");
      const d = data.data!;
      if (!ctx.problemIds.includes(d.problemId)) fail("Задача не найдена");
      if (
        !(await db.consent.findUnique({
          where: {
            userId_contextId: { userId: u.id, contextId: req.params.id },
          },
        }))
      )
        fail("Для записи необходимо согласие", 403);
      const session = await db.editorSession.upsert({
        where: {
          userId_contextId_problemId: {
            userId: u.id,
            contextId: req.params.id,
            problemId: d.problemId,
          },
        },
        create: {
          userId: u.id,
          contextId: req.params.id,
          problemId: d.problemId,
        },
        update: {},
      });
      const result = await db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          any[]
        >`SELECT * FROM "EditorSession" WHERE id=${session.id} FOR UPDATE`;
        const current = locked[0];
        if (d.seq <= current.seq) return current;
        if (d.seq !== current.seq + 1)
          fail("Запись изменилась в другой вкладке. Обновите страницу", 409);
        const payload: any = {
          type: d.type,
          code: d.code,
          language: d.language,
          meta: d.meta || {},
          receivedAt: new Date().toISOString(),
        };
        const hash = eventHash(current.hash, payload);
        const event = await tx.editorEvent.create({
          data: {
            sessionId: session.id,
            seq: d.seq,
            type: d.type,
            payload,
            previousHash: current.hash,
            hash,
          },
        });
        const flag = async (type: string, level: string, explanation: string) =>
          tx.integrityFlag.create({
            data: {
              userId: u.id,
              contextId: req.params.id,
              problemId: d.problemId,
              type,
              level,
              explanation,
              eventId: event.id,
            },
          });
        if (
          d.type === "paste" &&
          Number(d.meta?.length) >= 150 &&
          !d.meta?.internal
        )
          await flag(
            "EXTERNAL_PASTE",
            Number(d.meta?.length) >= d.code.length * 0.5
              ? "critical"
              : "warning",
            `Вставлено ${d.meta?.length} символов извне редактора. Проверьте контекст.`,
          );
        if (d.type === "focus") {
          const blur = await tx.editorEvent.findFirst({
            where: { sessionId: session.id, type: "blur" },
            orderBy: { seq: "desc" },
          });
          if (blur && Date.now() - +blur.createdAt >= 60000)
            await flag(
              "LONG_AWAY",
              "info",
              `Вкладка была неактивна ${Math.round((Date.now() - +blur.createdAt) / 60000)} мин. Сам по себе уход не означает нарушение.`,
            );
        }
        if (d.type === "paste") {
          const focus = await tx.editorEvent.findFirst({
            where: { sessionId: session.id, type: "focus" },
            orderBy: { seq: "desc" },
          });
          const blur = await tx.editorEvent.findFirst({
            where: { sessionId: session.id, type: "blur" },
            orderBy: { seq: "desc" },
          });
          if (
            focus &&
            blur &&
            +focus.createdAt - +blur.createdAt >= 60000 &&
            Date.now() - +focus.createdAt <= 60000 &&
            Number(d.meta?.length) >= 100
          )
            await flag(
              "AWAY_THEN_SOLVE",
              "warning",
              "После отсутствия более минуты участник вставил значительный фрагмент кода.",
            );
        }
        return tx.editorSession.update({
          where: { id: session.id },
          data: { code: d.code, language: d.language, seq: d.seq, hash },
        });
      });
      emit(req.params.id, "draft", { userId: u.id, problemId: d.problemId });
      return result;
    },
    "USER",
  );
  route(
    r,
    "get",
    "/records",
    async (_: any, __: any, u: any) => {
      const sessions = await db.editorSession.findMany({
        where: u.role === "ORGANIZER" ? {} : { userId: u.id },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
      const users = await db.user.findMany();
      const contests = await db.contest.findMany({
        where: u.role === "ORGANIZER" ? { authorId: u.id } : {},
      });
      const matches = await db.match.findMany();
      const flags = await db.integrityFlag.findMany();
      const reviews = await db.review.findMany({orderBy:{createdAt:"desc"}});
      const grouped = new Map<string, any>();
      const visible = sessions
        .filter(
          (s) =>
            u.role !== "ORGANIZER" ||
            contests.some((c) => c.id === s.contextId) ||
            matches.some((m) => m.id === s.contextId),
        )
        .map((s) => ({
          id: s.id,
          userId: s.userId,
          contextId: s.contextId,
          seq: s.seq,
          updatedAt: s.updatedAt,
          name: users.find((x) => x.id === s.userId)?.name,
          title: contests.find((c) => c.id === s.contextId)?.title || "Дуэль",
          decision:reviews.find(r=>r.contextId===s.contextId&&r.userId===s.userId)?.decision||"UNREVIEWED",
          signals:flags.filter(f=>f.contextId===s.contextId&&f.userId===s.userId).map(f=>({type:f.type,level:f.level})),
          risk: flags
            .filter((f) => f.userId === s.userId && f.contextId === s.contextId)
            .reduce((a, f) => a + (riskWeight[f.level] || 0), 0),
        }));
      for (const record of visible) {
        const key = record.contextId + ":" + record.userId;
        const existing = grouped.get(key);
        if (existing) existing.seq += record.seq;
        else grouped.set(key, record);
      }
      return [...grouped.values()].sort(
        (a, b) => b.risk - a.risk || +b.updatedAt - +a.updatedAt,
      );
    },
    "USER",
  );
  route(
    r,
    "get",
    "/integrity/:contextId/:userId",
    async (req: any, __: any, u: any) => {
      const { contextId, userId } = req.params;
      await access(contextId, userId, u);
      const sessions = await db.editorSession.findMany({
        where: { contextId, userId },
      });
      const events = await db.editorEvent.findMany({
        where: { sessionId: { in: sessions.map((s) => s.id) } },
        orderBy: { createdAt: "asc" },
      });
      const flags = await db.integrityFlag.findMany({
        where: { contextId, userId },
        orderBy: { createdAt: "asc" },
      });
      const reviews = await db.review.findMany({
        where: { contextId, userId },
        orderBy: { createdAt: "desc" },
      });
      const user = await db.user.findUnique({ where: { id: userId } });
      const problems = await db.problem.findMany({
        where: { id: { in: sessions.map((s) => s.problemId) } },
      });
      const comparisons: any[] = [];
      const ctx =
        u.role === "ORGANIZER" ? await authorizeContext(contextId, u) : null;
      if (u.role === "ORGANIZER" && ctx?.endsAt && Date.now() >= +ctx.endsAt) {
        const accepted = await db.submission.findMany({
          where: { contextId, status: "OK", sample: false },
          orderBy: { createdAt: "asc" },
          take: 300,
        });
        const people = await db.user.findMany({
          select: { id: true, name: true },
        });
        const seen = new Set<string>();
        for (const a of accepted.filter(
          (s) => s.userId === userId && s.code.length >= 100,
        )) {
          for (const b of accepted.filter(
            (s) =>
              s.userId !== userId &&
              s.problemId === a.problemId &&
              s.code.length >= 100,
          )) {
            if (
              seen.has(b.userId + ":" + a.problemId) ||
              (a.teamId && a.teamId === b.teamId)
            )
              continue;
            const ratio = similarity(a.code, b.code);
            if (ratio < 0.85) continue;
            seen.add(b.userId + ":" + a.problemId);
            comparisons.push({
              userId: b.userId,
              name: people.find((p) => p.id === b.userId)?.name,
              problemId: a.problemId,
              ratio,
              first:
                +a.createdAt <= +b.createdAt
                  ? user?.name
                  : people.find((p) => p.id === b.userId)?.name,
              code: a.code,
              otherCode: b.code,
            });
          }
        }
      }
      const entry = await db.entry.findUnique({
        where: { contestId_userId: { contestId: contextId, userId } },
      });
      const team = entry?.teamId
        ? await db.team.findUnique({ where: { id: entry.teamId } })
        : null;
      const contributions = [];
      if (team) {
        for (const memberId of team.memberIds) {
          const person = await db.user.findUnique({ where: { id: memberId } });
          const submissions = await db.submission.findMany({
            where: { contextId, userId: memberId, sample: false },
          });
          const drafts = await db.editorSession.findMany({
            where: { contextId, userId: memberId },
          });
          contributions.push({
            name: person?.name,
            attempts: submissions.length,
            accepted: submissions.filter((s) => s.status === "OK").length,
            characters: drafts.reduce((sum, d) => sum + d.code.length, 0),
          });
        }
      }
      return {
        submissions:await db.submission.findMany({where:{contextId,userId,sample:false},select:{problemId:true,createdAt:true,status:true}}),
        tracks:ctx?await db.problem.findMany({where:{id:{in:ctx.problemIds}},select:{id:true,title:true}}).then(problems=>ctx.problemIds.map(id=>({id:sessions.find(s=>s.problemId===id)?.id||'empty-'+id,title:problems.find(p=>p.id===id)?.title,problemId:id}))):sessions.map(s=>({id:s.id,problemId:s.problemId,title:problems.find(p=>p.id===s.problemId)?.title})),
        startAt:ctx?.startAt, endsAt:ctx?.endsAt,
        user: { id: user?.id, name: user?.name },
        sessions: sessions.map((s) => ({
          ...s,
          title: problems.find((p) => p.id === s.problemId)?.title,
        })),
        events,
        flags,
        reviews,
        comparisons: comparisons.slice(0, 10),
        contributions,
        risk: flags.reduce((a, f) => a + (riskWeight[f.level] || 0), 0),
      };
    },
    "USER",
  );
  route(
    r,
    "post",
    "/integrity/:contextId/:userId/verify",
    async (req: any, __: any, u: any) => {
      await access(req.params.contextId, req.params.userId, u);
      const sessions = await db.editorSession.findMany({
        where: { userId: req.params.userId, contextId: req.params.contextId },
      });
      let count = 0;
      for (const s of sessions) {
        const events = await db.editorEvent.findMany({
          where: { sessionId: s.id },
          orderBy: { seq: "asc" },
        });
        let prev = "",
          seq = 0;
        for (const e of events) {
          if (
            e.seq !== ++seq ||
            e.previousHash !== prev ||
            e.hash !== eventHash(prev, e.payload)
          )
            return { valid: false, count };
          prev = e.hash;
          count++;
        }
        if (prev !== s.hash || seq !== s.seq) return { valid: false, count };
      }
      return { valid: true, count };
    },
    "USER",
  );
  route(
    r,
    "post",
    "/integrity/:contextId/:userId/review",
    async (req: any, __: any, u: any) => {
      await access(req.params.contextId, req.params.userId, u);
      const d = z
        .object({
          decision: z.enum(["UNREVIEWED", "CLEAN", "SUSPICIOUS", "DISQUALIFIED"]),
          comment: z.string().trim().max(2000),
        })
        .parse(req.body);
      if (d.decision === "DISQUALIFIED" && d.comment.length < 5)
        fail("Укажите причину дисквалификации");
      await db.$transaction(async (tx) => {
        await tx.review.create({
          data: {
            ...d,
            contextId: req.params.contextId,
            userId: req.params.userId,
            organizerId: u.id,
          },
        });
        const entry = await tx.entry.findUnique({
          where: {
            contestId_userId: {
              contestId: req.params.contextId,
              userId: req.params.userId,
            },
          },
        });
        if (entry)
          await tx.entry.updateMany({
            where: {
              contestId: req.params.contextId,
              ...(entry.teamId
                ? { teamId: entry.teamId }
                : { userId: req.params.userId }),
            },
            data: { disqualified: d.decision === "DISQUALIFIED" },
          });
      });
      emit(req.params.contextId);
    },
    "ORGANIZER",
  );
  route(
    r,
    "post",
    "/integrity/:contextId/recalculate",
    async (req: any, __: any, u: any) => {
      const ctx = await authorizeContext(req.params.contextId, u);
      if (ctx.contest?.authorId !== u.id && !ctx.match)
        fail("Нет доступа", 403);
      if (ctx.endsAt && Date.now() < +ctx.endsAt)
        fail("Сходство пересчитывается после соревнования");
      const rows = await db.submission.findMany({
        where: { contextId: req.params.contextId, status: "OK", sample: false },
        orderBy: { createdAt: "asc" },
      });
      await db.integrityFlag.deleteMany({
        where: { contextId: req.params.contextId, type: "SIMILAR_CODE" },
      });
      const pairs = [];
      for (let i = 0; i < rows.length; i++)
        for (let j = i + 1; j < rows.length; j++) {
          const a = rows[i],
            b = rows[j];
          if (a.userId === b.userId || a.problemId !== b.problemId) continue;
          const ratio = similarity(a.code, b.code);
          if (ratio >= 0.85) {
            pairs.push({ a: a.userId, b: b.userId, ratio, first: a.userId });
            for (const s of [a, b])
              await db.integrityFlag.create({
                data: {
                  userId: s.userId,
                  contextId: s.contextId,
                  problemId: s.problemId,
                  type: "SIMILAR_CODE",
                  level: ratio >= 0.95 ? "critical" : "warning",
                  explanation: `Сходство нормализованных решений ${Math.round(ratio * 100)}%. Это сигнал для ручной проверки, не доказательство.`,
                },
              });
          }
        }
      return { pairs };
    },
    "ORGANIZER",
  );
}
