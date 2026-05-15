# Battery Pack Configurator

A sizing tool. You give it a library of cells, a set of bus architectures, and mission parameters, and it tells you which pack configurations work and which don't.

Every configuration has four parts: an architecture, a cell, a series count S (which sets the pack voltage), and a parallel count P (which sets the capacity and per-cell current). The tool runs through every legal combination of those four, computes the relevant numbers for each, checks them against the set limits on current, energy, voltage, mass, and cost, and marks the result feasible or rejected.

## Inputs

Everything lives in the sidebar and persists between sessions through `localStorage`.

**Mission.** How long the mission runs, how much of the battery's capacity you plan to use, and a multiplier that scales raw cell mass up to a full pack mass to account for the casing, wiring, BMS, and so on.

**Loads.** Average and peak power for the cooling subsystem and for everything else. The averages set the total energy the pack needs to deliver. The peaks set the worst current any single cell will see.

**Constraints.** A minimum current margin (cell continuous-current rating over peak per-cell draw), a minimum and maximum energy margin (usable pack energy over what the mission actually needs), and hard caps on pack mass, cost, and number of parallel strings.

**Architectures.** Each entry describes one bus topology: a name, a target bus voltage, the nominal and operating pack voltage ranges, and a converter type. The `buck`, `boost`, and `buck_boost` types pull an efficiency curve from `converter_curves`. The `direct` type skips the converter.

**Cells.** Each entry is a cell spec with chemistry, form factor, voltage range, capacity, continuous current, internal resistance, mass, cost, and optional metadata. The library imports and exports as CSV.

**Thermal.** Ambient temperature, the pack's specific heat capacity, and how many samples to draw for the temperature trace.

## The model

For each `(architecture, cell, S, P)`, the model runs these steps:

1. Pack voltage at minimum, nominal, and maximum state of charge.
2. Per-cell current at average and peak load.
3. Converter efficiency at the mission operating points, interpolated from the architecture's curve.
4. Power drawn from the cells (terminal load plus converter loss).
5. I²R loss inside the cells at average and peak load.
6. System efficiency at average load: `useful_load / (useful_load + ir_loss + converter_loss)`.
7. Pack usable energy: `S × P × cell_Ah × cell_v_nom × usable_soc × realized_capacity_factor`.
8. Mission chemical energy required (terminal energy plus IR losses, over the full mission).
9. Energy margin, reserve percent, and estimated runtime.
10. Pack mass (`cells × overhead`) and pack BOM cost (`cells × cell price`).

A configuration passes when every constraint is met. Anything else lands in the rejected list with one or more failure tags: voltage out of range, current margin too tight, energy margin below the minimum or above the maximum, mass over cap, cost over cap, or converter out of range.

Feasible configurations also get an adiabatic temperature trace, computed as `T(t) = T_ambient + (P_heat × t) / (m × c_p)`, where `P_heat` is the average IR loss, `m` is the pack mass, and `c_p` is the configured specific heat. There's no convection or radiation in the model, so the trace is a worst-case upper bound, not a steady-state prediction. The chart marks 40 °C, 60 °C, and 70 °C for reference.

## Results

The results panel has five regions, arranged top to bottom from broad to specific.

**Summary cards.** Feasible count, rejected count, total average load, total peak load.

**Architecture picks.** One card per architecture. Each one shows the lightest, cheapest, least oversized, and most efficient feasible configuration for that architecture. If no configurations are feasible, the card falls back to the rejected ones closest to passing, sorted by number of failures and then by margin.

**Table.** Every evaluated configuration. Tabs switch between feasible and rejected. Every numeric column sorts. The architecture, cell, and substring filters narrow the table and the three scatter charts below it. Click a row to select it. Shift-click extends a range from the previous anchor. Ctrl or Cmd toggles individual rows. Clicking the only selected row clears the selection.

**Details.** Between the table and the charts. With one row selected, it lists every computed field for that configuration, with a one-line tooltip on each. With more than one row selected, it switches to a comparison view that lines up mass, cost, runtime, system efficiency, and energy margin side by side.

**Charts.** A thermal-rise plot on top, then three scatter plots: runtime against pack mass, cost against energy margin, and system efficiency against pack mass. The scatter plots use the same architecture and cell filters as the table. Selected configurations are highlighted in every chart, and unselected points dim when a selection is active.

## Data flow

The model runs in a Web Worker, so the UI never blocks. The worker loads `pyodide.mjs` from JSDelivr once per page, fetches `public/python/battery_model.py` and `model_api.py`, writes them into the Pyodide filesystem, and adds them to `sys.path`. Each run is a single `pyodide.runPython("run_model_json(__input_json)")` call. Python returns a JSON-safe dictionary, which the main thread parses into the TypeScript types in `src/lib/modelTypes.ts`. Those types mirror the Python output exactly.

Filtering, sorting, selection, and chart rendering all happen in the browser, off whatever the last run produced. Editing a sidebar input doesn't recompute anything. The only thing that triggers a new model run is clicking **Run model**.

## Limitations

This is a steady-state sizing tool. It doesn't simulate transients beyond the average and peak operating points. It doesn't couple cells thermally. It doesn't account for inverter or BMS standby losses beyond what the converter curve already captures. Cell aging isn't modelled, and the realized capacity factor is the only knob for capacity derating. The thermal trace is adiabatic, so any reasonable cooling design will run well below what the chart shows.

The sweep size is bounded by `len(architectures) × len(cells) × max_series_range × max_parallel`. The default workload is a few thousand configurations and finishes in under a second.

## Stack

Vite · React · TypeScript · Recharts · Pyodide 0.26 · GitHub Pages

## Local development

```bash
npm install
npm run dev                       # http://localhost:5173
npm run build                     # production build → dist/
python scripts/check_model.py     # smoke-test the model
```

Requires Node 18+ and (for the smoke test) Python 3.10+.

## Layout

```
public/python/
  battery_model.py      pure-stdlib model
  model_api.py          JSON wrapper called from Pyodide

scripts/
  check_model.py        CLI smoke test, also runs in CI

src/
  App.tsx               shell, selection / filter state
  components/           sidebar, table, picks, charts, modals
  lib/                  modelTypes, workerClient, formatting, storage
  workers/              Pyodide worker

.github/workflows/deploy.yml    builds and deploys on push to main
```

## Editing the model

`battery_model.py` is the main model. If you rename a returned field, update `src/lib/modelTypes.ts` to match. Standard library only. No `numpy`/`pandas` since they multiply Pyodide startup time.

## Deployment

Push to `main`. The workflow at `.github/workflows/deploy.yml` builds, runs the Python smoke test, and publishes to GitHub Pages. Enable Pages in the repo settings (source: **GitHub Actions**) before the first push.

## Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | TypeScript + Vite production build |
| `npm run preview` | Serve `dist/` locally |
| `npm run check-model` | Run the Python smoke test |
