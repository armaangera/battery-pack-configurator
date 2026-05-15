import type { CellSpec } from "./modelTypes";
import { validateCell, hasAny } from "./validation";

const CELL_FIELDS: Array<keyof CellSpec> = [
  "name",
  "chemistry",
  "form_factor",
  "v_nom",
  "v_max",
  "v_min",
  "capacity_ah",
  "i_cont_a",
  "r_int_model_ohm",
  "mass_g",
  "cost_usd",
  "cycle_life_est",
  "source_quality",
  "realized_capacity_factor",
  "notes",
];

const NUMERIC_CELL_FIELDS = new Set<keyof CellSpec>([
  "v_nom",
  "v_max",
  "v_min",
  "capacity_ah",
  "i_cont_a",
  "r_int_model_ohm",
  "mass_g",
  "cost_usd",
  "realized_capacity_factor",
]);

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function cellsToCsv(cells: CellSpec[]): string {
  const header = CELL_FIELDS.join(",");
  const rows = cells.map((c) =>
    CELL_FIELDS.map((f) => csvEscape((c as unknown as Record<string, unknown>)[f])).join(","),
  );
  return [header, ...rows].join("\n");
}

/** Parse a CSV line respecting quotes. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

export interface ImportResult<T> {
  imported: T[];
  errors: string[];
}

function coerceCell(raw: Record<string, unknown>): { cell: Partial<CellSpec>; warn: string[] } {
  const warn: string[] = [];
  const out: Record<string, unknown> = {};
  for (const f of CELL_FIELDS) {
    if (!(f in raw)) continue;
    const v = raw[f];
    if (v === "" || v === null || v === undefined) continue;
    if (NUMERIC_CELL_FIELDS.has(f)) {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (Number.isNaN(n)) {
        warn.push(`${f}: cannot parse "${v}" as number`);
      } else {
        out[f] = n;
      }
    } else {
      out[f] = String(v);
    }
  }
  return { cell: out as Partial<CellSpec>, warn };
}

export function parseCellsCsv(text: string): ImportResult<CellSpec> {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { imported: [], errors: ["CSV must include a header row and at least one data row."] };
  }
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const imported: CellSpec[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((h, j) => {
      raw[h] = values[j] ?? "";
    });
    const { cell, warn } = coerceCell(raw);
    for (const w of warn) errors.push(`Row ${i + 1}: ${w}`);
    const errs = validateCell(cell);
    if (hasAny(errs)) {
      errors.push(
        `Row ${i + 1} (${cell.name ?? "unnamed"}): ${Object.values(errs).join("; ")}`,
      );
    } else {
      imported.push(cell as CellSpec);
    }
  }
  return { imported, errors };
}

export function parseCellsJson(text: string): ImportResult<CellSpec> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { imported: [], errors: [`JSON parse error: ${(e as Error).message}`] };
  }
  if (!Array.isArray(parsed)) {
    return { imported: [], errors: ["JSON must be an array of cells."] };
  }
  const imported: CellSpec[] = [];
  const errors: string[] = [];
  parsed.forEach((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      errors.push(`Item ${i + 1} is not an object`);
      return;
    }
    const { cell, warn } = coerceCell(entry as Record<string, unknown>);
    for (const w of warn) errors.push(`Item ${i + 1}: ${w}`);
    const errs = validateCell(cell);
    if (hasAny(errs)) {
      errors.push(
        `Item ${i + 1} (${cell.name ?? "unnamed"}): ${Object.values(errs).join("; ")}`,
      );
    } else {
      imported.push(cell as CellSpec);
    }
  });
  return { imported, errors };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsText(file);
  });
}
