import { cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const base = dirname(require.resolve("monaco-editor/package.json"));
mkdirSync(new URL("../apps/web/public/monaco", import.meta.url), {
  recursive: true,
});
cpSync(
  join(base, "min/vs"),
  new URL("../apps/web/public/monaco/vs", import.meta.url),
  { recursive: true },
);
