import { createHash } from "node:crypto";
export * from "./scoring";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical((value as any)[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function eventHash(previousHash: string, payload: unknown) {
  return createHash("sha256")
    .update(previousHash + canonical(payload))
    .digest("hex");
}
export function fingerprints(code: string) {
  const tokens =
    code
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*/g, " ")
      .match(
        /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\d+(?:\.\d+)?|[a-zA-Z_]\w*|[^\s]/g,
      ) || [];
  const keywords = new Set([
    "if",
    "else",
    "for",
    "while",
    "return",
    "def",
    "int",
    "float",
    "print",
    "input",
    "in",
    "range",
    "include",
    "using",
    "std",
    "cin",
    "cout",
    "True",
    "False",
  ]);
  const norm = tokens.map((t) =>
    /^['"]/.test(t)
      ? "STR"
      : /^\d/.test(t)
        ? "NUM"
        : /^[a-zA-Z_]/.test(t) && !keywords.has(t)
          ? "ID"
          : t,
  );
  const grams = Array.from({ length: Math.max(1, norm.length - 4) }, (_, i) =>
    createHash("sha256")
      .update(norm.slice(i, i + 5).join(" "))
      .digest("hex")
      .slice(0, 12),
  );
  const out = new Set<string>();
  for (let i = 0; i < Math.max(1, grams.length - 3); i++)
    out.add(grams.slice(i, i + 4).sort()[0]);
  return out;
}
export function similarity(a: string, b: string) {
  const x = fingerprints(a),
    y = fingerprints(b);
  return [...x].filter((t) => y.has(t)).length / new Set([...x, ...y]).size;
}
export const riskWeight: Record<string, number> = {
  info: 1,
  warning: 5,
  critical: 20,
};
