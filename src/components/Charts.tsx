import { memo, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { ConfigResult, ModelResult, ThermalTrace } from "../lib/modelTypes";
import { buildUniqueColorMap } from "../lib/colors";
import { computeThermalTrace } from "../lib/thermal";
import { configKey } from "../lib/configKey";
import { InfoTip } from "./InfoTip";

/** Cap on thermal lines so a wide-open filter (e.g. "All architectures"
 *  + many cells) stays readable. */
const MAX_THERMAL_LINES = 24;

type ArchColor = (arch: string) => string;

function groupByArch<T extends { architecture: string }>(
  configs: T[],
): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const c of configs) {
    if (!m.has(c.architecture)) m.set(c.architecture, []);
    m.get(c.architecture)!.push(c);
  }
  return m;
}

/** Render a selected scatter point at the same size as the default
 *  cloud, with a thin dark outline. The opacity gap to the dimmed
 *  unselected layer is what does the visual work — the outline just
 *  keeps the dot crisp at any background color. */
function makeSelectedDot(color: string) {
  return function SelectedDot(props: { cx?: number; cy?: number }) {
    const { cx, cy } = props;
    if (cx == null || cy == null) return <g />;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill={color}
        stroke="#201e1f"
        strokeWidth={1.2}
      />
    );
  };
}

/** Produce the Scatter children for a chart, split into "unselected
 *  underneath" and "selected on top" layers. Splitting the data this
 *  way (rather than per-point branching inside a single shape callback)
 *  changes the data array references on each selection change, which
 *  reliably forces Recharts to re-render the layers. */
function buildScatterLayers<
  T extends {
    architecture: string;
    cell: string;
    S: number;
    P: number;
  },
>(
  configs: T[],
  selectedKeys: Set<string>,
  colorFor: ArchColor,
): React.ReactElement[] {
  const grouped = groupByArch(configs);
  const archs = Array.from(grouped.keys());
  const hasSelection = selectedKeys.size > 0;
  const out: React.ReactElement[] = [];

  for (const arch of archs) {
    const all = grouped.get(arch)!;
    const data = hasSelection
      ? all.filter((c) => !selectedKeys.has(configKey(c)))
      : all;
    if (data.length === 0) continue;
    out.push(
      <Scatter
        key={`u-${arch}`}
        name={arch}
        data={data}
        fill={colorFor(arch)}
        // When the user has narrowed to a selection, dim every other
        // point hard so the highlighted ones don't get lost in the cloud.
        fillOpacity={hasSelection ? 0.18 : 1}
      />,
    );
  }

  if (hasSelection) {
    for (const arch of archs) {
      const all = grouped.get(arch)!;
      const data = all.filter((c) => selectedKeys.has(configKey(c)));
      if (data.length === 0) continue;
      const color = colorFor(arch);
      out.push(
        <Scatter
          key={`s-${arch}`}
          name={arch}
          data={data}
          fill={color}
          shape={makeSelectedDot(color)}
        />,
      );
    }
  }

  return out;
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ConfigResult }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const c = payload[0].payload;
  return (
    <div style={{ background: "white", border: "1px solid #ddd", padding: 8, fontSize: 12, borderRadius: 4 }}>
      <div><strong>{c.cell}</strong> {c.S}S{c.P}P</div>
      <div className="muted">{c.architecture}</div>
      <div>Mass {c.pack_mass_kg} kg · ${c.pack_cost_usd}</div>
      <div>Run {c.runtime_min} min · E margin {c.energy_margin}×</div>
      <div>Sys η {c.system_eff_avg ? `${(c.system_eff_avg * 100).toFixed(1)}%` : "—"}</div>
    </div>
  );
}

