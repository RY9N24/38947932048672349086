export type Attempt = {
  userId: string;
  problemId: string;
  status: string;
  createdAt: Date | string;
  score: number;
  teamId?: string;
  sample?: boolean;
};
export function scoreEntry(
  attempts: Attempt[],
  problemIds: string[],
  start: Date | string,
  mode = "ICPC",
  penalty = 20,
) {
  const cells = problemIds.map((problemId) => {
    const rows = attempts
      .filter((s) => s.problemId === problemId && !s.sample)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    const ok = rows.find((s) => s.status === "OK");
    const failures = rows.filter(
      (s) =>
        !["OK", "CE", "QUEUED", "RUNNING", "SE"].includes(s.status) &&
        (!ok || +new Date(s.createdAt) < +new Date(ok.createdAt)),
    ).length;
    const minutes = ok
      ? Math.max(
          0,
          Math.floor((+new Date(ok.createdAt) - +new Date(start)) / 60000),
        )
      : 0;
    return {
      problemId,
      solved: !!ok,
      failures,
      minutes,
      points: Math.max(0, ...rows.map((s) => s.score)),
      pending: rows.some((s) => ["QUEUED", "RUNNING"].includes(s.status)),
      lastOk: ok ? +new Date(ok.createdAt) : 0,
    };
  });
  return {
    cells,
    solved: cells.filter((c) => c.solved).length,
    points: cells.reduce((s, c) => s + c.points, 0),
    penalty: cells.reduce(
      (s, c) => s + (c.solved ? c.minutes + c.failures * penalty : 0),
      0,
    ),
    lastOk: Math.max(0, ...cells.map((c) => c.lastOk)),
    mode,
  };
}
export function decideDuelWinner(
  a: ReturnType<typeof scoreEntry>,
  b: ReturnType<typeof scoreEntry>,
  surrender?: "a" | "b",
) {
  if (surrender) return surrender === "a" ? "b" : "a";
  if (a.solved !== b.solved) return a.solved > b.solved ? "a" : "b";
  if (a.solved === 0) return "draw";
  if (a.penalty !== b.penalty) return a.penalty < b.penalty ? "a" : "b";
  if (a.lastOk !== b.lastOk) return a.lastOk < b.lastOk ? "a" : "b";
  return "draw";
}
