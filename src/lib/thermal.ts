import type {
  ConfigResult,
  ThermalInputs,
  ThermalTrace,
  ThermalTracePoint,
} from "./modelTypes";


/**
 * TS port of `pack_temperature_trace` in battery_model.py. Lets us
 * generate a thermal trace for any config on the fly — including
 * rejected configs and selections that weren't part of the precomputed
 * key-pick set returned by the Python model.
 */
export function computeThermalTrace(
  c: ConfigResult,
  thermal: ThermalInputs,
  missionTimeHours: number,
): ThermalTrace {
  const ambient = thermal.ambient_temp_c;
  const cp = thermal.pack_specific_heat_j_per_kg_k;
  const n = Math.max(1, Math.floor(thermal.num_time_points));
  const missionSeconds = missionTimeHours * 3600;

  const massKg = c.pack_mass_kg;
  const pHeatW = c.ir_loss_avg;
  const label = `${c.cell} ${c.S}S${c.P}P`;

  const base = {
    architecture: c.architecture,
    cell: c.cell,
    S: c.S,
    P: c.P,
    label,
  };

  const invalid =
    massKg == null ||
    !Number.isFinite(massKg) ||
    massKg <= 0 ||
    !Number.isFinite(cp) ||
    cp <= 0 ||
    pHeatW == null ||
    !Number.isFinite(pHeatW);

  if (invalid) {
    return { ...base, end_temp_c: null, temp_rise_c: null, points: [] };
  }

  const points: ThermalTracePoint[] = [];
  for (let i = 0; i < n; i++) {
    const frac = n > 1 ? i / (n - 1) : 1;
    const tS = frac * missionSeconds;
    const tMin = tS / 60;
    const tempC = ambient + ((pHeatW as number) / ((massKg as number) * cp)) * tS;
    points.push({
      t_min: Math.round(tMin * 1000) / 1000,
      temp_c: Math.round(tempC * 1000) / 1000,
    });
  }

  const endTemp = points.length > 0 ? points[points.length - 1].temp_c : null;
  return {
    ...base,
    end_temp_c: endTemp,
    temp_rise_c:
      endTemp != null ? Math.round((endTemp - ambient) * 1000) / 1000 : null,
    points,
  };
}

