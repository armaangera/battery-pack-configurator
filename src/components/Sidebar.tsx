import { useState } from "react";
import type { ReactNode } from "react";
import type { ArchitectureSpec, CellSpec, ModelInputs } from "../lib/modelTypes";
import { CellEditor } from "./CellEditor";
import { ArchitectureEditor } from "./ArchitectureEditor";
import { InfoTip } from "./InfoTip";
import { Tooltip } from "./Tooltip";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";

export type SectionKey =
  | "mission"
  | "loads"
  | "constraints"
  | "architectures"
  | "cells"
  | "thermal";

interface SectionProps {
  open: boolean;
  title: string;
  onToggle: () => void;
  children: ReactNode;
  tip?: string;
}

function Section({ open, title, onToggle, children, tip }: SectionProps) {
  return (
    <div className="section">
      <div className="section-head" onClick={onToggle}>
        <span className="section-title" style={{ display: "inline-flex", alignItems: "center" }}>
          {title}
          {tip && <InfoTip text={tip} />}
        </span>
        <span className="chev" aria-hidden>
          {open ? (
            <ChevronDownIcon className="chev-icon" />
          ) : (
            <ChevronRightIcon className="chev-icon" />
          )}
        </span>
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  step = 0.01,
  min,
  max,
  tip,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  tip?: string;
}) {
  return (
    <div className="form-row">
      <label style={{ display: "inline-flex", alignItems: "center" }}>
        {label}
        {tip && <InfoTip text={tip} />}
      </label>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  sectionsOpen: Record<SectionKey, boolean>;
  onToggleSection: (key: SectionKey) => void;

  inputs: ModelInputs;
  setInputs: (m: ModelInputs) => void;

  cells: CellSpec[];
  setCells: (c: CellSpec[]) => void;
  selectedCells: Set<string>;
  setSelectedCells: (s: Set<string>) => void;

  architectures: ArchitectureSpec[];
  setArchitectures: (a: ArchitectureSpec[]) => void;
  selectedArchs: Set<string>;
  setSelectedArchs: (s: Set<string>) => void;

  knownCurves: string[];

  onRun: () => void;
  onResetAll: () => void;
  onResetCellsToDefaults: () => void;
  onResetArchsToDefaults: () => void;
  onResetScalarsToDefaults: () => void;
  canRun: boolean;
  isRunning: boolean;
  validationMessage: string | null;
}

export function Sidebar(props: SidebarProps) {
  const {
    collapsed,
    onToggleCollapsed,
    sectionsOpen,
    onToggleSection,
    inputs,
    setInputs,
    cells,
    setCells,
    selectedCells,
    setSelectedCells,
    architectures,
    setArchitectures,
    selectedArchs,
    setSelectedArchs,
    knownCurves,
    onRun,
    onResetAll,
    onResetCellsToDefaults,
    onResetArchsToDefaults,
    onResetScalarsToDefaults,
    canRun,
    isRunning,
    validationMessage,
  } = props;

  const [confirmReset, setConfirmReset] = useState(false);

  if (collapsed) {
    return (
      <aside className="sidebar-rail">
        <Tooltip text="Expand sidebar">
          <button
            className="rail-btn"
            onClick={onToggleCollapsed}
            aria-label="Expand sidebar"
          >
            <ChevronRightIcon className="rail-icon-svg" />
          </button>
        </Tooltip>
        <Tooltip text={validationMessage ?? (isRunning ? "Running…" : "Run model")}>
          <button
            className={`rail-btn rail-btn-run ${isRunning ? "running" : ""}`}
            onClick={onRun}
            disabled={!canRun || isRunning}
            aria-label={isRunning ? "Running" : "Run model"}
          >
            <PlayIcon className="rail-icon-svg" />
          </button>
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside className="input-panel">
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={onRun}
          disabled={!canRun || isRunning}
        >
          {isRunning ? "Running…" : "Run model"}
        </button>
        <Tooltip text="Collapse sidebar">
          <button
            className="sidebar-toggle"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
          >
            <ChevronLeftIcon className="rail-icon-svg" />
          </button>
        </Tooltip>
      </div>

      {validationMessage && (
        <div className="error-box" style={{ fontSize: 12 }}>{validationMessage}</div>
      )}

      <Section
        open={sectionsOpen.mission}
        title="Mission"
        tip="How long the load runs and how deep the pack is discharged. Drives required energy, runtime, and thermal rise."
        onToggle={() => onToggleSection("mission")}
      >
        <NumberRow
          label="Mission time (h)"
          tip="Total run duration. Longer missions need more pack energy and produce more heat."
          value={inputs.mission_time_hours}
          onChange={(v) => setInputs({ ...inputs, mission_time_hours: v })}
          step={0.05}
          min={0.05}
        />
        <NumberRow
          label="Usable SOC fraction"
          tip="Fraction of nameplate capacity available between cutoffs. 1.0 = full capacity; 0.9 reserves 10% of state-of-charge."
          value={inputs.usable_soc_fraction}
          onChange={(v) => setInputs({ ...inputs, usable_soc_fraction: v })}
          step={0.05}
          min={0.1}
          max={1}
        />
        <NumberRow
          label="Pack mass overhead"
          tip="Multiplier on raw cell mass to account for casing, BMS, wiring, and interconnects. 1.20 adds 20% over the cells alone."
          value={inputs.pack_mass_overhead_factor}
          onChange={(v) => setInputs({ ...inputs, pack_mass_overhead_factor: v })}
          step={0.05}
          min={1}
          max={2}
        />
      </Section>

      <Section
        open={sectionsOpen.loads}
        title="Loads (W)"
        tip="Electrical loads the pack must power. Average sets the energy budget; peak sets the current margin."
        onToggle={() => onToggleSection("loads")}
      >
        <NumberRow
          label="Cooling avg"
          tip="Average wattage drawn by cooling/thermal management across the whole mission."
          value={inputs.loads.cooling_avg_w}
          onChange={(v) => setInputs({ ...inputs, loads: { ...inputs.loads, cooling_avg_w: v } })}
          step={5} min={0}
        />
        <NumberRow
          label="Cooling peak"
          tip="Short-duration burst power the cooling system can draw. Drives peak current sizing."
          value={inputs.loads.cooling_peak_w}
          onChange={(v) => setInputs({ ...inputs, loads: { ...inputs.loads, cooling_peak_w: v } })}
          step={5} min={0}
        />
        <NumberRow
          label="Other avg"
          tip="Average wattage from all non-cooling loads (compute, sensors, comms, etc.)."
          value={inputs.loads.other_avg_w}
          onChange={(v) => setInputs({ ...inputs, loads: { ...inputs.loads, other_avg_w: v } })}
          step={5} min={0}
        />
        <NumberRow
          label="Other peak"
          tip="Worst-case burst power from non-cooling loads. Added to cooling peak for total peak current."
          value={inputs.loads.other_peak_w}
          onChange={(v) => setInputs({ ...inputs, loads: { ...inputs.loads, other_peak_w: v } })}
          step={5} min={0}
        />
      </Section>

      <Section
        open={sectionsOpen.constraints}
        title="Constraints"
        tip="Hard limits a configuration must satisfy to be feasible. Configs failing any of these end up in the Rejected tab."
        onToggle={() => onToggleSection("constraints")}
      >
        <NumberRow
          label="Min current margin"
          tip="Required ratio of cell continuous current capability to peak draw per cell. 1.0 = exactly at the limit; 1.2 = 20% headroom."
          value={inputs.min_current_margin}
          onChange={(v) => setInputs({ ...inputs, min_current_margin: v })}
          step={0.05}
          min={0}
        />
        <NumberRow
          label="Min energy margin"
          tip="Required ratio of pack usable energy to mission energy. Below 1.0 the pack runs out before the mission ends."
          value={inputs.min_energy_margin}
          onChange={(v) => setInputs({ ...inputs, min_energy_margin: v })}
          step={0.05}
          min={0}
        />
        <NumberRow
          label="Max energy margin"
          tip="Upper bound on energy margin. Configs above this carry too much spare capacity and are flagged as oversized."
          value={inputs.max_energy_margin ?? 0}
          onChange={(v) => setInputs({ ...inputs, max_energy_margin: v })}
          step={0.1}
          min={1}
        />
        <NumberRow
          label="Max pack mass (kg)"
          tip="Total pack mass cap (cells × overhead factor). Configs exceeding this are rejected."
          value={inputs.max_pack_mass_kg}
          onChange={(v) => setInputs({ ...inputs, max_pack_mass_kg: v })}
          step={0.1}
          min={0}
        />
        <NumberRow
          label="Max pack cost ($)"
          tip="Total pack BOM cost cap based on cell count × cell price. Configs above this are rejected."
          value={inputs.max_pack_cost_usd}
          onChange={(v) => setInputs({ ...inputs, max_pack_cost_usd: v })}
          step={10}
          min={0}
        />
        <NumberRow
          label="Max parallel"
          tip="Largest number of parallel strings (P) the sweep will try for each cell/architecture pair."
          value={inputs.max_parallel}
          onChange={(v) => setInputs({ ...inputs, max_parallel: Math.round(v) })}
          step={1}
          min={1}
          max={8}
        />
        <button
          className="btn"
          style={{ marginTop: 6, fontSize: 11, padding: "4px 10px" }}
          onClick={onResetScalarsToDefaults}
        >
          Reset mission/loads/constraints
        </button>
      </Section>

      <Section
        open={sectionsOpen.architectures}
        title={`Architectures (${selectedArchs.size}/${architectures.length})`}
        tip="Bus topologies to sweep. Each architecture defines a target bus voltage and converter type; only checked rows are included in the run."
        onToggle={() => onToggleSection("architectures")}
      >
        <ArchitectureEditor
          architectures={architectures}
          selected={selectedArchs}
          knownCurves={knownCurves}
          onArchitecturesChange={setArchitectures}
          onSelectedChange={setSelectedArchs}
          onResetDefaults={onResetArchsToDefaults}
        />
      </Section>

      <Section
        open={sectionsOpen.cells}
        title={`Cells (${selectedCells.size}/${cells.length})`}
        tip="Candidate cells to sweep. The model tries each checked cell across every series (S) and parallel (P) count that fits the architectures."
        onToggle={() => onToggleSection("cells")}
      >
        <CellEditor
          cells={cells}
          selected={selectedCells}
          onCellsChange={setCells}
          onSelectedChange={setSelectedCells}
          onResetDefaults={onResetCellsToDefaults}
        />
      </Section>

      <Section
        open={sectionsOpen.thermal}
        title="Thermal (advanced)"
        tip="Adiabatic thermal model: assumes 100% of IR losses heat the pack with no convection or radiation. Worst-case estimate."
        onToggle={() => onToggleSection("thermal")}
      >
        <NumberRow
          label="Ambient (°C)"
          tip="Starting pack temperature. Pack rise stacks on top of this in the thermal chart."
          value={inputs.thermal.ambient_temp_c}
          onChange={(v) => setInputs({ ...inputs, thermal: { ...inputs.thermal, ambient_temp_c: v } })}
          step={1}
        />
        <NumberRow
          label="cp (J/kg·K)"
          tip="Effective specific heat of the pack. Higher cp absorbs more heat per °C, so temperature rise is slower."
          value={inputs.thermal.pack_specific_heat_j_per_kg_k}
          onChange={(v) => setInputs({ ...inputs, thermal: { ...inputs.thermal, pack_specific_heat_j_per_kg_k: v } })}
          step={10}
        />
        <NumberRow
          label="Time samples"
          tip="Number of points sampled along the mission for each thermal trace. Higher = smoother curve, slightly more memory."
          value={inputs.thermal.num_time_points}
          onChange={(v) =>
            setInputs({ ...inputs, thermal: { ...inputs.thermal, num_time_points: Math.round(v) } })
          }
          step={10}
          min={10}
          max={500}
        />
      </Section>

      <div className="card" style={{ borderColor: "#fecaca" }}>
        {confirmReset ? (
          <>
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              Reset cells, architectures, mission/load/constraint values, and saved selections back to defaults?
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn btn-danger"
                style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => { setConfirmReset(false); onResetAll(); }}
              >
                Yes, reset everything
              </button>
              <button
                className="btn"
                style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            className="btn"
            style={{ fontSize: 12, padding: "4px 10px", width: "100%" }}
            onClick={() => setConfirmReset(true)}
          >
            Reset everything to defaults
          </button>
        )}
      </div>

      <div className="muted" style={{ fontSize: 11, textAlign: "center" }}>
        Made by Armaan Gera
      </div>
    </aside>
  );
}
