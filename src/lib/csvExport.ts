import type { ConfigResult } from "./modelTypes";

const CSV_COLUMNS: Array<keyof ConfigResult | "config"> = [
  "architecture",
  "cell",
  "config",
  "S",
  "P",
  "v_pack_min",
  "v_pack_nom",
  "v_pack_max",
  "v_pack_min_terminal_peak",
  "i_cell_peak",
  "i_cell_avg",
  "current_margin",
  "wh_pack_usable",
  "wh_required",
  "wh_required_chem",
  "energy_margin",
  "reserve_pct",
  "runtime_min",
  "p_batt_avg",
  "p_batt_peak",
  "ir_loss_avg",
  "ir_loss_peak",
  "conv_loss_avg",
  "conv_loss_peak",
  "system_eff_avg",
  "converter_eff_avg",
  "converter_eff_peak",
  "converter_eff_worst_avg",
  "converter_eff_worst_peak",
  "pack_cells_mass_kg",
  "pack_mass_kg",
  "pack_cost_usd",
  "wh_per_kg",
  "feasible",
  "reasons",
];

function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return escape(v.join("; "));
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function configsToCsv(configs: ConfigResult[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = configs.map((c) =>
    CSV_COLUMNS
      .map((col) => {
        if (col === "config") return escape(`${c.S}S${c.P}P`);
        return escape((c as unknown as Record<string, unknown>)[col]);
      })
      .join(","),
  );
  return [header, ...rows].join("\n");
}

export function downloadTextFile(
  filename: string,
  text: string,
  mimeType: string = "text/plain;charset=utf-8",
): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error("Clipboard API not available"));
}
