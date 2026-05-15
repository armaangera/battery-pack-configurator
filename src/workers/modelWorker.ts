/// <reference lib="webworker" />
/**
 * Pyodide model worker.
 *
 * - Loads Pyodide via dynamic import() from the CDN .mjs file (ES module workers
 *   do not support importScripts).
 * - Fetches battery_model.py and model_api.py from the site (public/python/).
 * - Writes them into the Pyodide filesystem and adds them to sys.path.
 * - Exposes init / getDefaults / runModel via postMessage.
 */

import type { ModelInputs, ModelResult } from "../lib/modelTypes";
import type { PyodideInterface } from "pyodide";

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full`;

// Vite injects import.meta.env.BASE_URL at build time.
// Used to resolve public/python/ from any GitHub Pages base path.
const APP_BASE: string = import.meta.env.BASE_URL ?? "/";

export type WorkerRequest =
  | { id: string; type: "init" }
  | { id: string; type: "getDefaults" }
  | { id: string; type: "runModel"; payload: ModelInputs };

export type WorkerResponse =
  | { id: string; type: "ready" }
  | { id: string; type: "defaults"; payload: ModelInputs }
  | { id: string; type: "result"; payload: ModelResult }
  | { id: string; type: "error"; error: string };

let pyodide: PyodideInterface | null = null;
let initPromise: Promise<void> | null = null;

function pythonUrl(filename: string): string {
  // Combine origin + Vite base + python/ so this works under any Pages path.
  const base = APP_BASE.endsWith("/") ? APP_BASE : APP_BASE + "/";
  return `${self.location.origin}${base}python/${filename}`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  return res.text();
}

async function ensureInit(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // ES module workers cannot use importScripts; use dynamic import() instead.
    // @vite-ignore tells Vite not to try to bundle this external URL.
    const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_CDN}/pyodide.mjs`);
    const py = await loadPyodide({ indexURL: `${PYODIDE_CDN}/` });
    pyodide = py;

    // Stage Python files in the Pyodide FS
    py.FS.mkdirTree("/home/pyodide/model");

    const [modelCode, apiCode] = await Promise.all([
      fetchText(pythonUrl("battery_model.py")),
      fetchText(pythonUrl("model_api.py")),
    ]);

    py.FS.writeFile("/home/pyodide/model/battery_model.py", modelCode);
    py.FS.writeFile("/home/pyodide/model/model_api.py", apiCode);

    py.runPython(`
import sys
sys.path.insert(0, "/home/pyodide/model")
from model_api import get_default_inputs_json, run_model_json
`);
  })();

  return initPromise;
}

function post(msg: WorkerResponse) {
  (self as DedicatedWorkerGlobalScope).postMessage(msg);
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === "init") {
      await ensureInit();
      post({ id: msg.id, type: "ready" });
      return;
    }

    if (msg.type === "getDefaults") {
      await ensureInit();
      const jsonStr = pyodide!.runPython("get_default_inputs_json()") as string;
      const payload = JSON.parse(jsonStr) as ModelInputs;
      post({ id: msg.id, type: "defaults", payload });
      return;
    }

    if (msg.type === "runModel") {
      await ensureInit();
      const inputJson = JSON.stringify(msg.payload);
      // Bind input on the Python side to avoid string escaping issues
      pyodide!.globals.set("__input_json", inputJson);
      const resultJson = pyodide!.runPython("run_model_json(__input_json)") as string;
      const payload = JSON.parse(resultJson) as ModelResult;
      post({ id: msg.id, type: "result", payload });
      return;
    }

    post({
      id: (msg as { id: string }).id ?? "unknown",
      type: "error",
      error: `Unknown message type: ${(msg as { type: string }).type}`,
    });
  } catch (err) {
    const error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    post({ id: msg.id, type: "error", error });
  }
});
