import Docker from "dockerode";
import { PassThrough } from "node:stream";
import { Agent, request } from "node:http";
// Keep the attach socket out of the HTTP pool so other Docker requests cannot reach stdin.
export const docker = new Docker({
  agent: new Agent({ keepAlive: false }),
  ...(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST } : {}),
} as any);
async function attachInput(id: string) {
  const socketPath = await (docker.modem as any).getSocketPath();
  return new Promise<any>((resolve, reject) => {
    const req = request({
      socketPath,
      path: `/containers/${id}/attach?stream=1&stdin=1&stdout=1&stderr=1`,
      method: "POST",
      agent: false,
      headers: { Connection: "Upgrade", Upgrade: "tcp", "Content-Length": "0" },
    });
    req.on("upgrade", (_, socket, head) => {
      if (head.length) socket.unshift(head);
      resolve(socket);
    });
    req.on("error", reject);
    req.on("response", (res) => {
      reject(Error("Docker attach did not upgrade: " + res.statusCode));
      res.resume();
    });
    req.end();
  });
}
export async function runSandbox(payload: any) {
  let container: Docker.Container | undefined;
  let timer: NodeJS.Timeout | undefined;
  let timedOut = false;
  try {
    const memory = (payload.memoryMb + 64) * 1024 * 1024;
    container = await docker.createContainer({
      Image:
        payload.language === "cpp"
          ? "fairround-sandbox-cpp"
          : "fairround-sandbox-python",
      User: "65534:65534",
      WorkingDir: "/work",
      OpenStdin: true,
      StdinOnce: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      NetworkDisabled: true,
      HostConfig: {
        NetworkMode: "none",
        ReadonlyRootfs: true,
        Memory: memory,
        MemorySwap: memory,
        NanoCpus: 1e9,
        PidsLimit: 64,
        CapDrop: ["ALL"],
        SecurityOpt: ["no-new-privileges"],
        Tmpfs: {
          "/work": "rw,nosuid,size=64m,mode=1777,exec",
          "/tmp": "rw,nosuid,noexec,size=16m,mode=1777",
        },
        Ulimits: [
          { Name: "nofile", Soft: 64, Hard: 64 },
          { Name: "fsize", Soft: 33554432, Hard: 33554432 },
        ],
        AutoRemove: false,
      },
      Labels: { "fairround.sandbox": "true" },
    });
    // Attach query options must not become a JSON request body: Docker forwards
    // such a body into stdin on some engine/modem combinations.
    const stream = await attachInput(container.id);
    let output = "",
      errors = "";
    const out = new PassThrough(),
      err = new PassThrough();
    out.on("data", (d) => {
      if (output.length < 1024 * 1024) output += d.toString();
    });
    err.on("data", (d) => {
      if (errors.length < 8192) errors += d.toString();
    });
    docker.modem.demuxStream(stream, out, err);
    await container.start();
    stream.write(JSON.stringify(payload) + "\n");
    timer = setTimeout(
      () => {
        timedOut = true;
        container?.kill().catch(() => {});
      },
      Math.min(180000, payload.timeMs * payload.tests.length * 3 + 15000),
    );
    const state = await container.wait();
    await new Promise<void>((resolve) => {
      if ((stream as any).readableEnded || (stream as any).destroyed) resolve();
      else {
        stream.once("end", resolve);
        setTimeout(resolve, 500).unref();
      }
    });
    if (timedOut) return { status: "TLE", tests: [], score: 0 };
    if ((await container.inspect()).State.OOMKilled)
      return { status: "MLE", tests: [], score: 0 };
    // Read Docker's retained logs after exit; attach can close before the final frame arrives.
    const logs = await container.logs({
      stdout: true,
      stderr: false,
      follow: false,
    });
    if (Buffer.isBuffer(logs)) {
      let offset = 0;
      const chunks: Buffer[] = [];
      while (offset + 8 <= logs.length) {
        const n = logs.readUInt32BE(offset + 4);
        chunks.push(logs.subarray(offset + 8, offset + 8 + n));
        offset += 8 + n;
      }
      if (chunks.length) output = Buffer.concat(chunks).toString();
    }
    try {
      const line = output.trim().split("\n").at(-1)!;
      const result = JSON.parse(line);
      if (!["OK", "WA", "TLE", "MLE", "RE", "CE", "SE"].includes(result.status))
        throw Error();
      return result;
    } catch {
      return {
        status: state.StatusCode ? "RE" : "SE",
        tests: [],
        score: 0,
        message: "Среда не вернула корректный результат",
        diagnostic: {
          exitCode: state.StatusCode,
          outputBytes: output.length,
          errorBytes: errors.length,
        },
      };
    }
  } finally {
    if (timer) clearTimeout(timer);
    if (container) await container.remove({ force: true }).catch(() => {});
  }
}