/** Compact swatch legend rendered outside the chart's plotting area. */
function ChartLegend({
  items,
  colorFor,
}: {
  items: string[];
  colorFor: ArchColor;
}) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 14px",
        marginTop: 10,
        paddingTop: 6,
        borderTop: "1px solid var(--border)",
        fontSize: 11,
        lineHeight: 1.4,
      }}
    >
      {items.map((name) => (
        <span
          key={name}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 2,
              background: colorFor(name),
              flexShrink: 0,
            }}
          />
          <span>{name}</span>
        </span>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  children,
  xAxisLabel,
  legend,
  height = 280,
  tip,
}: {
  title: string;
  children: React.ReactNode;
  xAxisLabel?: string;
  legend?: React.ReactNode;
  height?: number;
  tip?: string;
}) {
  return (
    <div className="chart-card">
      <h3 className="chart-title" style={{ display: "inline-flex", alignItems: "center" }}>
        {title}
        {tip && <InfoTip text={tip} />}
      </h3>
      <div style={{ width: "100%", height }}>{children}</div>
      {xAxisLabel && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "var(--muted)",
            marginTop: -4,
          }}
        >
          {xAxisLabel}
        </div>
      )}
      {legend}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div
      className="empty-state"
      style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {message}
    </div>
  );
}

