import { memo } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import type { ConfigResult } from "../lib/modelTypes";
import { fmtMoney, fmtNum, fmtPct, labelForReason } from "../lib/formatting";
import { copyToClipboard } from "../lib/csvExport";
import { configKey } from "../lib/configKey";
import { InfoTip } from "./InfoTip";
import { Tooltip } from "./Tooltip";

type Item = { label: string; value: string; tip?: string };

function buildItems(config: ConfigResult): Item[] {
  return [
    { label: "Architecture", value: config.architecture },
    { label: "Cell", value: config.cell },
    {
      label: "S/P",
      value: `${config.S}S${config.P}P`,
      tip: "S cells wired in series (sets voltage) × P parallel strings (sets capacity and current capability).",
    },
    {
      label: "V pack min/nom/max",
      value: `${fmtNum(config.v_pack_min, 2)} / ${fmtNum(config.v_pack_nom, 2)} / ${fmtNum(config.v_pack_max, 2)} V`,
      tip: "Pack voltage at min SOC / nominal / max SOC. Equals S × cell voltage at each point.",
    },
    {
      label: "V terminal @peak",
      value: `${fmtNum(config.v_pack_min_terminal_peak, 2)} V`,
      tip: "Pack terminal voltage during peak current draw, after IR drop. Must stay within the converter's allowed input range.",
    },
    {
      label: "I cell peak / avg",
      value: `${fmtNum(config.i_cell_peak, 2)} / ${fmtNum(config.i_cell_avg, 2)} A`,
      tip: "Current carried by each individual cell at peak load and at mission average load.",
    },
    {
      label: "Current margin",
      value: `${fmtNum(config.current_margin, 2)}×`,
      tip: "Cell continuous current rating ÷ peak per-cell current. Must be ≥ Min current margin from constraints.",
    },
    {
      label: "Energy margin",
      value: `${fmtNum(config.energy_margin, 2)}×`,
      tip: "Pack usable energy ÷ mission chemical energy required (terminal + IR losses). 1.0 = exact fit; below 1.0 means depletion.",
    },
    {
      label: "Reserve",
      value: `${fmtNum(config.reserve_pct, 1)}%`,
      tip: "Spare capacity left at end of mission, expressed as a % of mission energy. Reserve % = (energy margin − 1) × 100.",
    },
    {
      label: "Runtime",
      value: `${fmtNum(config.runtime_min, 1)} min`,
      tip: "Minutes the pack can sustain the mission average load before depletion (usable Wh ÷ average battery power).",
    },
    {
      label: "Wh pack usable",
      value: `${fmtNum(config.wh_pack_usable, 1)} Wh`,
      tip: "Pack-level usable energy = S × P × cell Ah × cell nom V × usable SOC × realized capacity factor.",
    },
    {
      label: "Wh required (chem)",
      value: `${fmtNum(config.wh_required_chem, 1)} Wh`,
      tip: "Total chemical energy the cells must deliver: terminal load energy plus internal IR losses over the mission.",
    },
    {
      label: "P batt avg / peak",
      value: `${fmtNum(config.p_batt_avg, 1)} / ${fmtNum(config.p_batt_peak, 1)} W`,
      tip: "Power drawn from the cells at the average load and at the peak load (includes converter loss).",
    },
    {
      label: "IR loss avg / peak",
      value: `${fmtNum(config.ir_loss_avg, 2)} / ${fmtNum(config.ir_loss_peak, 2)} W`,
      tip: "I²R heat dissipated inside the cells. The thermal chart uses IR loss avg as the heat input source.",
    },
    {
      label: "Conv loss avg / peak",
      value: `${fmtNum(config.conv_loss_avg, 2)} / ${fmtNum(config.conv_loss_peak, 2)} W`,
      tip: "Power lost in the DC/DC converter (or 0 W for direct-bus architectures).",
    },
    {
      label: "System efficiency",
      value: fmtPct(config.system_eff_avg, 2),
      tip: "Average system η = useful load ÷ (useful load + IR loss + converter loss) at the mission average load.",
    },
    {
      label: "Converter η avg / peak",
      value: `${fmtPct(config.converter_eff_avg, 2)} / ${fmtPct(config.converter_eff_peak, 2)}`,
      tip: "DC/DC converter efficiency at the mission average operating point and at peak load, from the architecture's efficiency curve.",
    },
    {
      label: "Pack mass (cells / total)",
      value: `${fmtNum(config.pack_cells_mass_kg, 2)} / ${fmtNum(config.pack_mass_kg, 2)} kg`,
      tip: "Cells-only mass and total pack mass after applying the pack mass overhead factor.",
    },
    {
      label: "Pack cost",
      value: fmtMoney(config.pack_cost_usd),
      tip: "Total pack BOM cost = S × P × cell price (no enclosure/BMS/wiring cost added).",
    },
    {
      label: "Wh/kg (pack)",
      value: fmtNum(config.wh_per_kg, 1),
      tip: "Pack-level specific energy: usable Wh ÷ total pack mass kg. Higher is better.",
    },
  ];
}

