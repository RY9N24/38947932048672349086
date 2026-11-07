import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { eventHash } from "../packages/shared";
import {refreshDemo} from './seed-refresh';
import {seedSimilarity} from './seed-integrity';
const db = new PrismaClient();
const correct = "a, b = map(int, input().split())\nprint(a + b)\n";
async function main() {
  if (process.argv.includes("--reset")) {
    if (process.env.ALLOW_SEED_RESET !== "true")
      throw Error(
        "Set ALLOW_SEED_RESET=true to explicitly reset demo database",
      );
    for (const table of [
      "Chat",
      "Claim",
      "Consent",
      "Review",
      "IntegrityFlag",
      "EditorEvent",
      "EditorSession",
      "Submission",
      "Entry",
      "Match",
      "Team",
      "Contest",
      "Problem",
      "User",
    ])
      await db.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
  if (await db.user.count()) { await refreshDemo(db); return; }
  const password = await bcrypt.hash("FairRound2026!", 12);
  const names = [
    "Организатор",
    "Иван Соколов",
    "Анна Волкова",
    "Дарья Миронова",
    "Михаил Орлов",
    "Пётр Лебедев",
    "Сергей Климов",
    "Ольга Белова",
    "Олег Зотов",
    "Роман Козлов",
    "Кирилл Лисин",
    "Екатерина Тихонова",
    "Алексей Горин",
  ];
  for (let i = 0; i < names.length; i++)
    await db.user.create({
      data: {
        id: i === 0 ? "org" : "u" + i,
        email: i === 0 ? "org@demo.local" : `user${i}@demo.local`,
        name: names[i],
        password,
        role: i === 0 ? "ORGANIZER" : "PARTICIPANT",
      },
    });
  const problems = [
    {
      id: "sum",
      title: "Сумма двух чисел",
      statement:
        "Даны два целых числа a и b. Найдите их сумму.\n\n### Входные данные\nДва целых числа в одной строке, −10⁹ ≤ a, b ≤ 10⁹.\n\n### Выходные данные\nВыведите одно целое число — сумму a и b.",
      tests: [
        { input: "2 3\n", output: "5\n", sample: true },
        { input: "-7 10\n", output: "3\n", sample: false },
        {
          input: "1000000000 1000000000\n",
          output: "2000000000\n",
          sample: false,
        },
      ],
    },
    {
      id: "max",
      title: "Наибольший элемент",
      statement:
        "Найдите наибольшее число в последовательности.\n\n### Входные данные\nВ первой строке n (1 ≤ n ≤ 10⁵). Во второй — n целых чисел.\n\n### Выходные данные\nНаибольшее из чисел.",
      tests: [
        { input: "4\n1 7 3 2\n", output: "7\n", sample: true },
        { input: "3\n-9 -2 -6\n", output: "-2\n", sample: false },
      ],
    },
    {
      id: "brackets",
      title: "Скобочный протокол",
      statement:
        "Проверьте, является ли строка правильной скобочной последовательностью. Строка содержит только круглые скобки.\n\n### Входные данные\nСтрока длиной до 10⁵ символов.\n\n### Выходные данные\nYES, если последовательность правильная, иначе NO.",
      tests: [
        { input: "(())()\n", output: "YES\n", sample: true },
        { input: ")(()\n", output: "NO\n", sample: false },
        { input: "(()\n", output: "NO\n", sample: false },
      ],
    },
    {
      id: "paths",
      title: "Маршрут по клеткам",
      statement:
        "На поле n × m можно двигаться только вниз и вправо. Сколько путей ведёт из верхней левой клетки в правую нижнюю?\n\n### Входные данные\nЦелые n и m, 1 ≤ n, m ≤ 15.\n\n### Выходные данные\nКоличество путей.",
      tests: [
        { input: "2 3\n", output: "3\n", sample: true },
        { input: "1 1\n", output: "1\n", sample: false },
        { input: "3 3\n", output: "6\n", sample: false },
      ],
    },
  ];
  for (const p of problems)
    await db.problem.create({ data: { ...p, authorId: "org" } });
  const now = Date.now();
  for (const c of [
    {
      id: "warmup",
      title: "Разминка. Первый раунд",
      description:
        "Три задачи для знакомства с ареной. Можно присоединиться прямо сейчас.",
      startAt: new Date(now - 10 * 60000),
      duration: 14 * 1440,
      format: "INDIVIDUAL",
      problemIds: ["sum", "max", "brackets"],
    },
    {
      id: "pairs",
      title: "Парный зачёт",
      description:
        "Общий результат, отдельные редакторы. Договоритесь, кто какую задачу берёт.",
      startAt: new Date(now - 10 * 60000),
      duration: 14 * 1440,
      format: "TEAM",
      problemIds: ["sum", "max", "paths"],
    },
    {
      id: "qualifier",
      title: "Отборочный тур",
      description:
        "Завершённый демонстрационный контест. Синтетические записи для показа работы судейской.",
      startAt: new Date(now - 86400000),
      duration: 90,
      format: "INDIVIDUAL",
      problemIds: ["sum", "max", "brackets", "paths"],
    },
    {
      id: "evening",
      title: "Вечерний контест",
      description: "Индивидуальный зачёт. Четыре задачи, полтора часа.",
      startAt: new Date(now + 3600000),
      duration: 90,
      format: "INDIVIDUAL",
      problemIds: ["sum", "max", "brackets", "paths"],
    },
  ])
    await db.contest.create({
      data: { ...c, authorId: "org", published: true },
    });
  await db.contest.create({
    data: {
      id: "draft",
      title: "Новый тур — черновик",
      authorId: "org",
      problemIds: ["sum"],
      startAt: new Date(now + 86400000),
      duration: 60,
    },
  });
  await db.team.create({
    data: {
      id: "demo-team",
      token: "demo-team-invite",
      name: "Две переменные",
      captainId: "u3",
      memberIds: ["u3", "u4"],
    },
  });
  for (const userId of ["u1", "u2", "u3", "u4"]) {
    await db.consent.create({ data: { userId, contextId: "warmup" } });
    await db.entry.create({ data: { userId, contestId: "warmup" } });
  }
  for (const userId of ["u3", "u4"]) {
    await db.consent.create({ data: { userId, contextId: "pairs" } });
    await db.entry.create({
      data: { userId, contestId: "pairs", teamId: "demo-team" },
    });
  }
  const historicalStart = now - 86400000;
  for (let i = 1; i < names.length; i++) {
    const userId = "u" + i;
    await db.entry.create({ data: { userId, contestId: "qualifier" } });
    await db.consent.create({ data: { userId, contextId: "qualifier" } });
    const s = await db.editorSession.create({
      data: { userId, contextId: "qualifier", problemId: "sum" },
    });
    let prev = "",
      seq = 0;
    const suspicious = i === 6;
    const events = suspicious
      ? [
          { type: "change", code: "a, b = ", minute: 1 },
          { type: "blur", code: "a, b = ", minute: 2 },
          { type: "focus", code: "a, b = ", minute: 6 },
          {
            type: "paste",
            code: correct + "# " + "решение ".repeat(112),
            minute: 6.1,
          },
        ]
      : Array.from({ length: Math.ceil(correct.length / 5) }, (_, n) => ({
          type: "change",
          code: correct.slice(0, (n + 1) * 5),
          minute: 1 + n * 0.4,
        }));
    for (const e of events) {
      const payload = {
        type: e.type,
        code: e.code,
        language: "python",
        meta: e.type === "paste" ? { length: 912, internal: false } : {},
        receivedAt: new Date(historicalStart + e.minute * 60000).toISOString(),
      };
      const hash = eventHash(prev, payload);
      await db.editorEvent.create({
        data: {
          sessionId: s.id,
          seq: ++seq,
          type: e.type,
          payload,
          previousHash: prev,
          hash,
          createdAt: new Date(payload.receivedAt),
        },
      });
      prev = hash;
    }
    await db.editorSession.update({
      where: { id: s.id },
      data: { code: events.at(-1)!.code, seq, hash: prev },
    });
    if (suspicious) {
      for (const f of [
        {
          type: "AWAY_THEN_SOLVE",
          level: "warning",
          explanation:
            "Демо-сценарий: вкладка неактивна 4 минуты, затем вставка и успешное решение через 30 секунд.",
        },
        {
          type: "EXTERNAL_PASTE",
          level: "critical",
          explanation:
            "Демо-сценарий: вставлено 912 символов извне редактора. Требуется ручная проверка.",
        },
      ])
        await db.integrityFlag.create({
          data: {
            ...f,
            userId,
            contextId: "qualifier",
            problemId: "sum",
            createdAt: new Date(historicalStart + 6.1 * 60000),
          },
        });
    }
    if (i === 9 || i === 10)
      await db.integrityFlag.create({
        data: {
          userId,
          contextId: "qualifier",
          problemId: "sum",
          type: i === 9 ? "INHUMAN_TYPING" : "NO_RECORDING",
          level: i === 9 ? "warning" : "critical",
          explanation:
            "Синтетический пример сигнала для демонстрации. Не реальное нарушение.",
        },
      });
    for (let p = 0; p < Math.min(4, 1 + (i % 4)); p++)
      await db.submission.create({
        data: {
          userId,
          contextId: "qualifier",
          problemId: ["sum", "max", "brackets", "paths"][p],
          language: "python",
          code: correct,
          status: "OK",
          score: 100,
          createdAt: new Date(historicalStart + (8 + i * 3 + p * 7) * 60000),
          result: { status: "OK", tests: [], synthetic: true },
        },
      });
  }
  await seedSimilarity(db,historicalStart);
  await db.match.create({
    data: {
      id: "demo-duel",
      token: "demo-duel-invite",
      hostId: "u1",
      guestId: "u2",
      problemIds: ["sum", "max", "brackets"],
      duration: 20,
      readyIds: ["u1", "u2"],
      startAt: new Date(now - 600000),
      endsAt: new Date(now - 1),
    },
  });
  await refreshDemo(db);
  console.log(
    "Demo seed created (synthetic historical records explicitly marked).",
  );
}
main().finally(() => db.$disconnect());
