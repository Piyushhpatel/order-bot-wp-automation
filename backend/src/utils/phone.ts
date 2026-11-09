export function normalizePhone(input: string): string {
  return String(input || "").replace(/\D/g, "");
}

export function trunc(text: string, max: number): string {
  const t = (text || "").trim();
  if (t.length <= max) return t;
  if (max <= 1) return t.slice(0, max);
  return `${t.slice(0, max - 1)}…`;
}
