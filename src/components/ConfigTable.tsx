import { memo, useMemo, useState } from "react";
import type { ConfigResult } from "../lib/modelTypes";
import { fmtMoney, fmtNum, fmtPct, labelForReason } from "../lib/formatting";
import { configKey } from "../lib/configKey";
import { InfoTip } from "./InfoTip";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/20/solid";

export type ConfigTableFilters = {
  arch: string;
  cell: string;
  search: string;
};

export const EMPTY_FILTERS: ConfigTableFilters = { arch: "", cell: "", search: "" };

export function isFilterActive(f: ConfigTableFilters): boolean {
  return f.arch !== "" || f.cell !== "" || f.search.trim() !== "";
}

export function applyFilters(
  configs: ConfigResult[],
  f: ConfigTableFilters,
): ConfigResult[] {
  const search = f.search.trim().toLowerCase();
  return configs.filter((c) => {
    if (f.arch && c.architecture !== f.arch) return false;
    if (f.cell && c.cell !== f.cell) return false;
    if (search && !c.cell.toLowerCase().includes(search)) return false;
    return true;
  });
}

type SortKey =
  | "architecture"
  | "cell"
  | "S"
  | "P"
  | "v_pack_nom"
  | "system_eff_avg"
  | "current_margin"
  | "energy_margin"
  | "runtime_min"
  | "pack_mass_kg"
  | "pack_cost_usd"
  | "wh_per_kg"
  | "i_cell_peak";

type SortDir = "asc" | "desc";

type ColumnDef = {
  key: string;
  label: string;
  sortable: boolean;
  tip?: string;
};

const COLUMNS: ColumnDef[] = [
  { key: "architecture", label: "Arch", sortable: true, tip: "Bus topology used: regulated 48V/24V or direct battery bus." },
  { key: "cell", label: "Cell", sortable: true, tip: "Cell chemistry/model from the Cells sidebar." },
  { key: "config", label: "S/P", sortable: false, tip: "Series count × parallel count. S cells in series sets voltage; P strings in parallel sets capacity and current." },
  { key: "voltages", label: "V min/nom/max (V)", sortable: false, tip: "Pack voltage at min SOC, nominal, and max SOC (S × cell voltage)." },
  { key: "system_eff_avg", label: "Sys η", sortable: true, tip: "Average system efficiency = useful load ÷ (useful load + IR loss + converter loss) at the mission average load." },
  { key: "i_cell_peak", label: "I pk/cell (A)", sortable: true, tip: "Peak current per individual cell during the mission's peak load. Drives the current margin check." },
  { key: "current_margin", label: "I marg", sortable: true, tip: "Cell continuous current rating ÷ peak per-cell current. Must be ≥ Min current margin to pass." },
  { key: "energy_margin", label: "E marg", sortable: true, tip: "Pack usable energy ÷ mission chemical energy required. <1.0 means the pack runs out; >Max energy margin is oversized." },
  { key: "runtime_min", label: "Runtime (min)", sortable: true, tip: "Estimated minutes the pack can sustain the average load before depletion." },
  { key: "pack_mass_kg", label: "Mass (kg)", sortable: true, tip: "Total pack mass = cells × mass × overhead factor." },
  { key: "wh_per_kg", label: "Wh/kg (pack)", sortable: true, tip: "Pack-level specific energy (usable Wh ÷ pack mass). Higher is better." },
  { key: "pack_cost_usd", label: "Cost (USD)", sortable: true, tip: "Total pack BOM cost = cells × cell price." },
  { key: "reasons", label: "Reasons", sortable: false, tip: "Why a config was rejected (voltage, current, energy, mass, cost, or converter range). Feasible configs show a single 'feasible' badge." },
];

function getNumeric(c: ConfigResult, key: SortKey): number {
  const v = c[key] as unknown;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") return Number.NaN;
  return Number.NaN;
}

