export type ConverterType = "buck" | "boost" | "buck_boost" | "direct";

export interface CellSpec {
  name: string;
  chemistry: string;
  form_factor: string;
  v_nom: number;
  v_max: number;
  v_min: number;
  capacity_ah: number;
  i_cont_a: number;
  r_int_model_ohm: number;
  mass_g: number;
  cost_usd: number;
  cycle_life_est?: string;
  source_quality?: string;
  realized_capacity_factor?: number;
  notes?: string;
}

export interface LoadInputs {
  cooling_avg_w: number;
  cooling_peak_w: number;
  other_avg_w: number;
  other_peak_w: number;
}

export interface ArchitectureSpec {
  name: string;
  pack_nom_min_v: number;
  pack_nom_max_v: number;
  pack_oper_min_v?: number;
  pack_oper_max_v?: number;
  target_bus_v: number | null;
  converter_type: ConverterType;
  buck_headroom_v?: number;
  efficiency_curve?: string;
  converter_overload_factor?: number;
}

export interface ThermalInputs {
  ambient_temp_c: number;
  pack_specific_heat_j_per_kg_k: number;
  num_time_points: number;
}

export interface ModelInputs {
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
  cells: CellSpec[];
  architectures: ArchitectureSpec[];
  converter_curves: Record<string, unknown>;
  thermal: ThermalInputs;
}

export interface ConfigResult {
  feasible: boolean;
  right_sized: boolean;
  reasons: string[];
  architecture: string;
  cell: string;
  S: number;
  P: number;
  v_pack_min: number | null;
  v_pack_nom: number | null;
  v_pack_max: number | null;
  v_pack_min_terminal_peak: number | null;
  i_cell_peak: number | null;
  i_cell_avg: number | null;
  current_margin: number | null;
  realized_capacity_factor: number;
  wh_pack_usable: number | null;
  wh_required: number | null;
  wh_required_chem: number | null;
  energy_margin: number | null;
  reserve_pct: number | null;
  runtime_min: number | null;
  p_batt_avg: number | null;
  p_batt_peak: number | null;
  ir_loss_avg: number | null;
  ir_loss_peak: number | null;
  conv_loss_avg: number | null;
  conv_loss_peak: number | null;
  system_eff_avg: number | null;
  converter_eff_avg: number | null;
  converter_eff_peak: number | null;
  converter_eff_worst_avg: number | null;
  converter_eff_worst_peak: number | null;
  pack_cells_mass_kg: number | null;
  pack_mass_kg: number | null;
  pack_cost_usd: number | null;
  wh_per_kg: number | null;
}

export interface ThermalTracePoint {
  t_min: number;
  temp_c: number;
}

export interface ThermalTrace {
  architecture: string;
  cell: string;
  S: number;
  P: number;
  label: string;
  end_temp_c: number | null;
  temp_rise_c: number | null;
  points: ThermalTracePoint[];
}

export interface PickEntry {
  label: string;
  config: ConfigResult;
}

export interface ArchitectureKeyPicks {
  has_feasible: boolean;
  picks: PickEntry[];
  closest_rejected: ConfigResult[];
}

export interface ModelResult {
  inputs: ModelInputs;
  summary: {
    feasible_count: number;
    rejected_count: number;
    total_avg_load_w: number;
    total_peak_load_w: number;
  };
  feasible: ConfigResult[];
  rejected: ConfigResult[];
  key_picks_by_architecture: Record<string, ArchitectureKeyPicks>;
  thermal_traces: ThermalTrace[];
}

export type ModelStatus = "loading" | "ready" | "running" | "error";
