import { PrismaClient } from "@prisma/client";
import { seedSimilarity } from "../prisma/seed-integrity";
const db = new PrismaClient();
async function main() {
  const c = await db.contest.findUniqueOrThrow({ where: { id: "qualifier" } });
  await seedSimilarity(db, +c.startAt);
}
main().finally(() => db.$disconnect());