export function RuntimeMassChart({
  configs,
  colorFor,
  selectedKeys,
}: {
  configs: ConfigResult[];
  colorFor: ArchColor;
  selectedKeys: Set<string>;
}) {
  if (configs.length === 0) {
    return (
      <ChartCard title="Runtime vs pack mass">
        <EmptyChart message="No feasible configs to plot." />
      </ChartCard>
    );
  }
  const grouped = groupByArch(configs);
  const archs = Array.from(grouped.keys());
  return (
    <ChartCard
      title="Runtime vs pack mass"
      tip="Mission runtime (pack usable Wh ÷ average battery power) plotted against total pack mass for every feasible config. Lower-right means longer runtime per kg."
      xAxisLabel="Pack mass (kg)"
      legend={<ChartLegend items={archs} colorFor={colorFor} />}
    >
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="pack_mass_kg"
            name="Mass (kg)"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="runtime_min"
            name="Runtime (min)"
            tick={{ fontSize: 11 }}
            label={{ value: "Runtime (min)", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <ZAxis range={[40, 60]} />
          <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          {buildScatterLayers(configs, selectedKeys, colorFor)}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CostEnergyChart({
  configs,
  maxEnergyMargin,
  colorFor,
  selectedKeys,
}: {
  configs: ConfigResult[];
  maxEnergyMargin: number | null;
  colorFor: ArchColor;
  selectedKeys: Set<string>;
}) {
  if (configs.length === 0) {
    return (
      <ChartCard title="Cost vs energy margin">
        <EmptyChart message="No feasible configs to plot." />
      </ChartCard>
    );
  }
  const grouped = groupByArch(configs);
  const archs = Array.from(grouped.keys());
  return (
    <ChartCard
      title="Cost vs energy margin"
      tip="Pack BOM cost vs how much spare energy each config carries. Red dashed line = energy margin 1.0 (just enough); orange dashed = max energy margin (oversized cutoff)."
      xAxisLabel="Pack cost ($)"
      legend={<ChartLegend items={archs} colorFor={colorFor} />}
    >
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="pack_cost_usd"
            name="Cost ($)"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="energy_margin"
            name="Energy margin"
            tick={{ fontSize: 11 }}
            label={{ value: "Energy margin (×)", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          <ReferenceLine y={1.0} stroke="#b91c1c" strokeDasharray="4 4" />
          {maxEnergyMargin != null && (
            <ReferenceLine y={maxEnergyMargin} stroke="#b45309" strokeDasharray="4 4" />
          )}
          {buildScatterLayers(configs, selectedKeys, colorFor)}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function EfficiencyChart({
  configs,
  colorFor,
  selectedKeys,
}: {
  configs: ConfigResult[];
  colorFor: ArchColor;
  selectedKeys: Set<string>;
}) {
  if (configs.length === 0) {
    return (
      <ChartCard title="System efficiency vs mass">
        <EmptyChart message="No feasible configs to plot." />
      </ChartCard>
    );
  }
  const data = configs
    .filter((c) => c.system_eff_avg != null && c.pack_mass_kg != null)
    .map((c) => ({ ...c, eff_pct: (c.system_eff_avg as number) * 100 }));
  const grouped = new Map<string, typeof data>();
  for (const c of data) {
    if (!grouped.has(c.architecture)) grouped.set(c.architecture, []);
    grouped.get(c.architecture)!.push(c);
  }
  const archs = Array.from(grouped.keys());
  return (
    <ChartCard
      title="System efficiency vs mass"
      tip="Average system efficiency = useful load ÷ (useful load + IR loss + converter loss) at the mission average load. Pack mass on the x-axis lets you see efficiency-per-kg trade-offs."
      xAxisLabel="Pack mass (kg)"
      legend={<ChartLegend items={archs} colorFor={colorFor} />}
    >
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="pack_mass_kg"
            name="Mass (kg)"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="eff_pct"
            name="Sys η (%)"
            tick={{ fontSize: 11 }}
            domain={["auto", "auto"]}
            label={{ value: "System η (%)", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          {buildScatterLayers(data, selectedKeys, colorFor)}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ThermalRiseChart({
  traces,
  selectedCount,
  colorFor: _colorFor,
  height = 480,
  missionTimeHours,
}: {
  traces: ThermalTrace[];
  /** How many configs the user has currently selected — used only to
   *  put a hint in the chart title. The traces array itself is already
   *  built upstream from the selection. */
  selectedCount: number;
  colorFor: ArchColor;
  height?: number;
  missionTimeHours: number;
}) {
  // colorFor is intentionally unused here — thermal lines get unique
  // per-line colors via buildUniqueColorMap below so multiple traces
  // under the same architecture stay distinguishable.
  void _colorFor;

  const valid = traces.filter((t) => t.points.length > 0);

  const titleSuffix =
    selectedCount > 1 ? ` — ${selectedCount} selected` : "";
  const title = `Thermal rise over mission (adiabatic)${titleSuffix}`;

  if (valid.length === 0) {
    return (
      <ChartCard title={title} height={height}>
        <EmptyChart message="No thermal traces available." />
      </ChartCard>
    );
  }

  const missionMinutes = Math.max(missionTimeHours * 60, 0.001);

  const keyFor = (t: ThermalTrace) => `${t.cell} ${t.S}S${t.P}P (${t.architecture})`;

  // Each trace gets its own unique color, since multiple traces can share
  // the same architecture (e.g. lightest/cheapest/tightest key picks all
  // under "48V regulated bus"). Coloring by architecture alone would make
  // those lines indistinguishable.
  const traceColorMap = buildUniqueColorMap(valid.map(keyFor));
  const lineColorFor = (t: ThermalTrace) => traceColorMap.get(keyFor(t)) ?? "#888";

  const xs = new Set<number>();
  for (const t of valid) for (const p of t.points) xs.add(p.t_min);
  const xList = Array.from(xs).sort((a, b) => a - b);

  const lookup = new Map<string, Map<number, number>>();
  for (const t of valid) {
    const m = new Map<number, number>();
    for (const p of t.points) m.set(p.t_min, p.temp_c);
    lookup.set(keyFor(t), m);
  }

  const data = xList.map((x) => {
    const row: Record<string, number> = { t_min: x };
    for (const [key, m] of lookup.entries()) {
      const v = m.get(x);
      if (v !== undefined) row[key] = v;
    }
    return row;
  });

  // One swatch per drawn trace, with the matching line color.
  const legendItems = valid.map((t) => ({
    key: keyFor(t),
    color: lineColorFor(t),
  }));

  return (
    <ChartCard
      title={title}
      tip="Adiabatic temperature rise: ambient + (IR loss × time) ÷ (mass × cp). Assumes no convection or radiation, so it's a worst-case upper bound. Reference lines mark 40, 60 (max operating), and 70 °C."
      height={height}
      xAxisLabel="Mission time (min)"
      legend={
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 14px",
            marginTop: 10,
            paddingTop: 6,
            borderTop: "1px solid var(--border)",
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          {legendItems.map((it) => (
            <span
              key={it.key}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 2,
                  background: it.color,
                  flexShrink: 0,
                }}
              />
              <span>{it.key}</span>
            </span>
          ))}
        </div>
      }
    >
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="t_min"
            domain={[0, missionMinutes]}
            allowDecimals={false}
            tickCount={Math.max(2, Math.min(11, Math.round(missionMinutes) + 1))}
            tickFormatter={(v: number) => `${Math.round(v)}`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            domain={["auto", "auto"]}
            label={{ value: "Pack temp (°C)", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip />
          <ReferenceLine y={40} stroke="#a16207" strokeDasharray="4 4" label={{ value: "40 °C", fontSize: 10, fill: "#a16207", position: "insideTopRight" }} />
          <ReferenceLine y={60} stroke="#b45309" strokeDasharray="4 4" label={{ value: "Max operating (60 °C)", fontSize: 10, fill: "#b45309", position: "insideTopRight" }} />
          <ReferenceLine y={70} stroke="#7f1d1d" strokeDasharray="4 4" label={{ value: "70 °C", fontSize: 10, fill: "#7f1d1d", position: "insideTopRight" }} />
          {valid.map((t) => {
            const key = keyFor(t);
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={lineColorFor(t)}
                strokeWidth={2}
                dot={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ChartsSectionImpl({
  result,
  selectedConfigs,
  selectedKeys,
  filteredConfigs,
  feasibleFiltered,
  filterActive,
  colorFor,
}: {
  result: ModelResult;
  /** Resolved configs for the user's current selection set. */
  selectedConfigs: ConfigResult[];
  /** Same selection, but as a key set — used to highlight points in
   *  the scatter charts without re-deriving keys for every render. */
  selectedKeys: Set<string>;
  filteredConfigs: ConfigResult[];
  /** Feasible configs filtered by the table's arch/cell/search.
   *  Always plotted on the three scatter charts so the charts mirror
   *  whatever the user has filtered to in the table. */
  feasibleFiltered: ConfigResult[];
  filterActive: boolean;
  colorFor: (arch: string) => string;
}) {
  // Thermal-chart trace source. In priority order:
  //   1. Selected configs are always plotted.
  //   2. If a filter is active, plot every filtered config (capped).
  //   3. Otherwise, plot the model's precomputed key picks.
  // De-dup by (arch, cell, S, P) so a selected config that's also in
  // the filter set doesn't draw twice.
  const thermalTraces = useMemo<ThermalTrace[]>(() => {
    const thermal = result.inputs.thermal;
    const mt = result.inputs.mission_time_hours;
    const computed = (c: ConfigResult) => computeThermalTrace(c, thermal, mt);

    const out: ThermalTrace[] = [];
    const seen = new Set<string>();
    const push = (t: ThermalTrace) => {
      const k = `${t.architecture}|${t.cell}|${t.S}|${t.P}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(t);
    };

    // 1. Selected always
    for (const c of selectedConfigs) push(computed(c));

    // 2/3. Filtered set or default key picks
    if (filterActive) {
      const sorted = filteredConfigs.slice().sort((a, b) => {
        const am = a.pack_mass_kg ?? Number.POSITIVE_INFINITY;
        const bm = b.pack_mass_kg ?? Number.POSITIVE_INFINITY;
        return am - bm;
      });
      for (const c of sorted.slice(0, MAX_THERMAL_LINES)) push(computed(c));
    } else if (selectedConfigs.length === 0) {
      for (const t of result.thermal_traces) push(t);
    }

    return out;
  }, [result, filteredConfigs, filterActive, selectedConfigs]);

  return (
    <div className="charts-section">
      <ThermalRiseChart
        traces={thermalTraces}
        selectedCount={selectedConfigs.length}
        colorFor={colorFor}
        missionTimeHours={result.inputs.mission_time_hours}
      />
      <div className="charts-grid">
        <RuntimeMassChart
          configs={feasibleFiltered}
          colorFor={colorFor}
          selectedKeys={selectedKeys}
        />
        <CostEnergyChart
          configs={feasibleFiltered}
          maxEnergyMargin={result.inputs.max_energy_margin}
          colorFor={colorFor}
          selectedKeys={selectedKeys}
        />
        <EfficiencyChart
          configs={feasibleFiltered}
          colorFor={colorFor}
          selectedKeys={selectedKeys}
        />
      </div>
    </div>
  );
}

// Memoised at the section boundary so unrelated sidebar state changes
// (collapsing a section, editing an input) don't trigger a full
// Recharts re-render of the results panel.
export const ChartsSection = memo(ChartsSectionImpl);