function SingleConfigCard({ config }: { config: ConfigResult }) {
  const items = buildItems(config);
  return (
    <div className="card">
      <div className="collapsible-header" style={{ marginBottom: 10 }}>
        <span
          className="card-title"
          style={{ margin: 0, display: "inline-flex", alignItems: "center" }}
        >
          Selected configuration
          <InfoTip text="All computed metrics for the row you clicked. Hover any field label for a one-line explanation of how it's defined." />
        </span>
        <button
          className="btn"
          onClick={() => copyToClipboard(JSON.stringify(config, null, 2))}
        >
          Copy JSON
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 8,
        }}
      >
        {items.map((it) => (
          <div key={it.label} style={{ fontSize: 12 }}>
            <div
              className="muted"
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {it.label}
              {it.tip && <InfoTip text={it.tip} />}
            </div>
            <div style={{ fontWeight: 600 }}>{it.value}</div>
          </div>
        ))}
      </div>
      {config.reasons.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div
            className="muted"
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Rejection reasons
          </div>
          <div style={{ marginTop: 4 }}>
            {config.reasons.map((r) => (
              <span key={r} className="badge">
                {labelForReason(r)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MultiConfigCard({
  configs,
  colorFor,
  onRemove,
  onClear,
}: {
  configs: ConfigResult[];
  colorFor: (arch: string) => string;
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="card">
      <div className="collapsible-header" style={{ marginBottom: 10 }}>
        <span
          className="card-title"
          style={{ margin: 0, display: "inline-flex", alignItems: "center" }}
        >
          {configs.length} configurations selected
          <InfoTip text="Side-by-side comparison of the rows you have selected. Each row's color swatch matches that architecture's color in the charts. Click an × to drop one; click a single row in the table for full details." />
        </span>
        <button
          className="btn"
          onClick={() =>
            copyToClipboard(JSON.stringify(configs, null, 2))
          }
        >
          Copy JSON
        </button>
      </div>
      <div className="multi-select-list">
        <div className="multi-select-row multi-select-header">
          <span />
          <span>Config</span>
          <span>Mass (kg)</span>
          <span>Cost</span>
          <span>Runtime (min)</span>
          <span>Sys η</span>
          <span>E marg</span>
          <span />
        </div>
        {configs.map((c) => {
          const key = configKey(c);
          return (
            <div key={key} className="multi-select-row">
              <span
                className="multi-select-swatch"
                style={{ background: colorFor(c.architecture) }}
                aria-hidden
              />
              <span className="multi-select-config">
                <strong>{c.cell}</strong>
                <span className="muted"> {c.S}S{c.P}P · {c.architecture}</span>
              </span>
              <span>{fmtNum(c.pack_mass_kg, 2)}</span>
              <span>{fmtMoney(c.pack_cost_usd)}</span>
              <span>{fmtNum(c.runtime_min, 1)}</span>
              <span>{fmtPct(c.system_eff_avg, 1)}</span>
              <span>{fmtNum(c.energy_margin, 2)}×</span>
              <Tooltip text="Remove from selection">
                <button
                  className="icon-btn-lg"
                  onClick={() => onRemove(key)}
                  aria-label="Remove from selection"
                >
                  <XMarkIcon className="icon-svg" />
                </button>
              </Tooltip>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClear}>
          Clear selection
        </button>
      </div>
    </div>
  );
}

function ConfigDetailsImpl({
  configs,
  colorFor,
  onRemove,
  onClear,
}: {
  configs: ConfigResult[];
  colorFor: (arch: string) => string;
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  if (configs.length === 0) return null;
  if (configs.length === 1) return <SingleConfigCard config={configs[0]} />;
  return (
    <MultiConfigCard
      configs={configs}
      colorFor={colorFor}
      onRemove={onRemove}
      onClear={onClear}
    />
  );
}

export const ConfigDetails = memo(ConfigDetailsImpl);
