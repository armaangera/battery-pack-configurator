export function fmtNum(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined) return "—";
  if (typeof x !== "number" || Number.isNaN(x) || !Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

export function fmtInt(x: number | null | undefined): string {
  if (x === null || x === undefined || typeof x !== "number" || !Number.isFinite(x)) return "—";
  return Math.round(x).toString();
}

export function fmtPct(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || typeof x !== "number" || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtMoney(x: number | null | undefined): string {
  if (x === null || x === undefined || typeof x !== "number" || !Number.isFinite(x)) return "—";
  return `$${x.toFixed(2)}`;
}

export function fmtConfig(s: number | null | undefined, p: number | null | undefined): string {
  if (s == null || p == null) return "—";
  return `${s}S${p}P`;
}

export const REASON_LABELS: Record<string, string> = {
  converter_range: "Converter range",
  current: "Current margin",
  energy: "Energy margin",
  mass: "Mass limit",
  cost: "Cost limit",
  oversized: "Oversized",
  voltage_low: "Voltage too low",
  voltage_high: "Voltage too high",
};

export function labelForReason(r: string): string {
  return REASON_LABELS[r] ?? r;
}
