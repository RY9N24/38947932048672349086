import { db, route, fail, safeUser, secret } from "../main";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
const credentials = z.object({
  email: z.email().max(150),
  password: z.string().min(8).max(128),
});
function session(res: any, user: any) {
  res.cookie(
    "session",
    jwt.sign({ id: user.id }, secret!, { expiresIn: "7d" }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 7 * 86400000,
      path: "/",
    },
  );
  return safeUser(user);
}
export function registerAuth(r: any) {
  route(r, "get", "/me", (_: any, __: any, u: any) => safeUser(u));
  route(r, "get", "/auth/demo", async () =>
    process.env.DEMO_MODE === "true"
      ? (
          await db.user.findMany({
            where: { id: { in: ["org", "u1", "u2", "u3", "u4"] } },
            orderBy: { id: "asc" },
          })
        ).map(safeUser)
      : [],
  );
  route(r, "post", "/auth/demo", async (req: any, res: any) => {
    if (process.env.DEMO_MODE !== "true") fail("Демо-вход отключён", 404);
    if (!["org", "u1", "u2", "u3", "u4"].includes(req.body.id))
      fail("Аккаунт не найден");
    const u = await db.user.findUnique({ where: { id: req.body.id } });
    if (!u) fail("Аккаунт не найден");
    return session(res, u);
  });
  route(r, "post", "/auth/login", async (req: any, res: any) => {
    const data = credentials.safeParse(req.body);
    if (!data.success) fail("Укажите email и пароль от 8 символов");
    const u = await db.user.findUnique({
      where: { email: data.data!.email.toLowerCase() },
    });
    if (!u || !(await bcrypt.compare(data.data!.password, u.password)))
      fail("Email или пароль не подошли", 401);
    return session(res, u);
  });
  route(r, "post", "/auth/register", async (req: any, res: any) => {
    const schema = credentials.extend({
      name: z.string().trim().min(2).max(60),
    });
    const data = schema.safeParse(req.body);
    if (!data.success) fail("Проверьте имя, email и пароль (от 8 символов)");
    const d = data.data!;
    if (await db.user.findUnique({ where: { email: d.email.toLowerCase() } }))
      fail("Этот email уже зарегистрирован");
    const u = await db.user.create({
      data: {
        email: d.email.toLowerCase(),
        name: d.name,
        password: await bcrypt.hash(d.password, 12),
      },
    });
    return session(res, u);
  });
  route(r, "post", "/auth/logout", (_: any, res: any) => {
    res.clearCookie("session", { path: "/" });
  });
}
