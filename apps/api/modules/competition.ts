import { z } from "zod";
import {
  db, io,
  route,
  fail,
  authorizeContext,
  emit,
  queue,
  safeUser,
} from "../main";
import {
  scoreEntry,
  decideDuelWinner,
  eventHash,
} from "../../../packages/shared";
const problemSchema = z.object({
  title: z.string().trim().min(2).max(120),
  statement: z.string().min(10).max(30000),
  timeMs: z.number().int().min(100).max(3000).default(1000),
  memoryMb: z.number().int().min(64).max(512).default(256),
  tests: z
    .array(
      z.object({
        input: z.string().max(50000),
        output: z.string().max(50000),
        sample: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(30),
  checker: z.enum(["tokens", "exact", "float:0.000001"]).default("tokens"),
  duelPool: z.boolean().default(true),
});
const contestSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().max(1000).default(""),
  problemIds: z.array(z.string()).min(1).max(10),
  startAt: z.iso.datetime(),
  duration: z.number().int().min(1).max(20160),
  format: z.enum(["INDIVIDUAL", "TEAM"]),
  scoring: z.enum(["ICPC", "IOI"]),
  published: z.boolean().default(true),
  integrityEnabled: z.boolean().default(true),
});
function parse(schema: any, body: any) {
  const result = schema.safeParse(body);
  if (!result.success)
    fail(
      "Проверьте заполненные поля: " + result.error.issues[0].path.join("."),
    );
  return result.data;
}
export async function standings(id: string, u: any) {
  const ctx = await authorizeContext(id, u);
  const rows = await db.submission.findMany({
    where: { contextId: id, sample: false },
  });
  const entries = ctx.contest
    ? await db.entry.findMany({ where: { contestId: id } })
    : [
        {
          id: ctx.match!.hostId,
          userId: ctx.match!.hostId,
          teamId: "",
          disqualified: false,
        },
        ...(ctx.match!.guestId
          ? [
              {
                id: ctx.match!.guestId!,
                userId: ctx.match!.guestId!,
                teamId: "",
                disqualified: false,
              },
            ]
          : []),
      ];
  const users = await db.user.findMany();
  const teams = await db.team.findMany();
  const seen = new Set<string>();
  const result = entries
    .filter((e) => {
      const k = e.teamId || e.userId;
      if (seen.has(k)) return false;
      seen.add(k);
      return !e.disqualified || u.role === "ORGANIZER";
    })
    .map((e) => ({
      id: e.teamId || e.userId,
      name: e.teamId
        ? teams.find((t) => t.id === e.teamId)?.name
        : users.find((v) => v.id === e.userId)?.name,
      disqualified: e.disqualified,
      ...scoreEntry(
        rows.filter((s) =>
          e.teamId ? s.teamId === e.teamId : s.userId === e.userId,
        ),
        ctx.problemIds,
        ctx.startAt || new Date(),
        ctx.contest?.scoring || "ICPC",
        ctx.match ? 2 : 20,
      ),
    }));
  result.sort(
    (a, b) =>
      (ctx.contest?.scoring === "IOI"
        ? b.points - a.points
        : b.solved - a.solved || a.penalty - b.penalty) || a.lastOk - b.lastOk,
  );
  for(const row of result)for(const cell of row.cells){const accepted=rows.filter(s=>s.problemId===cell.problemId&&s.status==='OK').sort((a,b)=>+a.createdAt-+b.createdAt)[0];(cell as any).first=!!accepted&&(accepted.teamId||accepted.userId)===row.id;}
  return result.map((row, i) => ({
    ...row,
    place:
      i > 0 &&
      ctx.contest?.scoring === "IOI" &&
      row.points === result[i - 1].points
        ? result.findIndex((r) => r.points === row.points) + 1
        : i + 1,
  }));
}
export function registerCompetition(r: any) {
  route(
    r,
    "post",
    "/problems/:id/verify",
    async (req: any, __: any, u: any) => {
      const p = await db.problem.findUnique({ where: { id: req.params.id } });
      if (!p || p.authorId !== u.id) fail("Нет доступа к задаче", 403);
      const d = parse(
        z.object({
          code: z.string().min(1).max(50000),
          language: z.enum(["python", "cpp"]),
        }),
        req.body,
      );
      const pending = await db.submission.count({
        where: { userId: u.id, status: { in: ["QUEUED", "RUNNING"] } },
      });
      if (pending >= 3) fail("Дождитесь завершения предыдущих проверок", 429);
      const s = await db.submission.create({
        data: {
          userId: u.id,
          contextId: "validation:" + p!.id,
          problemId: p!.id,
          language: d.language,
          code: d.code,
        },
      });
      await queue.add(
        "judge",
        { submissionId: s.id },
        {
          jobId: s.id,
          priority: 3,
          attempts: 2,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
      return s;
    },
    "ORGANIZER",
  );
  route(r,'get','/board',async()=>{
    const entries=await db.entry.findMany({select:{contestId:true}});
    const now=Date.now(),contests=await db.contest.findMany({where:{published:true},orderBy:{startAt:'asc'}});
    const all=await db.match.findMany({where:{guestId:{not:null},startAt:{not:null}},orderBy:{createdAt:'desc'},take:100});
    const live=all.filter(m=>!m.surrenderedId&&m.endsAt&&+m.endsAt>now),matches=(live.length?live:all.filter(m=>m.surrenderedId||(m.endsAt&&+m.endsAt<=now))).slice(0,5);
    const people=await db.user.findMany({select:{id:true,name:true,rating:true}}),submissions=await db.submission.findMany({where:{contextId:{in:matches.map(m=>m.id)},sample:false}});
    const events=await db.submission.findMany({where:{status:'OK',sample:false},orderBy:{createdAt:'desc'},take:12});
    const sockets=await io.fetchSockets();
    return {contests:contests.map(c=>({...c,entries:entries.filter(e=>e.contestId===c.id).length})),online:new Set(sockets.map(s=>s.data.user?.id).filter(Boolean)).size,activeDuels:live.length,
      matches:matches.map(m=>{const host=people.find(p=>p.id===m.hostId),guest=people.find(p=>p.id===m.guestId);return {id:m.id,host:host?.name,guest:guest?.name,hostRating:host?.rating,guestRating:guest?.rating,endsAt:m.endsAt,live:!m.surrenderedId&&m.endsAt&&+m.endsAt>now,hostScore:scoreEntry(submissions.filter(s=>s.contextId===m.id&&s.userId===m.hostId),m.problemIds,m.startAt!,'ICPC',2).solved,guestScore:scoreEntry(submissions.filter(s=>s.contextId===m.id&&s.userId===m.guestId),m.problemIds,m.startAt!,'ICPC',2).solved};}),
      events:events.map(e=>({id:e.id,time:e.createdAt,name:people.find(p=>p.id===e.userId)?.name,contest:contests.find(c=>c.id===e.contextId)?.title||'Дуэль',problem:String.fromCharCode(65+Math.max(0,contests.find(c=>c.id===e.contextId)?.problemIds.indexOf(e.problemId)||0)),synthetic:!!(e.result as any)?.synthetic})),time:new Date()};
  });
  route(r, "get", "/problems", async (_: any, __: any, u: any) => {
    const rows = await db.problem.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((p) =>
      u?.role === "ORGANIZER"
        ? p
        : { id: p.id, title: p.title, duelPool: p.duelPool },
    );
  });
  route(
    r,
    "post",
    "/problems",
    async (req: any, __: any, u: any) =>
      db.problem.create({
        data: { ...parse(problemSchema, req.body), authorId: u.id },
      }),
    "ORGANIZER",
  );
  route(
    r,
    "put",
    "/problems/:id",
    async (req: any, __: any, u: any) => {
      const p = await db.problem.findUnique({ where: { id: req.params.id } });
      if (p?.authorId !== u.id) fail("Нет доступа", 403);
      return db.problem.update({
        where: { id: p!.id },
        data: parse(problemSchema, req.body),
      });
    },
    "ORGANIZER",
  );
  route(r,'get','/contests',async(_:any,__:any,u:any)=>{const contests=await db.contest.findMany({where:u?.role==='ORGANIZER'?{OR:[{published:true},{authorId:u.id}]}:{published:true},orderBy:{startAt:'desc'}});const entries=await db.entry.findMany({select:{contestId:true}});return contests.map(c=>({...c,entries:entries.filter(e=>e.contestId===c.id).length}));});
  route(
    r,
    "post",
    "/contests",
    async (req: any, __: any, u: any) => {
      const d = parse(contestSchema, req.body);
      const n = await db.problem.count({
        where: { id: { in: d.problemIds }, authorId: u.id },
      });
      if (n !== new Set(d.problemIds).size) fail("Выберите свои задачи");
      return db.contest.create({
        data: { ...d, startAt: new Date(d.startAt), authorId: u.id },
      });
    },
    "ORGANIZER",
  );
  route(r, "get", "/contests/:id", async (req: any, __: any, u: any) => {
    const c = await db.contest.findUnique({ where: { id: req.params.id } });
    if (!c || (!c.published && c.authorId !== u?.id))
      fail("Контест не найден", 404);
    const entry = u
      ? await db.entry.findUnique({
          where: { contestId_userId: { contestId: c!.id, userId: u.id } },
        })
      : null;
    const problems = await db.problem.findMany({
      where: { id: { in: c!.problemIds } },
      select: { id: true, title: true, timeMs: true, memoryMb: true },
    });
    return {
      ...c,
      entry,
      problems,
      entries: await db.entry.count({ where: { contestId: c!.id } }),
    };
  });
  route(
    r,
    "post",
    "/contexts/:id/consent",
    async (req: any, __: any, u: any) => {
      if (req.body.accepted !== true) fail("Подтвердите согласие");
      const id = req.params.id;
      const c = await db.contest.findUnique({ where: { id } });
      const m = await db.match.findUnique({ where: { id } });
      if (!c?.published && ![m?.hostId, m?.guestId].includes(u.id))
        fail("Нет доступа", 403);
      return db.consent.upsert({
        where: { userId_contextId: { userId: u.id, contextId: id } },
        create: { userId: u.id, contextId: id },
        update: {},
      });
    },
    "USER",
  );
  route(
    r,
    "post",
    "/contests/:id/register",
    async (req: any, __: any, u: any) => {
      if (u.role !== "PARTICIPANT")
        fail("Для участия войдите как участник", 403);
      const c = await db.contest.findUnique({ where: { id: req.params.id } });
      if (!c?.published || Date.now() >= +c.startAt + c.duration * 60000)
        fail("Регистрация закрыта");
      if (
        c!.integrityEnabled &&
        !(await db.consent.findUnique({
          where: { userId_contextId: { userId: u.id, contextId: c!.id } },
        }))
      )
        fail("Сначала подтвердите согласие на запись");
      let members = [u.id],
        teamId = "";
      if (c!.format === "TEAM") {
        const t = await db.team.findUnique({
          where: { id: req.body.teamId || "" },
        });
        if (!t || t.captainId !== u.id || t.memberIds.length !== 2)
          fail("Капитан может записать команду из двух участников");
        members = t!.memberIds;
        teamId = t!.id;
        for (const userId of members) {
          if (
            !(await db.consent.findUnique({
              where: { userId_contextId: { userId, contextId: c!.id } },
            }))
          )
            fail("Оба участника должны подтвердить согласие");
        }
      }
      return db.$transaction(async (tx) => {
        for (const userId of members) {
          const old = await tx.entry.findUnique({
            where: { contestId_userId: { contestId: c!.id, userId } },
          });
          if (old && old.teamId !== teamId)
            fail("Участник уже записан в другом составе");
          await tx.entry.upsert({
            where: { contestId_userId: { contestId: c!.id, userId } },
            create: { contestId: c!.id, userId, teamId },
            update: {},
          });
        }
        return { ok: true };
      });
    },
    "USER",
  );
  route(
    r,
    "get",
    "/contexts/:id/standings",
    (req: any, __: any, u: any) => standings(req.params.id, u),
    "USER",
  );
  route(
    r,
    "get",
    "/contexts/:id/workspace",
    async (req: any, __: any, u: any) => {
      const id = req.params.id,
        ctx = await authorizeContext(id, u);
      if (
        ctx.contest &&
        u.role !== "ORGANIZER" &&
        Date.now() < +ctx.contest.startAt
      )
        fail("Условия откроются после старта");
      const ps = await db.problem.findMany({
        where: { id: { in: ctx.problemIds } },
      });
      const problems = ctx.problemIds
        .map((pid) => ps.find((p) => p.id === pid))
        .filter(Boolean)
        .map((p) => ({
          ...p!,
          tests: (p!.tests as any[]).filter((t) => t.sample),
        }));
      const drafts = await db.editorSession.findMany({
        where: { contextId: id, userId: u.id },
      });
      const submissions = await db.submission.findMany({
        where: {
          contextId: id,
          ...(ctx.teamId ? { teamId: ctx.teamId } : { userId: u.id }),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const team = ctx.teamId
        ? await db.team.findUnique({ where: { id: ctx.teamId } })
        : null;
      const partner = team
        ? await db.user.findFirst({
            where: { id: { in: team.memberIds.filter((x) => x !== u.id) } },
          })
        : null;
      const teamCounts = team
        ? await db.submission.groupBy({
            by: ["userId", "status"],
            where: { contextId: id, teamId: team.id, sample: false },
            _count: true,
          })
        : [];
      const contributions = team
        ? team.memberIds.map((userId) => ({
            userId,
            name: userId === u.id ? u.name : partner?.name,
            attempts: teamCounts
              .filter((c) => c.userId === userId)
              .reduce((sum, c) => sum + c._count, 0),
            accepted: teamCounts
              .filter((c) => c.userId === userId && c.status === "OK")
              .reduce((sum, c) => sum + c._count, 0),
          }))
        : [];
      return {
        ...ctx,
        problems,
        drafts,
        submissions,
        standings: await standings(id, u),
        partner: safeUser(partner),
        contributions,
        claims: ctx.teamId
          ? await db.claim.findMany({
              where: { contextId: id, teamId: ctx.teamId },
            })
          : [],
        chat: ctx.teamId
          ? await db.chat.findMany({
              where: { teamId: ctx.teamId },
              orderBy: { createdAt: "asc" },
              take: 100,
            })
          : [],
        partnerDrafts: partner
          ? await db.editorSession.findMany({
              where: { contextId: id, userId: partner.id },
            })
          : [],
        serverTime: new Date(),
      };
    },
    "USER",
  );
  route(
    r,
    "post",
    "/submissions",
    async (req: any, __: any, u: any) => {
      if (u.role !== "PARTICIPANT")
        fail("Организатор не может участвовать", 403);
      const d = parse(
        z.object({
          contextId: z.string(),
          problemId: z.string(),
          language: z.enum(["python", "cpp"]),
          code: z.string().min(1).max(50000),
          editorSessionId: z.string().optional(),
          seq: z.number().int().optional(),
          sample: z.boolean().default(false),
        }),
        req.body,
      );
      const ctx = await authorizeContext(d.contextId, u, true);
      if (!ctx.problemIds.includes(d.problemId))
        fail("Задача не входит в соревнование");
      if (
        (ctx.contest?.integrityEnabled || ctx.match) &&
        !(await db.consent.findUnique({
          where: { userId_contextId: { userId: u.id, contextId: d.contextId } },
        }))
      )
        fail("Подтвердите согласие на запись");
      const recent = await db.submission.findFirst({
        where: { userId: u.id, createdAt: { gt: new Date(Date.now() - 5000) } },
      });
      if (recent) fail("Между отправками должно пройти 5 секунд", 429);
      const draft = d.editorSessionId
        ? await db.editorSession.findUnique({
            where: { id: d.editorSessionId },
          })
        : null;
      let flag = "";
      if (
        !draft ||
        draft.userId !== u.id ||
        draft.contextId !== d.contextId ||
        draft.problemId !== d.problemId
      )
        flag = "NO_RECORDING";
      else if (draft.code !== d.code || draft.seq !== d.seq)
        flag = "CODE_NOT_FROM_EDITOR";
      if (flag)
        await db.integrityFlag.create({
          data: {
            userId: u.id,
            contextId: d.contextId,
            problemId: d.problemId,
            type: flag,
            level: "critical",
            explanation:
              flag === "NO_RECORDING"
                ? "Отправка не связана с записью редактора."
                : "Отправленный код отличается от записи редактора.",
          },
        });
      const s = await db.submission.create({
        data: {
          userId: u.id,
          contextId: d.contextId,
          problemId: d.problemId,
          language: d.language,
          code: d.code,
          sample: d.sample,
          teamId: ctx.teamId,
        },
      });
      await queue.add(
        "judge",
        { submissionId: s.id },
        {
          jobId: s.id,
          priority: ctx.match ? 1 : d.sample ? 3 : 2,
          attempts: 2,
          backoff: { type: "fixed", delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
      emit(d.contextId);
      return s;
    },
    "USER",
  );
  route(
    r,
    "get",
    "/submissions/:id",
    async (req: any, __: any, u: any) => {
      const s = await db.submission.findUnique({
        where: { id: req.params.id },
      });
      if (!s || (s.userId !== u.id && u.role !== "ORGANIZER"))
        fail("Нет доступа", 403);
      if (s!.userId !== u.id) await authorizeContext(s!.contextId, u);
      return s;
    },
    "USER",
  );
  route(
    r,
    "get",
    "/matches",
    async (_: any, __: any, u: any) => {
      const ms = await db.match.findMany({
        where: { OR: [{ hostId: u.id }, { guestId: u.id }] },
        orderBy: { createdAt: "desc" },
      });
      const people = await db.user.findMany();
      return ms.map((m) => ({
        ...m,
        host: people.find((p) => p.id === m.hostId)?.name,
        guest: people.find((p) => p.id === m.guestId)?.name,
      }));
    },
    "USER",
  );
  route(
    r,
    "post",
    "/matches",
    async (req: any, __: any, u: any) => {
      if (u.role !== "PARTICIPANT") fail("Войдите как участник");
      const d = parse(
        z.object({
          duration: z.number().int().min(1).max(30),
          problemIds: z.array(z.string()).min(1).max(3),
        }),
        req.body,
      );
      if (
        (await db.problem.count({
          where: { id: { in: d.problemIds }, duelPool: true },
        })) !== d.problemIds.length
      )
        fail("Выберите задачи из пула дуэлей");
      return db.match.create({
        data: {
          hostId: u.id,
          duration: d.duration,
          problemIds: d.problemIds,
          readyIds: [],
        },
      });
    },
    "USER",
  );
  route(r, "get", "/invite/:token", async (req: any) => {
    const m = await db.match.findUnique({ where: { token: req.params.token } });
    if (m) {
      const host = await db.user.findUnique({ where: { id: m.hostId } });
      return {
        type: "match",
        id: m.id,
        title: host?.name,
        duration: m.duration,
        count: m.problemIds.length,
        accepted: !!m.guestId,
      };
    }
    const t = await db.team.findUnique({ where: { token: req.params.token } });
    if (t)
      return {
        type: "team",
        id: t.id,
        title: t.name,
        accepted: t.memberIds.length === 2,
      };
    fail("Приглашение не найдено", 404);
  });
  route(
    r,
    "post",
    "/invite/:token/accept",
    async (req: any, __: any, u: any) => {
      if (u.role !== "PARTICIPANT") fail("Войдите как участник");
      return db.$transaction(async (tx) => {
        const m = await tx.match.findUnique({
          where: { token: req.params.token },
        });
        if (m) {
          if (m.hostId === u.id) return { type: "match", id: m.id };
          if (m.guestId && m.guestId !== u.id) fail("Дуэль уже укомплектована");
          if (Date.now() - +m.createdAt > 15 * 60000 && !m.guestId)
            fail("Срок приглашения истёк");
          const updated = await tx.match.updateMany({
            where: { id: m.id, OR: [{ guestId: null }, { guestId: u.id }] },
            data: { guestId: u.id },
          });
          if (!updated.count) fail("Дуэль уже укомплектована");
          emit(m.id);
          return { type: "match", id: m.id };
        }
        const t = await tx.team.findUnique({
          where: { token: req.params.token },
        });
        if (!t) fail("Приглашение не найдено");
        if (t!.memberIds.includes(u.id)) return { type: "team", id: t!.id };
        if (t!.memberIds.length >= 2) fail("В команде уже два участника");
        const updated = await tx.team.updateMany({
          where: { id: t!.id, memberIds: { equals: t!.memberIds } },
          data: { memberIds: [...t!.memberIds, u.id] },
        });
        if (!updated.count) fail("Состав уже изменился. Обновите страницу");
        return { type: "team", id: t!.id };
      });
    },
    "USER",
  );
  route(
    r,
    "get",
    "/matches/:id",
    async (req: any, __: any, u: any) => {
      const ctx = await authorizeContext(req.params.id, u);
      const m = ctx.match;
      if (!m) fail("Дуэль не найдена");
      const people = await db.user.findMany({
        where: { id: { in: [m!.hostId, ...(m!.guestId ? [m!.guestId] : [])] } },
      });
      const rows = await standings(m!.id, u);
      const a = rows.find((x) => x.id === m!.hostId),
        b = rows.find((x) => x.id === m!.guestId);
      const allSolved =
        a &&
        b &&
        a.solved === m!.problemIds.length &&
        b.solved === m!.problemIds.length;
      const finished =
        !!m!.surrenderedId ||
        (!!m!.endsAt && Date.now() >= +m!.endsAt) ||
        !!allSolved;
      return {
        ...m,
        people: people.map(safeUser),
        standings: rows,
        finished,
        winner:
          finished && a && b
            ? decideDuelWinner(
                a,
                b,
                m!.surrenderedId === m!.hostId
                  ? "a"
                  : m!.surrenderedId
                    ? "b"
                    : undefined,
              )
            : null,
        protocol: finished
          ? eventHash("", { id: m!.id, rows, surrender: m!.surrenderedId })
          : null,
        serverTime: new Date(),
      };
    },
    "USER",
  );
  route(
    r,
    "post",
    "/matches/:id/ready",
    async (req: any, __: any, u: any) => {
      const { match: m } = await authorizeContext(req.params.id, u);
      if (!m || !m.guestId) fail("Дождитесь соперника");
      if (![m!.hostId, m!.guestId].includes(u.id))
        fail("Только участники дуэли могут подтвердить готовность", 403);
      if (
        !(await db.consent.findUnique({
          where: { userId_contextId: { userId: u.id, contextId: m!.id } },
        }))
      )
        fail("Подтвердите согласие");
      await db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          any[]
        >`SELECT * FROM "Match" WHERE id=${m!.id} FOR UPDATE`;
        const current = locked[0];
        if (current.startAt) return;
        const ready = [...new Set([...current.readyIds, u.id])];
        const start = ready.length === 2 ? new Date(Date.now() + 3000) : null;
        await tx.match.update({
          where: { id: m!.id },
          data: {
            readyIds: ready,
            ...(start
              ? {
                  startAt: start,
                  endsAt: new Date(+start + m!.duration * 60000),
                }
              : {}),
          },
        });
      });
      emit(m!.id);
    },
    "USER",
  );
  route(
    r,
    "post",
    "/matches/:id/surrender",
    async (req: any, __: any, u: any) => {
      const { match: m } = await authorizeContext(req.params.id, u, true);
      if (![m!.hostId, m!.guestId].includes(u.id))
        fail("Только участники дуэли могут сдаться", 403);
      if (req.body.confirm !== true) fail("Подтвердите сдачу");
      await db.match.update({
        where: { id: m!.id },
        data: { surrenderedId: u.id },
      });
      emit(m!.id);
    },
    "USER",
  );
  route(
    r,
    "get",
    "/teams",
    async (_: any, __: any, u: any) => {
      const teams = await db.team.findMany({
        where: { memberIds: { has: u.id } },
      });
      const people = await db.user.findMany();
      return teams.map((t) => ({
        ...t,
        members: people.filter((p) => t.memberIds.includes(p.id)).map(safeUser),
      }));
    },
    "USER",
  );
  route(
    r,
    "post",
    "/teams",
    async (req: any, __: any, u: any) => {
      if (u.role !== "PARTICIPANT") fail("Войдите как участник");
      const d = parse(
        z.object({ name: z.string().trim().min(2).max(60) }),
        req.body,
      );
      return db.team.create({
        data: { name: d.name, captainId: u.id, memberIds: [u.id] },
      });
    },
    "USER",
  );
  route(
    r,
    "post",
    "/contexts/:id/claim",
    async (req: any, __: any, u: any) => {
      const ctx = await authorizeContext(req.params.id, u, true);
      if (!ctx.teamId || !ctx.problemIds.includes(req.body.problemId))
        fail("Командная задача не найдена");
      await db.claim.upsert({
        where: {
          teamId_contextId_problemId: {
            teamId: ctx.teamId,
            contextId: req.params.id,
            problemId: req.body.problemId,
          },
        },
        create: {
          teamId: ctx.teamId,
          contextId: req.params.id,
          problemId: req.body.problemId,
          userId: u.id,
        },
        update: { userId: req.body.release ? "" : u.id },
      });
      emit(req.params.id);
    },
    "USER",
  );
  route(
    r,
    "post",
    "/contexts/:id/chat",
    async (req: any, __: any, u: any) => {
      const ctx = await authorizeContext(req.params.id, u);
      if (!ctx.teamId) fail("Нет команды");
      const text = z.string().trim().min(1).max(500).parse(req.body.text);
      await db.chat.create({
        data: { teamId: ctx.teamId, userId: u.id, text },
      });
      emit(req.params.id);
    },
    "USER",
  );
}
