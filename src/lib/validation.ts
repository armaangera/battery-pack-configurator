import type { ArchitectureSpec, CellSpec, ConverterType } from "./modelTypes";

export type FieldErrors = Record<string, string>;

const REQUIRED_CELL_NUM_FIELDS: Array<{ key: keyof CellSpec; label: string; min?: number }> = [
  { key: "v_nom", label: "Nominal voltage", min: 0 },
  { key: "v_max", label: "Max voltage", min: 0 },
  { key: "v_min", label: "Min voltage", min: 0 },
  { key: "capacity_ah", label: "Capacity (Ah)", min: 0 },
  { key: "i_cont_a", label: "Continuous current (A)", min: 0 },
  { key: "r_int_model_ohm", label: "Internal resistance (Ω)", min: 0 },
  { key: "mass_g", label: "Mass (g)", min: 0 },
  { key: "cost_usd", label: "Cost (USD)", min: 0 },
];

export function validateCell(cell: Partial<CellSpec>): FieldErrors {
  const errors: FieldErrors = {};
  if (!cell.name || !cell.name.trim()) errors.name = "Name is required";
  if (!cell.chemistry || !cell.chemistry.trim()) errors.chemistry = "Chemistry is required";
  if (!cell.form_factor || !cell.form_factor.trim()) errors.form_factor = "Form factor is required";

  for (const { key, label, min } of REQUIRED_CELL_NUM_FIELDS) {
    const v = cell[key];
    if (typeof v !== "number" || Number.isNaN(v)) {
      errors[key as string] = `${label} is required`;
    } else if (min !== undefined && v <= min) {
      errors[key as string] = `${label} must be > ${min}`;
    }
  }

  if (
    typeof cell.v_min === "number" &&
    typeof cell.v_nom === "number" &&
    typeof cell.v_max === "number"
  ) {
    if (!(cell.v_min < cell.v_nom && cell.v_nom < cell.v_max)) {
      errors.v_nom = "Require v_min < v_nom < v_max";
    }
  }

  if (cell.realized_capacity_factor !== undefined && cell.realized_capacity_factor !== null) {
    const r = cell.realized_capacity_factor;
    if (typeof r !== "number" || r <= 0 || r > 1.5) {
      errors.realized_capacity_factor = "Realized capacity factor must be between 0 and 1.5";
    }
  }

  return errors;
}

export const CONVERTER_TYPES: ConverterType[] = ["direct", "buck", "boost", "buck_boost"];

export function validateArchitecture(
  arch: Partial<ArchitectureSpec>,
  knownCurves: string[],
): FieldErrors {
  const errors: FieldErrors = {};
  if (!arch.name || !arch.name.trim()) errors.name = "Name is required";
  if (!arch.converter_type) errors.converter_type = "Converter type is required";

  const numFields: Array<{ key: keyof ArchitectureSpec; label: string }> = [
    { key: "pack_nom_min_v", label: "Pack nominal min V" },
    { key: "pack_nom_max_v", label: "Pack nominal max V" },
  ];
  for (const { key, label } of numFields) {
    const v = arch[key];
    if (typeof v !== "number" || Number.isNaN(v)) {
      errors[key as string] = `${label} is required`;
    } else if (v <= 0) {
      errors[key as string] = `${label} must be > 0`;
    }
  }

  if (
    typeof arch.pack_nom_min_v === "number" &&
    typeof arch.pack_nom_max_v === "number" &&
    arch.pack_nom_min_v >= arch.pack_nom_max_v
  ) {
    errors.pack_nom_max_v = "Max must be greater than min";
  }

  if (
    typeof arch.pack_oper_min_v === "number" &&
    typeof arch.pack_oper_max_v === "number" &&
    arch.pack_oper_min_v >= arch.pack_oper_max_v
  ) {
    errors.pack_oper_max_v = "Max must be greater than min";
  }

  // Converter-type-specific rules
  const ct = arch.converter_type;
  if (ct && ct !== "direct") {
    if (arch.target_bus_v == null || !Number.isFinite(arch.target_bus_v) || arch.target_bus_v <= 0) {
      errors.target_bus_v = "Target bus voltage is required for non-direct converters";
    }
    if (!arch.efficiency_curve) {
      errors.efficiency_curve = "Efficiency curve is required for non-direct converters";
    } else if (!knownCurves.includes(arch.efficiency_curve)) {
      errors.efficiency_curve = "Unknown efficiency curve";
    }
  }

  if (ct === "buck") {
    if (
      arch.buck_headroom_v !== undefined &&
      arch.buck_headroom_v !== null &&
      (typeof arch.buck_headroom_v !== "number" || arch.buck_headroom_v < 0)
    ) {
      errors.buck_headroom_v = "Buck headroom must be ≥ 0";
    }
  }

  if (
    arch.converter_overload_factor !== undefined &&
    arch.converter_overload_factor !== null
  ) {
    const f = arch.converter_overload_factor;
    if (typeof f !== "number" || f < 1) {
      errors.converter_overload_factor = "Overload factor must be ≥ 1";
    }
  }

  return errors;
}

export function hasAny(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export interface CollectionValidation {
  validCells: CellSpec[];
  invalidCellNames: string[];
  validArchs: ArchitectureSpec[];
  invalidArchNames: string[];
}

export function validateCollections(
  cells: CellSpec[],
  archs: ArchitectureSpec[],
  knownCurves: string[],
): CollectionValidation {
  const validCells: CellSpec[] = [];
  const invalidCellNames: string[] = [];
  for (const c of cells) {
    if (hasAny(validateCell(c))) invalidCellNames.push(c.name || "(unnamed)");
    else validCells.push(c);
  }

  const validArchs: ArchitectureSpec[] = [];
  const invalidArchNames: string[] = [];
  for (const a of archs) {
    if (hasAny(validateArchitecture(a, knownCurves))) invalidArchNames.push(a.name || "(unnamed)");
    else validArchs.push(a);
  }

  return { validCells, invalidCellNames, validArchs, invalidArchNames };
}
