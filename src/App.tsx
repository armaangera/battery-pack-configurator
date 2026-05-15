import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { TooltipsContext } from "./lib/tooltipsContext";
import { Sidebar, type SectionKey } from "./components/Sidebar";
import { SummaryCards } from "./components/SummaryCards";
import { ArchitecturePicks } from "./components/ArchitecturePicks";
import {
  ConfigTable,
  EMPTY_FILTERS,
  applyFilters,
  isFilterActive,
  type ConfigTableFilters,
} from "./components/ConfigTable";
import { ConfigDetails } from "./components/ConfigDetails";
import { ChartsSection } from "./components/Charts";
import { ViewportWarning } from "./components/ViewportWarning";
import { buildArchColorMap } from "./lib/colors";
import { configsByKeys } from "./lib/configKey";
import { ModelWorkerClient } from "./lib/workerClient";
import type {
  ArchitectureSpec,
  CellSpec,
  ConfigResult,
  ModelInputs,
  ModelResult,
  ModelStatus,
} from "./lib/modelTypes";
import { configsToCsv, downloadTextFile } from "./lib/csvExport";
import {
  loadCells,
  loadArchitectures,
  loadScalars,
  loadSelectedArchs,
  loadSelectedCells,
  loadUI,
  saveArchitectures,
  saveCells,
  saveScalars,
  saveSelectedArchs,
  saveSelectedCells,
  saveUI,
  clearAll,
  type PersistedScalars,
  type PersistedUI,
} from "./lib/storage";
import { hasAny, validateArchitecture, validateCell } from "./lib/validation";

type Tab = "feasible" | "rejected";

const DEFAULT_SECTIONS_OPEN: Record<SectionKey, boolean> = {
  mission: true,
  loads: true,
  constraints: true,
  architectures: true,
  cells: true,
  thermal: false,
};

function scalarsFromInputs(inputs: ModelInputs): PersistedScalars {
  return {
    mission_time_hours: inputs.mission_time_hours,
    usable_soc_fraction: inputs.usable_soc_fraction,
    min_current_margin: inputs.min_current_margin,
    min_energy_margin: inputs.min_energy_margin,
    max_energy_margin: inputs.max_energy_margin,
    max_pack_mass_kg: inputs.max_pack_mass_kg,
    max_pack_cost_usd: inputs.max_pack_cost_usd,
    max_parallel: inputs.max_parallel,
    top_n: inputs.top_n,
    pack_mass_overhead_factor: inputs.pack_mass_overhead_factor,
    loads: inputs.loads,
    thermal: inputs.thermal,
  };
}

function applyScalars(inputs: ModelInputs, s: PersistedScalars): ModelInputs {
  return { ...inputs, ...s };
}

