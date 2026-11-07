import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreEntry, decideDuelWinner, eventHash, similarity } from "./index";
const start = new Date("2026-11-07T10:00:00Z");
const attempt = (status: string, minute: number, score = 0) => ({
  userId: "u",
  problemId: "p",
  status,
  score,
  createdAt: new Date(+start + minute * 60000),
});
test("ICPC: CE excluded, failures after OK excluded, first OK counted", () => {
  const s = scoreEntry(
    [
      attempt("CE", 1),
      attempt("WA", 2),
      attempt("OK", 4, 100),
      attempt("WA", 5),
    ],
    ["p"],
    start,
  );
  assert.equal(s.penalty, 24);
  assert.equal(s.solved, 1);
});
test("IOI takes best attempt, never sums attempts", () =>
  assert.equal(
    scoreEntry(
      [attempt("WA", 1, 40), attempt("WA", 2, 60)],
      ["p"],
      start,
      "IOI",
    ).points,
    60,
  ));
test("duel compares solved, penalty, last OK; zero solves draw; surrender loses", () => {
  const empty = scoreEntry([], ["p"], start);
  const a = scoreEntry([attempt("OK", 4)], ["p"], start, "ICPC", 2);
  const b = scoreEntry(
    [attempt("WA", 1), attempt("OK", 3)],
    ["p"],
    start,
    "ICPC",
    2,
  );
  assert.equal(decideDuelWinner(a, empty), "a");
  assert.equal(decideDuelWinner(a, b), "a");
  assert.equal(decideDuelWinner(empty, empty), "draw");
  assert.equal(decideDuelWinner(a, b, "a"), "b");
  assert.equal(decideDuelWinner(a, a), "draw");
  const later = { ...a, lastOk: a.lastOk + 1 };
  assert.equal(decideDuelWinner(a, later), "a");
});
test("chain detects modified payload", () =>
  assert.notEqual(
    eventHash("abc", { code: "a" }),
    eventHash("abc", { code: "b" }),
  ));
test("chain survives PostgreSQL JSONB key reordering", () =>
  assert.equal(
    eventHash("abc", { code: "a", meta: { z: 1, a: 2 } }),
    eventHash("abc", { meta: { a: 2, z: 1 }, code: "a" }),
  ));
test("similarity survives identifier renaming", () =>
  assert.equal(
    similarity("a=int(input());print(a*a)", "x=int(input());print(x*x)"),
    1,
  ));
