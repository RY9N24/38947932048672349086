import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import express from "express";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import { Queue } from "bullmq";
import { registerAuth } from "./modules/auth";
import { registerCompetition } from "./modules/competition";
import { registerIntegrity } from "./modules/integrity";
import {cleanupRecordings} from './services/retention';
export const db = new PrismaClient();
export const redis = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);
export const queue = new Queue("judge", { connection: redis as any });
export const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32)
  throw Error("JWT_SECRET must contain at least 32 characters");
export const safeUser = (u: any) =>
  u
    ? { id: u.id, name: u.name, email: u.email, role: u.role, rating: u.rating }
    : null;
export const fail = (message: string, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export let io: Server;
export const emit = (contextId: string, event = "refresh", payload: any = {}) =>
  { io?.to("context:" + contextId).emit(event, payload); io?.emit("board-refresh"); };
export function route(
  router: any,
  method: string,
  path: string,
  handler: any,
  role?: string,
) {
  router[method](path, async (req: any, res: any) => {
    try {
      let user: any = null;
      try {
        const t = jwt.verify(req.cookies?.session || "", secret!) as any;
        user = await db.user.findUnique({ where: { id: t.id } });
      } catch {}
      if (role && !user) fail("Войдите, чтобы продолжить", 401);
      if (role === "ORGANIZER" && user?.role !== role)
        fail("Этот раздел доступен организатору", 403);
      const result = await handler(req, res, user);
      if (!res.headersSent)
        res.json(result === undefined ? { ok: true } : result);
    } catch (e: any) {
      if (!res.headersSent)
        res
          .status(e.status || 400)
          .json({
            message: e.status
              ? e.message
              : "Не удалось выполнить действие. Проверьте данные и повторите.",
          });
      if (!e.status) console.error(e.code || e.name, e.message?.slice(0, 180));
    }
  });
}
export async function authorizeContext(id: string, user: any, active = false) {
  const contest = await db.contest.findUnique({ where: { id } });
  if (contest) {
    const owner = user?.role === "ORGANIZER" && contest.authorId === user.id;
    const entry = user
      ? await db.entry.findUnique({
          where: { contestId_userId: { contestId: id, userId: user.id } },
        })
      : null;
    if (!owner && !entry) fail("Сначала запишитесь на соревнование", 403);
    if (entry?.disqualified)
      fail("Участие прекращено решением организатора", 403);
    const end = +contest.startAt + contest.duration * 60000;
    if (
      active &&
      (!contest.published || Date.now() < +contest.startAt || Date.now() >= end)
    )
      fail("Соревнование сейчас не идёт");
    return {
      contest,
      match: null,
      entry,
      problemIds: contest.problemIds,
      startAt: contest.startAt,
      endsAt: new Date(end),
      teamId: entry?.teamId || "",
    };
  }
  const match = await db.match.findUnique({ where: { id } });
  if (!match) fail("Соревнование не найдено", 404);
  if (
    ![match!.hostId, match!.guestId].includes(user?.id) &&
    user?.role !== "ORGANIZER"
  )
    fail("Вы не участвуете в этой дуэли", 403);
  if (
    active &&
    (!match!.startAt ||
      Date.now() < +match!.startAt ||
      Date.now() >= +match!.endsAt! ||
      match!.surrenderedId)
  )
    fail("Дуэль сейчас не идёт");
  return {
    contest: null,
    match: match!,
    entry: null,
    problemIds: match!.problemIds,
    startAt: match!.startAt,
    endsAt: match!.endsAt,
    teamId: "",
  };
}
@Module({})
class AppModule {}
async function main() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ["error", "warn"],
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  const router = express.Router();
  registerAuth(router);
  registerCompetition(router);
  registerIntegrity(router);
  route(router, "get", "/health", async () => {
    await db.$queryRaw`SELECT 1`;
    await redis.ping();
    return { status: "ok", time: new Date().toISOString(), displayTZ: process.env.DISPLAY_TZ || "Europe/Samara" };
  });
  app.use("/api", router);
  io = new Server(app.getHttpServer(), {
    path: "/socket.io",
    cors: {
      origin: process.env.PUBLIC_URL || "http://localhost:3000",
      credentials: true,
    },
    maxHttpBufferSize: 1024 * 1024,
  });
  const pub = redis.duplicate(),
    sub = redis.duplicate();
  io.adapter(createAdapter(pub, sub));
  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie || "";
      const raw = cookie
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("session="))
        ?.slice(8);
      const t = jwt.verify(raw || "", secret!) as any;
      socket.data.user = await db.user.findUnique({ where: { id: t.id } });
      if (!socket.data.user) throw Error();
      next();
    } catch {
      next(new Error("Войдите"));
    }
  });
  io.on("connection", (socket) => {
    const u = socket.data.user;
    socket.join("user:" + u.id);
    socket.on("join", async (id: string, cb?: any) => {
      try {
        await authorizeContext(id, u);
        socket.join("context:" + id);
        socket.data.contextId = id;
        socket
          .to("context:" + id)
          .emit("presence", { userId: u.id, online: true });
        cb?.({ ok: true });
      } catch {
        cb?.({ ok: false });
      }
    });
    socket.on("activity", () => {
      if (socket.data.contextId)
        socket
          .to("context:" + socket.data.contextId)
          .emit("activity", { userId: u.id, at: Date.now() });
    });
    socket.on("disconnect", () => {
      if (socket.data.contextId)
        socket
          .to("context:" + socket.data.contextId)
          .emit("presence", { userId: u.id, online: false });
    });
  });
  const verdicts = redis.duplicate();
  await verdicts.subscribe("verdicts");
  verdicts.on("message", (_, raw) => {
    const data = JSON.parse(raw);
    emit(data.contextId);
    io.to("user:" + data.userId).emit("verdict", data);
  });
  await app.listen(Number(process.env.API_PORT || 3001), "0.0.0.0");
  const cleanup=async()=>{try{if(await redis.set('fairround:retention-lock','1','EX',3500,'NX')){const result=await cleanupRecordings(db);if(result.sessions)console.log('Expired recordings removed',result);}}catch(e:any){console.warn('Recording cleanup failed',e.code||e.name);}};
  cleanup();setInterval(cleanup,3600000).unref();
  console.log("FairRound API :3001");
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
