# Battery Pack Configurator

A browser tool that sweeps low-voltage battery pack configurations and shows the trade-offs. The model is plain Python running in the browser through Pyodide — no backend.

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

## How it works

The React app sends inputs to a Web Worker that hosts Pyodide. Pyodide loads `public/python/battery_model.py` and `model_api.py`, runs `run_model(inputs)`, and returns a JSON dict. Filtering, sorting, and chart rendering all happen client-side; only clicking **Run model** re-invokes Python.

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
