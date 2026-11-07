import { createRequire } from "node:module";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { io } = require("socket.io-client");
const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
const login = await fetch(origin + "/api/auth/demo", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: "u2" }),
});
const cookie = login.headers.get("set-cookie")?.split(";")[0];
for (const url of [origin, "http://localhost:3001"])
  await new Promise((resolve) => {
    const s = io(url, {
      extraHeaders: { Cookie: cookie },
      timeout: 5000,
      reconnection: false,
      transports: ["polling", "websocket"],
    });
    s.on("connect", () => {
      console.log(url, "CONNECTED", s.io.engine.transport.name);
      s.disconnect();
      resolve();
    });
    s.on("connect_error", (e) => {
      console.log(
        url,
        "ERROR",
        e.message,
        e.description?.message || e.description || "",
      );
      s.disconnect();
      resolve();
    });
  });
