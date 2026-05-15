import type { ArchitectureSpec, CellSpec, LoadInputs, ThermalInputs } from "./modelTypes";

const PREFIX = "battery-config:";

/**
 * What we persist. Scalar config is stored separately from cells/architectures
 * so reset-to-defaults can target the right slice.
 */
export interface PersistedScalars {
  mission_time_hours: number;
  usable_soc_fraction: number;
  min_current_margin: number;
  min_energy_margin: number;
  max_energy_margin: number | null;
  max_pack_mass_kg: number;
  max_pack_cost_usd: number;
  max_parallel: number;
  top_n: number;
  pack_mass_overhead_factor: number;
  loads: LoadInputs;
  thermal: ThermalInputs;
}

export interface PersistedUI {
  sidebarCollapsed: boolean;
  sectionsOpen: Record<string, boolean>;
  tooltipsEnabled?: boolean;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Out of quota or unavailable — silently drop.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export const loadCells = (): CellSpec[] | null => read<CellSpec[]>("cells");
export const saveCells = (cells: CellSpec[]): void => write("cells", cells);
export const clearCells = (): void => remove("cells");

export const loadArchitectures = (): ArchitectureSpec[] | null =>
  read<ArchitectureSpec[]>("architectures");
export const saveArchitectures = (a: ArchitectureSpec[]): void => write("architectures", a);
export const clearArchitectures = (): void => remove("architectures");

export const loadScalars = (): PersistedScalars | null => read<PersistedScalars>("scalars");
export const saveScalars = (s: PersistedScalars): void => write("scalars", s);
export const clearScalars = (): void => remove("scalars");

export const loadSelectedCells = (): string[] | null => read<string[]>("selectedCells");
export const saveSelectedCells = (names: string[]): void => write("selectedCells", names);

export const loadSelectedArchs = (): string[] | null => read<string[]>("selectedArchs");
export const saveSelectedArchs = (names: string[]): void => write("selectedArchs", names);

export const loadUI = (): PersistedUI | null => read<PersistedUI>("ui");
export const saveUI = (ui: PersistedUI): void => write("ui", ui);

export function clearAll(): void {
  clearCells();
  clearArchitectures();
  clearScalars();
  remove("selectedCells");
  remove("selectedArchs");
  remove("ui");
}
