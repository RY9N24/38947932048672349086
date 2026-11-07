import assert from "node:assert/strict";
import { runSandbox, docker } from "../apps/judge/sandbox";
const base = {
  language: "python",
  timeMs: 300,
  memoryMb: 128,
  tests: [
    { input: "2 3\n", output: "5\n" },
    { input: "-7 10\n", output: "3\n" },
  ],
  checker: "tokens",
  scoring: "ICPC",
};
async function main() {
  const cases = [
    ["OK", "a,b=map(int,input().split());print(a+b)"],
    ["WA", "print(0)"],
    ["CE", "if True print(1)"],
    ["RE", "raise RuntimeError()"],
    ["TLE", "while True: pass"],
    ["MLE", "a=[0]*10**9"],
    ["RE", "open('/host-secret','w').write('x')"],
    ["RE", "import socket; socket.create_connection(('1.1.1.1',80),1)"],
    ["RE", "print(open('/app/.env').read())"],
    ["RE", "import os; print(open('/proc/%d/fd/0'%os.getppid()).read())"],
  ];
  for (const [expected, code] of cases) {
    const result = await runSandbox({ ...base, code });
    assert.equal(result.status, expected, JSON.stringify(result));
    console.log(expected, "passed");
  }
  const cpp = await runSandbox({
    ...base,
    language: "cpp",
    code: "#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b;}",
  });
  assert.equal(cpp.status, "OK", JSON.stringify(cpp));
  console.log("C++ OK passed");
  const ce = await runSandbox({
    ...base,
    language: "cpp",
    code: "int main( { broken }",
  });
  assert.equal(ce.status, "CE");
  console.log("C++ CE passed");
  const fork=await runSandbox({...base,code:'import os\nwhile True: os.fork()'});
  assert.ok(['RE','TLE'].includes(fork.status),JSON.stringify(fork));
  console.log('Fork limit passed:',fork.status);
  const before = Date.now();
  const pending = Array.from(
    { length: 20 },
    () => () => runSandbox({ ...base, code: "while True: pass" }),
  );
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (cursor < pending.length) {
        const n = cursor++;
        const result = await pending[n]();
        assert.equal(result.status, "TLE", JSON.stringify(result));
      }
    }),
  );
  assert.equal((await runSandbox({ ...base, code: cases[0][1] })).status, "OK");
  assert.equal(
    (
      await docker.listContainers({
        all: true,
        filters: JSON.stringify({ label: ["fairround.sandbox=true"] }),
      })
    ).length,
    0,
  );
  console.log(
    "20 TLE + recovery OK; no leaked containers; elapsed ms",
    Date.now() - before,
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