export default function App() {
  const [status, setStatus] = useState<ModelStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // Immutable copy of defaults from Python
  const [defaults, setDefaults] = useState<ModelInputs | null>(null);

  // Editable state
  const [inputs, setInputs] = useState<ModelInputs | null>(null);
  const [cells, setCells] = useState<CellSpec[]>([]);
  const [architectures, setArchitectures] = useState<ArchitectureSpec[]>([]);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectedArchs, setSelectedArchs] = useState<Set<string>>(new Set());

  // Results
  const [result, setResult] = useState<ModelResult | null>(null);
  // Selection is a set of config keys to support multi-select via
  // Ctrl/Cmd-click and Shift-click range select. `anchorKey` is the
  // most recently clicked row — Shift+click ranges back to it.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("feasible");
  const [filters, setFilters] = useState<ConfigTableFilters>(EMPTY_FILTERS);

  // UI state (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sectionsOpen, setSectionsOpen] =
    useState<Record<SectionKey, boolean>>(DEFAULT_SECTIONS_OPEN);
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);

  const clientRef = useRef<ModelWorkerClient | null>(null);
  const hydratedRef = useRef(false);

  // Boot Pyodide + load defaults + hydrate from localStorage
  useEffect(() => {
    const client = new ModelWorkerClient();
    clientRef.current = client;

    (async () => {
      try {
        await client.init();
        const d = await client.getDefaults();
        setDefaults(d);

        // Hydrate cells/archs/scalars from localStorage if present
        const persistedCells = loadCells();
        const persistedArchs = loadArchitectures();
        const persistedScalars = loadScalars();
        const persistedSelCells = loadSelectedCells();
        const persistedSelArchs = loadSelectedArchs();
        const persistedUI = loadUI();

        const initCells = persistedCells ?? d.cells;
        const initArchs = persistedArchs ?? d.architectures;
        const baseInputs: ModelInputs = persistedScalars
          ? applyScalars(d, persistedScalars)
          : d;
        // cells/archs in inputs are only used when sending to the model;
        // we filter them at run time from the editable lists.
        setInputs(baseInputs);
        setCells(initCells);
        setArchitectures(initArchs);

        if (persistedSelCells) {
          // Drop any persisted names that no longer exist
          const names = new Set(initCells.map((c) => c.name));
          setSelectedCells(new Set(persistedSelCells.filter((n) => names.has(n))));
        } else {
          setSelectedCells(new Set(initCells.map((c) => c.name)));
        }
        if (persistedSelArchs) {
          const names = new Set(initArchs.map((a) => a.name));
          setSelectedArchs(new Set(persistedSelArchs.filter((n) => names.has(n))));
        } else {
          setSelectedArchs(new Set(initArchs.map((a) => a.name)));
        }
        if (persistedUI) {
          setSidebarCollapsed(persistedUI.sidebarCollapsed);
          setSectionsOpen({ ...DEFAULT_SECTIONS_OPEN, ...persistedUI.sectionsOpen });
          if (typeof persistedUI.tooltipsEnabled === "boolean") {
            setTooltipsEnabled(persistedUI.tooltipsEnabled);
          }
        }

        hydratedRef.current = true;
        setStatus("ready");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStatus("error");
      }
    })();

    return () => client.terminate();
  }, []);

  // Persist on changes (debounced, only after initial hydration).
  // localStorage writes are synchronous JSON.stringify + setItem calls;
  // firing one on every keystroke in a number input was making the
  // sidebar feel laggy. The 250 ms debounce coalesces rapid edits while
  // staying short enough to feel instant on commit.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => saveCells(cells), 250);
    return () => clearTimeout(t);
  }, [cells]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => saveArchitectures(architectures), 250);
    return () => clearTimeout(t);
  }, [architectures]);

  useEffect(() => {
    if (!hydratedRef.current || !inputs) return;
    const t = setTimeout(() => saveScalars(scalarsFromInputs(inputs)), 250);
    return () => clearTimeout(t);
  }, [inputs]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => saveSelectedCells(Array.from(selectedCells)), 250);
    return () => clearTimeout(t);
  }, [selectedCells]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => saveSelectedArchs(Array.from(selectedArchs)), 250);
    return () => clearTimeout(t);
  }, [selectedArchs]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const ui: PersistedUI = { sidebarCollapsed, sectionsOpen, tooltipsEnabled };
    const t = setTimeout(() => saveUI(ui), 250);
    return () => clearTimeout(t);
  }, [sidebarCollapsed, sectionsOpen, tooltipsEnabled]);

  const knownCurves = useMemo(
    () => (defaults ? Object.keys(defaults.converter_curves) : []),
    [defaults],
  );

  // Validation: only configs selected for the run must be valid; allow the user
  // to keep half-edited cells in their library, but block running until those
  // are fixed or deselected.
  const validationMessage = useMemo(() => {
    if (cells.length === 0) return "No cells defined. Add a cell or restore defaults.";
    if (architectures.length === 0) return "No architectures defined. Add one or restore defaults.";
    if (selectedCells.size === 0) return "Select at least one cell.";
    if (selectedArchs.size === 0) return "Select at least one architecture.";

    const badCells = cells
      .filter((c) => selectedCells.has(c.name) && hasAny(validateCell(c)))
      .map((c) => c.name || "(unnamed)");
    if (badCells.length > 0) {
      return `Selected cell(s) have invalid fields: ${badCells.join(", ")}`;
    }
    const badArchs = architectures
      .filter((a) => selectedArchs.has(a.name) && hasAny(validateArchitecture(a, knownCurves)))
      .map((a) => a.name || "(unnamed)");
    if (badArchs.length > 0) {
      return `Selected architecture(s) have invalid fields: ${badArchs.join(", ")}`;
    }
    return null;
  }, [cells, architectures, selectedCells, selectedArchs, knownCurves]);

  const canRun = status !== "loading" && status !== "error" && inputs !== null && validationMessage == null;

  const onRun = async () => {
    if (!clientRef.current || !inputs || !defaults || !canRun) return;
    setError(null);
    setStatus("running");

    const payload: ModelInputs = {
      ...inputs,
      cells: cells.filter((c) => selectedCells.has(c.name)),
      architectures: architectures.filter((a) => selectedArchs.has(a.name)),
      // Use the live converter curve table (still from defaults)
      converter_curves: defaults.converter_curves,
    };

    try {
      const res = await clientRef.current.runModel(payload);
      setResult(res);
      // Don't auto-pick anything — let the user choose.
      setSelectedKeys(new Set());
      setAnchorKey(null);
      setStatus("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("error");
    }
  };

  const onResetCellsToDefaults = () => {
    if (!defaults) return;
    setCells(defaults.cells);
    setSelectedCells(new Set(defaults.cells.map((c) => c.name)));
  };

  const onResetArchsToDefaults = () => {
    if (!defaults) return;
    setArchitectures(defaults.architectures);
    setSelectedArchs(new Set(defaults.architectures.map((a) => a.name)));
  };

  const onResetScalarsToDefaults = () => {
    if (!defaults || !inputs) return;
    setInputs({
      ...inputs,
      mission_time_hours: defaults.mission_time_hours,
      usable_soc_fraction: defaults.usable_soc_fraction,
      min_current_margin: defaults.min_current_margin,
      min_energy_margin: defaults.min_energy_margin,
      max_energy_margin: defaults.max_energy_margin,
      max_pack_mass_kg: defaults.max_pack_mass_kg,
      max_pack_cost_usd: defaults.max_pack_cost_usd,
      max_parallel: defaults.max_parallel,
      top_n: defaults.top_n,
      pack_mass_overhead_factor: defaults.pack_mass_overhead_factor,
      loads: defaults.loads,
      thermal: defaults.thermal,
    });
  };

  const onResetAll = () => {
    clearAll();
    onResetCellsToDefaults();
    onResetArchsToDefaults();
    onResetScalarsToDefaults();
    setSectionsOpen(DEFAULT_SECTIONS_OPEN);
    setSidebarCollapsed(false);
  };

  const visibleConfigs = useMemo(() => {
    if (!result) return [] as ConfigResult[];
    return tab === "feasible" ? result.feasible : result.rejected;
  }, [result, tab]);

  const filteredConfigs = useMemo(
    () => applyFilters(visibleConfigs, filters),
    [visibleConfigs, filters],
  );

  // The three scatter charts always plot feasible configs, but they
  // mirror the table's arch/cell filter so a user narrowing the table
  // sees only those points on the charts too.
  const feasibleFiltered = useMemo(
    () => (result ? applyFilters(result.feasible, filters) : []),
    [result, filters],
  );

  // Single shared arch → color map for the whole results panel
  // (picks, charts, thermal lines), so the same architecture always
  // gets the same color everywhere on screen.
  const colorFor = useMemo(() => {
    if (!result) return (_: string) => "#888";
    const names = new Set<string>();
    for (const c of result.feasible) names.add(c.architecture);
    for (const c of result.rejected) names.add(c.architecture);
    for (const t of result.thermal_traces) names.add(t.architecture);
    const map = buildArchColorMap(names);
    return (arch: string) => map.get(arch) ?? "#888";
  }, [result]);

  // Resolve the selected key set back to actual configs, looking through
  // both feasible and rejected. Stable order: feasible first, then
  // rejected, in the order they appear in the result.
  const selectedConfigs = useMemo(() => {
    if (!result || selectedKeys.size === 0) return [] as ConfigResult[];
    return configsByKeys([...result.feasible, ...result.rejected], selectedKeys);
  }, [result, selectedKeys]);

  // Reset filters when the tab changes — the available arch/cell sets
  // can differ between feasible and rejected.
  useEffect(() => {
    setFilters(EMPTY_FILTERS);
  }, [tab]);

  const onSelectionChange = (keys: Set<string>, anchor: string | null) => {
    setSelectedKeys(keys);
    setAnchorKey(anchor);
  };

  return (
    <TooltipsContext.Provider value={{ enabled: tooltipsEnabled }}>
    <ViewportWarning />
    <div className="app-shell">
      <Header
        status={status}
        tooltipsEnabled={tooltipsEnabled}
        onToggleTooltips={() => setTooltipsEnabled((v) => !v)}
      />
      <div className={`app-body ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {defaults && inputs ? (
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
            sectionsOpen={sectionsOpen}
            onToggleSection={(key) =>
              setSectionsOpen((o) => ({ ...o, [key]: !o[key] }))
            }
            inputs={inputs}
            setInputs={setInputs}
            cells={cells}
            setCells={setCells}
            selectedCells={selectedCells}
            setSelectedCells={setSelectedCells}
            architectures={architectures}
            setArchitectures={setArchitectures}
            selectedArchs={selectedArchs}
            setSelectedArchs={setSelectedArchs}
            knownCurves={knownCurves}
            onRun={onRun}
            onResetAll={onResetAll}
            onResetCellsToDefaults={onResetCellsToDefaults}
            onResetArchsToDefaults={onResetArchsToDefaults}
            onResetScalarsToDefaults={onResetScalarsToDefaults}
            canRun={canRun}
            isRunning={status === "running"}
            validationMessage={validationMessage}
          />
        ) : (
          <aside className="input-panel">
            <div className="card">
              <div className="card-title">Loading</div>
              <div className="muted">Booting Python in a Web Worker…</div>
            </div>
          </aside>
        )}

        <div className="results-panel">
          {error && <div className="error-box">{error}</div>}

          {!result && !error && (
            <div className="card empty-state">
              {status === "loading"
                ? "Loading Pyodide and the battery model…"
                : "Adjust inputs on the left, then click Run model."}
            </div>
          )}

          {result && (
            <>
              <SummaryCards result={result} />

              <ArchitecturePicks
                keyPicksByArchitecture={result.key_picks_by_architecture}
                colorFor={colorFor}
              />

              <div className="card">
                <div className="toolbar-row">
                  <div className="tabs" style={{ marginBottom: 0, borderBottom: "none" }}>
                    <button
                      className={`tab ${tab === "feasible" ? "active" : ""}`}
                      onClick={() => setTab("feasible")}
                    >
                      Feasible ({result.summary.feasible_count})
                    </button>
                    <button
                      className={`tab ${tab === "rejected" ? "active" : ""}`}
                      onClick={() => setTab("rejected")}
                    >
                      Rejected ({result.summary.rejected_count})
                    </button>
                  </div>
                  <div className="spacer" />
                  <button
                    className="btn"
                    onClick={() =>
                      downloadTextFile(
                        `battery-configs-${tab}.csv`,
                        configsToCsv(visibleConfigs),
                        "text/csv;charset=utf-8",
                      )
                    }
                  >
                    Export CSV
                  </button>
                </div>

                <ConfigTable
                  configs={visibleConfigs}
                  selectedKeys={selectedKeys}
                  anchorKey={anchorKey}
                  onSelectionChange={onSelectionChange}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>

              <ConfigDetails
                configs={selectedConfigs}
                colorFor={colorFor}
                onClear={() => onSelectionChange(new Set(), null)}
                onRemove={(key) => {
                  const next = new Set(selectedKeys);
                  next.delete(key);
                  onSelectionChange(next, anchorKey === key ? null : anchorKey);
                }}
              />

              <ChartsSection
                result={result}
                selectedConfigs={selectedConfigs}
                selectedKeys={selectedKeys}
                filteredConfigs={filteredConfigs}
                feasibleFiltered={feasibleFiltered}
                filterActive={isFilterActive(filters)}
                colorFor={colorFor}
              />
            </>
          )}
        </div>
      </div>
    </div>
    </TooltipsContext.Provider>
  );
}
