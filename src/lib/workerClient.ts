import type { ModelInputs, ModelResult } from "./modelTypes";
import type { WorkerRequest, WorkerResponse } from "../workers/modelWorker";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

// Distributive Omit so each union member keeps its own payload shape
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type WorkerRequestBody = DistributiveOmit<WorkerRequest, "id">;

export class ModelWorkerClient {
  private worker: Worker;
  private pending = new Map<string, Pending>();
  private idCounter = 0;

  constructor() {
    this.worker = new Worker(new URL("../workers/modelWorker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.type === "error") {
        p.reject(new Error(msg.error));
      } else if (msg.type === "ready") {
        p.resolve(undefined);
      } else if (msg.type === "defaults") {
        p.resolve(msg.payload);
      } else if (msg.type === "result") {
        p.resolve(msg.payload);
      } else {
        p.reject(new Error(`Unknown response: ${JSON.stringify(msg)}`));
      }
    });

    this.worker.addEventListener("error", (e) => {
      const message = e.message || "Worker crashed";
      for (const [, p] of this.pending) {
        p.reject(new Error(message));
      }
      this.pending.clear();
    });
  }

  private send<T>(req: WorkerRequestBody): Promise<T> {
    const id = `m${++this.idCounter}`;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.worker.postMessage({ id, ...req } as WorkerRequest);
    });
  }

  init(): Promise<void> {
    return this.send<void>({ type: "init" });
  }

  getDefaults(): Promise<ModelInputs> {
    return this.send<ModelInputs>({ type: "getDefaults" });
  }

  runModel(inputs: ModelInputs): Promise<ModelResult> {
    return this.send<ModelResult>({ type: "runModel", payload: inputs });
  }

  terminate() {
    this.worker.terminate();
  }
}
