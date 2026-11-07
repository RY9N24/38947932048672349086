import { PrismaClient } from "@prisma/client";
import { eventHash, similarity } from "../packages/shared";
export async function seedSimilarity(
  db: PrismaClient,
  historicalStart: number,
) {
  const original = `sequence = input().strip()\nbalance = 0\nvalid = True\nfor bracket in sequence:\n    if bracket == '(':\n        balance += 1\n    else:\n        balance -= 1\n    if balance < 0:\n        valid = False\n        break\nprint('YES' if valid and balance == 0 else 'NO')\n`;
  const other = original
    .replaceAll("sequence", "text")
    .replaceAll("balance", "depth")
    .replaceAll("bracket", "symbol")
    .replaceAll("valid", "correct");
  for (const [n, userId, code] of [
    [0, "u7", original],
    [1, "u8", other],
  ] as const) {
    const session = await db.editorSession.upsert({
      where: {
        userId_contextId_problemId: {
          userId,
          contextId: "qualifier",
          problemId: "brackets",
        },
      },
      create: { userId, contextId: "qualifier", problemId: "brackets" },
      update: {},
    });
    if (!session.seq) {
      let previousHash = "",
        seq = 0;
      const chunks =
        n === 0
          ? Array.from({ length: Math.ceil(code.length / 8) }, (_, i) =>
              code.slice(0, (i + 1) * 8),
            )
          : [code];
      for (const chunk of chunks) {
        const payload = {
          type: n === 0 ? "change" : "paste",
          code: chunk,
          language: "python",
          meta: n === 0 ? {} : { length: code.length, internal: false },
          receivedAt: new Date(
            historicalStart + ((n === 0 ? 15 : 25) + seq * 0.08) * 60000,
          ).toISOString(),
        };
        const hash = eventHash(previousHash, payload);
        await db.editorEvent.create({
          data: {
            sessionId: session.id,
            seq: ++seq,
            type: payload.type,
            payload,
            previousHash,
            hash,
            createdAt: new Date(payload.receivedAt),
          },
        });
        previousHash = hash;
      }
      await db.editorSession.update({
        where: { id: session.id },
        data: { seq, hash: previousHash, code },
      });
    }
    await db.submission.upsert({
      where: { id: "demo-sim-" + userId },
      create: {
        id: "demo-sim-" + userId,
        userId,
        contextId: "qualifier",
        problemId: "brackets",
        language: "python",
        code,
        status: "OK",
        score: 100,
        result: { status: "OK", synthetic: true, tests: [] },
        createdAt: new Date(historicalStart + (n === 0 ? 20 : 27) * 60000),
      },
      update: {},
    });
    if (
      !(await db.integrityFlag.findFirst({
        where: {
          userId,
          contextId: "qualifier",
          problemId: "brackets",
          type: "SIMILAR_CODE",
        },
      }))
    )
      await db.integrityFlag.create({
        data: {
          userId,
          contextId: "qualifier",
          problemId: "brackets",
          type: "SIMILAR_CODE",
          level: "critical",
          explanation: `Демонстрационная пара решений. Сходство нормализованных токенов ${Math.round(similarity(original, other) * 100)}%. Проверьте обе записи.`,
        },
      });
  }
}