function ConfigTableImpl({
  configs,
  selectedKeys,
  anchorKey,
  onSelectionChange,
  filters,
  onFiltersChange,
}: {
  configs: ConfigResult[];
  selectedKeys: Set<string>;
  anchorKey: string | null;
  /** Emit the new full selection set plus the new anchor key (null
   *  clears it). The table owns the click-modifier logic because it
   *  needs the post-sort/filter row order for Shift-range select. */
  onSelectionChange: (keys: Set<string>, anchor: string | null) => void;
  filters: ConfigTableFilters;
  onFiltersChange: (f: ConfigTableFilters) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("pack_mass_kg");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const architectures = useMemo(
    () => Array.from(new Set(configs.map((c) => c.architecture))).sort(),
    [configs],
  );
  const cells = useMemo(
    () => Array.from(new Set(configs.map((c) => c.cell))).sort(),
    [configs],
  );

  const filtered = useMemo(
    () => applyFilters(configs, filters),
    [configs, filters],
  );

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    arr.sort((a, b) => {
      if (sortKey === "architecture" || sortKey === "cell") {
        const av = a[sortKey] as string;
        const bv = b[sortKey] as string;
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av = getNumeric(a, sortKey);
      const bv = getNumeric(b, sortKey);
      const aBad = Number.isNaN(av);
      const bBad = Number.isNaN(bv);
      if (aBad && bBad) return 0;
      if (aBad) return 1;
      if (bBad) return -1;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleRowClick = (c: ConfigResult, event: React.MouseEvent) => {
    const key = configKey(c);
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;

    // Shift-click extends a text selection by default — suppress it so
    // we get a clean row range select instead.
    if (shift) window.getSelection()?.removeAllRanges();

    if (shift && anchorKey) {
      const startIdx = sorted.findIndex((r) => configKey(r) === anchorKey);
      const endIdx = sorted.findIndex((r) => configKey(r) === key);
      if (startIdx === -1 || endIdx === -1) {
        // Anchor is no longer visible (e.g. filter changed) — fall back
        // to a plain replace-select.
        onSelectionChange(new Set([key]), key);
        return;
      }
      const [lo, hi] =
        startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      const next = new Set(selectedKeys);
      for (let i = lo; i <= hi; i++) next.add(configKey(sorted[i]));
      onSelectionChange(next, key);
      return;
    }

    if (ctrl) {
      const next = new Set(selectedKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onSelectionChange(next, next.size === 0 ? null : key);
      return;
    }

    // Plain click: toggle a sole selection off, otherwise replace.
    if (selectedKeys.size === 1 && selectedKeys.has(key)) {
      onSelectionChange(new Set(), null);
    } else {
      onSelectionChange(new Set([key]), key);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <select
          value={filters.arch}
          onChange={(e) => onFiltersChange({ ...filters, arch: e.target.value })}
        >
          <option value="">All architectures</option>
          {architectures.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={filters.cell}
          onChange={(e) => onFiltersChange({ ...filters, cell: e.target.value })}
        >
          <option value="">All cells</option>
          {cells.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search cell name…"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          style={{ flex: 1, minWidth: 160, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4 }}
        />
        <span className="muted" style={{ alignSelf: "center", fontSize: 12 }}>
          {sorted.length} of {configs.length}
        </span>
      </div>

      <div className="table-wrap" style={{ maxHeight: 520 }}>
        <table className="config-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={col.sortable ? "sortable" : ""}
                  onClick={col.sortable ? () => toggleSort(col.key as SortKey) : undefined}
                >
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    {col.label}
                    {col.tip && <InfoTip text={col.tip} />}
                  </span>
                  {col.sortable && sortKey === col.key && (
                    <span className="sort-indicator" aria-hidden>
                      {sortDir === "asc" ? (
                        <ChevronUpIcon className="sort-icon" />
                      ) : (
                        <ChevronDownIcon className="sort-icon" />
                      )}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="empty-state">
                  No configurations match the current filters.
                </td>
              </tr>
            ) : (
              sorted.map((c) => {
                const key = configKey(c);
                return (
                  <tr
                    key={key}
                    className={selectedKeys.has(key) ? "selected" : ""}
                    onClick={(e) => handleRowClick(c, e)}
                  >
                    <td>{c.architecture}</td>
                    <td>{c.cell}</td>
                    <td>{c.S}S{c.P}P</td>
                    <td>
                      {fmtNum(c.v_pack_min, 1)}/{fmtNum(c.v_pack_nom, 1)}/{fmtNum(c.v_pack_max, 1)}
                    </td>
                    <td>{fmtPct(c.system_eff_avg, 1)}</td>
                    <td>{fmtNum(c.i_cell_peak, 2)}</td>
                    <td>{fmtNum(c.current_margin, 2)}</td>
                    <td>{fmtNum(c.energy_margin, 2)}</td>
                    <td>{fmtNum(c.runtime_min, 1)}</td>
                    <td>{fmtNum(c.pack_mass_kg, 2)}</td>
                    <td>{fmtNum(c.wh_per_kg, 0)}</td>
                    <td>{fmtMoney(c.pack_cost_usd)}</td>
                    <td>
                      {c.reasons.length === 0 ? (
                        <span className="badge ok">feasible</span>
                      ) : (
                        c.reasons.map((r) => (
                          <span key={r} className="badge">{labelForReason(r)}</span>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const ConfigTable = memo(ConfigTableImpl);
