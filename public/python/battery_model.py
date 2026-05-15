"""
Battery pack configuration model — browser-safe (Pyodide) version.

Standard library only. No pandas, numpy, matplotlib, or IPython.
Nothing runs at import time. All previously module-level constants live
inside the `inputs` dictionary so the model can be re-run with different
assumptions from the UI.
"""

from __future__ import annotations

import copy
import math
from bisect import bisect_left
from math import ceil, floor
from typing import Any, Dict, List, Optional, Tuple


# ============================================================
# DEFAULT DATA
# ============================================================

CELLS: List[Dict[str, Any]] = [
    {
        "name": "Samsung 50S",
        "chemistry": "NCA",
        "form_factor": "21700 cylindrical",
        "v_nom": 3.6,
        "v_max": 4.2,
        "v_min": 2.5,
        "capacity_ah": 5.0,
        "i_cont_a": 25.0,
        "r_int_model_ohm": 0.0130,
        "mass_g": 72.0,
        "cost_usd": 7.5,
        "cycle_life_est": "250-500",
        "source_quality": "Good",
        "notes": "Reference cell. Good balance of capacity and current. Safer in 2P for 24V if current margin is tight.",
    },
    {
        "name": "LG M50LT",
        "chemistry": "NCM",
        "form_factor": "21700 cylindrical",
        "v_nom": 3.6,
        "v_max": 4.2,
        "v_min": 2.5,
        "capacity_ah": 4.8,
        "i_cont_a": 14.4,
        "r_int_model_ohm": 0.0140,
        "mass_g": 67.5,
        "cost_usd": 5.0,
        "cycle_life_est": "600-1000",
        "source_quality": "Very High",
        "notes": "High cycle-life option. Fine for lower current, but 24V architecture likely needs 2P.",
    },
    {
        "name": "Vapcell F60",
        "chemistry": "Li-ion",
        "form_factor": "21700 cylindrical",
        "v_nom": 3.6,
        "v_max": 4.2,
        "v_min": 2.5,
        "capacity_ah": 6.0,
        "i_cont_a": 12.5,
        "r_int_model_ohm": 0.0160,
        "mass_g": 74.0,
        "cost_usd": 10.50,
        "cycle_life_est": "500+",
        "source_quality": "Good",
        "notes": "High-capacity cell. Current limit is tight for 48V 1P and not enough for 24V 1P.",
    },
    {
        "name": "Panasonic NCR21700A",
        "chemistry": "NCA",
        "form_factor": "21700 cylindrical",
        "v_nom": 3.6,
        "v_max": 4.2,
        "v_min": 2.5,
        "capacity_ah": 4.8,
        "i_cont_a": 15.0,
        "r_int_model_ohm": 0.0135,
        "mass_g": 65.0,
        "cost_usd": 11.0,
        "cycle_life_est": "500",
        "source_quality": "Good",
        "notes": "Similar role to LG M50LT. Solid energy cell, likely better in 2P for 24V.",
    },
    {
        "name": "Samsung 50E",
        "chemistry": "NCA",
        "form_factor": "21700 cylindrical",
        "v_nom": 3.6,
        "v_max": 4.2,
        "v_min": 2.5,
        "capacity_ah": 5.0,
        "i_cont_a": 9.8,
        "r_int_model_ohm": 0.0150,
        "mass_g": 69.0,
        "cost_usd": 7.0,
        "cycle_life_est": "500",
        "source_quality": "Very High",
        "notes": "Energy-focused cell. Not good for high-current 1P use. Likely needs 2P or 3P.",
    },
    {
        "name": "Molicel P45B",
        "chemistry": "Li-ion high-power",
        "form_factor": "21700 cylindrical",
        "v_nom": 3.6,
        "v_max": 4.2,
        "v_min": 2.5,
        "capacity_ah": 4.5,
        "i_cont_a": 45.0,
        "r_int_model_ohm": 0.0085,
        "mass_g": 70.0,
        "cost_usd": 10.0,
        "cycle_life_est": "500+",
        "source_quality": "Good",
        "notes": "High-power cell. Strong 24V 1P candidate, but lower capacity than 5Ah cells.",
    },
    {
        "name": "Molicel P50B",
        "chemistry": "Li-ion high-power",
        "form_factor": "21700 cylindrical",
        "v_nom": 3.6,
        "v_max": 4.2,
        "v_min": 2.5,
        "capacity_ah": 5.0,
        "i_cont_a": 60.0,
        "r_int_model_ohm": 0.0065,
        "mass_g": 70.0,
        "cost_usd": 10.0,
        "cycle_life_est": "1400",
        "source_quality": "Low",
        "notes": "Very strong current capability and capacity. Cycle-life claim should be verified.",
    },
    {
        "name": "A123 ANR26650M1B",
        "chemistry": "LiFePO4",
        "form_factor": "26650 cylindrical",
        "v_nom": 3.3,
        "v_max": 3.6,
        "v_min": 2.0,
        "capacity_ah": 2.5,
        "i_cont_a": 50.0,
        "r_int_model_ohm": 0.0060,
        "mass_g": 76.0,
        "cost_usd": 5.0,
        "cycle_life_est": "2000+",
        "source_quality": "Moderate",
        "notes": "Very safe and high-power, but low voltage and low capacity make the pack heavier/larger.",
    },
    {
        "name": "Melasta LPA542126",
        "chemistry": "LiPo",
        "form_factor": "pouch",
        "v_nom": 3.7,
        "v_max": 4.2,
        "v_min": 3.0,
        "capacity_ah": 6.0,
        "i_cont_a": 56.0,
        "r_int_model_ohm": 0.0030,
        "mass_g": 110.0,
        "cost_usd": 30.0,
        "cycle_life_est": "300-500",
        "source_quality": "Low",
        "notes": "High current and capacity, but packaging, protection, swelling, mounting, and sourcing need more care.",
    },
    {
        "name": "Molicel P28B",
        "chemistry": "Li-ion high-power",
        "form_factor": "18650 cylindrical",
        "v_nom": 3.6,
        "v_max": 4.2,
        "v_min": 2.5,
        "capacity_ah": 2.8,
        "i_cont_a": 40.0,
        "r_int_model_ohm": 0.0090,
        "mass_g": 48.0,
        "cost_usd": 2.9,
        "cycle_life_est": "250-350",
        "source_quality": "Good",
        "notes": "High-power 18650. Current is strong, but low capacity likely forces 2P for endurance.",
    },
    {
        "name": "BAK N21700CX-65E",
        "chemistry": "NCA high-energy",
        "form_factor": "21700 cylindrical",
        "v_nom": 3.65,
        "v_max": 4.20,
        "v_min": 2.50,
        "capacity_ah": 6.5,
        "i_cont_a": 20.0,
        "r_int_model_ohm": 0.0107,
        "mass_g": 73.6,
        "cost_usd": 9.0,
        "cycle_life_est": "300-500",
        "source_quality": "Good",
        "realized_capacity_factor": 0.97,
        "notes": "Ultra-high-capacity NCA, ~315 Wh/kg cell-level. Nameplate 25.4A continuous is temp-limited (Mooch); 20A is the sustainable rating. At 20A delivers ~17% more energy than 5Ah-class cells. Realized capacity derated 3% for typical 1-2C operation.",
    },
    {
        "name": "Amprius SA112",
        "chemistry": "Silicon-anode (SiCore)",
        "form_factor": "21700 cylindrical",
        "v_nom": 3.46,
        "v_max": 4.20,
        "v_min": 2.75,
        "capacity_ah": 6.5,
        "i_cont_a": 13.0,
        "r_int_model_ohm": 0.0200,
        "mass_g": 72.0,
        "cost_usd": 18.0,
        "cycle_life_est": "700+",
        "source_quality": "Moderate",
        "realized_capacity_factor": 0.92,
        "notes": "Silicon-anode (SiCore) high-energy cell, 308 Wh/kg cell-level, released 2025. Lower nominal voltage (3.46 V) and 2.75 V cutoff are silicon-anode characteristics. Realized capacity derated 8% for combined silicon-anode behavior and C-rate effects.",
    },
    {
        "name": "Vapcell F63",
        "chemistry": "Li-ion high-energy",
        "form_factor": "21700 cylindrical",
        "v_nom": 3.60,
        "v_max": 4.20,
        "v_min": 2.50,
        "capacity_ah": 6.25,
        "i_cont_a": 12.5,
        "r_int_model_ohm": 0.0200,
        "mass_g": 70.0,
        "cost_usd": 7.0,
        "cycle_life_est": "300-500",
        "source_quality": "Good",
        "realized_capacity_factor": 0.92,
        "notes": "High-capacity energy cell, NOT a power cell. Mooch test: capacity drops noticeably above ~3A. Higher DC IR (~20 mOhm) than power cells of comparable capacity. Realized capacity derated 8% for energy-cell behavior at typical mission C-rates.",
    },
]


LOADS: Dict[str, float] = {
    "cooling_avg_w": 250.0,
    "cooling_peak_w": 350.0,
    "other_avg_w": 60.0,
    "other_peak_w": 100.0,
}


ARCHITECTURES: List[Dict[str, Any]] = [
    {
        "name": "48V regulated bus",
        "pack_nom_min_v": 20.0,
        "pack_nom_max_v": 60.0,
        "pack_oper_min_v": 20.0,
        "pack_oper_max_v": 60.0,
        "target_bus_v": 48.0,
        "converter_type": "buck_boost",
        "efficiency_curve": "ti_lm5177_48v_buck_boost",
        "converter_overload_factor": 1.05,
    },
    {
        "name": "24V regulated bus",
        "pack_nom_min_v": 24.0,
        "pack_nom_max_v": 60.0,
        "pack_oper_min_v": 25.0,
        "pack_oper_max_v": 60.0,
        "target_bus_v": 24.0,
        "converter_type": "buck",
        "buck_headroom_v": 1.0,
        "efficiency_curve": "ti_lm51772_24v_buck_boost",
        "converter_overload_factor": 1.05,
    },
    {
        "name": "Direct battery bus",
        "pack_nom_min_v": 6.0,
        "pack_nom_max_v": 60.0,
        "pack_oper_min_v": 12.0,
        "pack_oper_max_v": 36.0,
        "target_bus_v": None,
        "converter_type": "direct",
    },
]


CONVERTER_CURVES: Dict[str, Dict[str, Any]] = {
    "ti_lm51772_24v_buck_boost": {
        "topology": "buck_boost",
        "v_out_nom": 24.0,
        "p_rated_w": 600.0,
        "v_in_grid": [12, 18, 24, 30, 36, 48, 60],
        "load_frac_grid": [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00],
        "eff": [
            [0.880, 0.920, 0.935, 0.940, 0.942, 0.940, 0.937, 0.933, 0.927, 0.918],
            [0.905, 0.940, 0.954, 0.960, 0.962, 0.961, 0.958, 0.954, 0.948, 0.940],
            [0.920, 0.953, 0.965, 0.970, 0.972, 0.971, 0.969, 0.966, 0.961, 0.953],
            [0.925, 0.957, 0.968, 0.972, 0.973, 0.972, 0.970, 0.967, 0.962, 0.954],
            [0.922, 0.954, 0.965, 0.969, 0.970, 0.969, 0.967, 0.964, 0.958, 0.950],
            [0.913, 0.945, 0.957, 0.962, 0.963, 0.962, 0.960, 0.956, 0.950, 0.942],
            [0.902, 0.935, 0.948, 0.953, 0.955, 0.954, 0.951, 0.947, 0.941, 0.933],
        ],
    },
    "ti_lm5177_48v_buck_boost": {
        "topology": "buck_boost",
        "v_out_nom": 48.0,
        "p_rated_w": 600.0,
        "v_in_grid": [12, 18, 24, 30, 36, 42, 48, 53, 58],
        "load_frac_grid": [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00],
        "eff": [
            [0.740, 0.790, 0.820, 0.835, 0.840, 0.840, 0.835, 0.825, 0.810, 0.795],
            [0.820, 0.860, 0.880, 0.888, 0.890, 0.889, 0.886, 0.877, 0.866, 0.852],
            [0.880, 0.910, 0.922, 0.928, 0.930, 0.929, 0.926, 0.920, 0.911, 0.901],
            [0.920, 0.940, 0.948, 0.953, 0.955, 0.954, 0.951, 0.946, 0.940, 0.933],
            [0.940, 0.957, 0.964, 0.968, 0.970, 0.969, 0.967, 0.963, 0.958, 0.951],
            [0.9546, 0.9735, 0.9806, 0.9833, 0.9848, 0.9853, 0.9853, 0.9851, 0.9845, 0.9837],
            [0.9264, 0.9601, 0.9706, 0.9751, 0.9774, 0.9785, 0.9789, 0.9787, 0.9779, 0.9769],
            [0.9289, 0.9616, 0.9716, 0.9761, 0.9783, 0.9795, 0.9797, 0.9797, 0.9792, 0.9785],
            [0.9134, 0.9522, 0.9658, 0.9719, 0.9750, 0.9765, 0.9774, 0.9778, 0.9775, 0.9772],
        ],
    },
}


def get_default_inputs() -> Dict[str, Any]:
    return copy.deepcopy({
        "mission_time_hours": 0.75,
        "usable_soc_fraction": 1.0,
        "min_current_margin": 1.0,
        "min_energy_margin": 1.0,
        "max_energy_margin": 2.0,
        "max_pack_mass_kg": 4.0,
        "max_pack_cost_usd": 500.0,
        "max_parallel": 4,
        "top_n": 10,
        "pack_mass_overhead_factor": 1.20,
        "loads": LOADS,
        "cells": CELLS,
        "architectures": ARCHITECTURES,
        "converter_curves": CONVERTER_CURVES,
        "thermal": {
            "ambient_temp_c": 25.0,
            "pack_specific_heat_j_per_kg_k": 900.0,
            "num_time_points": 100,
        },
    })


# ============================================================
# HELPERS
# ============================================================

def safe_div(n: float, d: float) -> float:
    return float("inf") if d == 0 else n / d


def safe_round(x: Optional[float], digits: int) -> Optional[float]:
    if x is None:
        return None
    if isinstance(x, float) and (math.isinf(x) or math.isnan(x)):
        return x
    return round(x, digits)


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    out = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = copy.deepcopy(value)
    return out


def json_safe(value: Any) -> Any:
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [json_safe(v) for v in value]
    return value


def series_range(cell: Dict[str, Any], arch: Dict[str, Any]) -> Tuple[int, int]:
    s_min = ceil(arch["pack_nom_min_v"] / cell["v_nom"])
    s_max = floor(arch["pack_nom_max_v"] / cell["v_nom"])
    return max(1, s_min), max(0, s_max)


def unique_configs(configs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out = []
    for r in configs:
        key = (r["architecture"], r["cell"], r["S"], r["P"])
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out


def total_avg_load_w(inputs: Dict[str, Any]) -> float:
    loads = inputs["loads"]
    return loads["cooling_avg_w"] + loads["other_avg_w"]


def total_peak_load_w(inputs: Dict[str, Any]) -> float:
    loads = inputs["loads"]
    return loads["cooling_peak_w"] + loads["other_peak_w"]


def interpolate_2d(x_grid, y_grid, z_grid, x, y):
    x = max(x_grid[0], min(x_grid[-1], x))
    y = max(y_grid[0], min(y_grid[-1], y))

    i = bisect_left(x_grid, x) - 1
    j = bisect_left(y_grid, y) - 1

    i = max(0, min(i, len(x_grid) - 2))
    j = max(0, min(j, len(y_grid) - 2))

    x0 = x_grid[i]
    x1 = x_grid[i + 1]
    y0 = y_grid[j]
    y1 = y_grid[j + 1]

    z00 = z_grid[i][j]
    z01 = z_grid[i][j + 1]
    z10 = z_grid[i + 1][j]
    z11 = z_grid[i + 1][j + 1]

    fx = 0.0 if x1 == x0 else (x - x0) / (x1 - x0)
    fy = 0.0 if y1 == y0 else (y - y0) / (y1 - y0)

    return (
        (1 - fx) * (1 - fy) * z00 +
        (1 - fx) * fy * z01 +
        fx * (1 - fy) * z10 +
        fx * fy * z11
    )


def converter_can_regulate(v_in, v_out, converter_type, arch):
    if converter_type == "direct" or v_out is None:
        return True
    if converter_type == "buck":
        headroom_v = arch.get("buck_headroom_v", 0.0)
        return v_in >= v_out + headroom_v
    if converter_type == "boost":
        return v_in <= v_out
    if converter_type == "buck_boost":
        return True
    return False


def converter_efficiency(v_in, v_out, p_out_w, arch, converter_curves):
    converter_type = arch["converter_type"]

    if converter_type == "direct" or v_out is None:
        return 1.0
    if v_in <= 0 or v_out <= 0 or p_out_w <= 0:
        return 1.0
    if not converter_can_regulate(v_in, v_out, converter_type, arch):
        return None

    curve_name = arch.get("efficiency_curve")
    if not curve_name or curve_name not in converter_curves:
        # Treat missing/unknown curve as out-of-range so the config is rejected
        # cleanly instead of crashing the whole brute-force loop.
        return None

    curve = converter_curves[curve_name]

    load_frac = p_out_w / curve["p_rated_w"]

    overload_factor = arch.get("converter_overload_factor", 1.05)
    if load_frac > overload_factor:
        return None

    return interpolate_2d(
        curve["v_in_grid"],
        curve["load_frac_grid"],
        curve["eff"],
        v_in,
        load_frac,
    )


def converter_input_power(v_in, v_out, p_out_w, arch, converter_curves):
    eff = converter_efficiency(v_in, v_out, p_out_w, arch, converter_curves)
    if eff is None:
        return None, None
    return safe_div(p_out_w, eff), eff


def per_sample_battery_state(v_values, v_out, p_out_w, arch, r_pack, converter_curves):
    samples = []
    for v in v_values:
        p_in, eff = converter_input_power(v, v_out, p_out_w, arch, converter_curves)
        if p_in is None or eff is None:
            return None
        i = safe_div(p_in, v)
        ir = i * i * r_pack
        samples.append((v, p_in, eff, i, ir))
    return samples


def average_battery_state(v_values, v_out, p_out_w, arch, r_pack, converter_curves):
    samples = per_sample_battery_state(v_values, v_out, p_out_w, arch, r_pack, converter_curves)
    if samples is None:
        return None
    n = len(samples)
    p_batt_avg = sum(s[1] for s in samples) / n
    i_pack_avg = sum(s[3] for s in samples) / n
    ir_loss_avg = sum(s[4] for s in samples) / n
    equiv_eff = safe_div(p_out_w, p_batt_avg)
    return p_batt_avg, equiv_eff, i_pack_avg, ir_loss_avg


def worst_converter_efficiency(v_values, v_out, p_out_w, arch, converter_curves):
    effs = []
    for v in v_values:
        eff = converter_efficiency(v, v_out, p_out_w, arch, converter_curves)
        if eff is None:
            return None
        effs.append(eff)
    return min(effs)


# ============================================================
# CORE EVALUATION
# ============================================================

def evaluate(cell: Dict[str, Any], arch: Dict[str, Any], s: int, p: int, inputs: Dict[str, Any]) -> Dict[str, Any]:
    mission_time_hours = inputs["mission_time_hours"]
    usable_soc_fraction = inputs["usable_soc_fraction"]
    min_current_margin = inputs["min_current_margin"]
    min_energy_margin = inputs["min_energy_margin"]
    max_energy_margin = inputs["max_energy_margin"]
    max_pack_mass_kg = inputs["max_pack_mass_kg"]
    max_pack_cost_usd = inputs["max_pack_cost_usd"]
    pack_mass_overhead_factor = inputs["pack_mass_overhead_factor"]
    converter_curves = inputs["converter_curves"]

    v_pack_nom = s * cell["v_nom"]
    v_pack_max = s * cell["v_max"]
    v_pack_min = s * cell["v_min"]

    v_pack_samples = [v_pack_max, v_pack_nom, v_pack_min]

    realized_capacity_factor = cell.get("realized_capacity_factor", 1.0)

    ah_pack = p * cell["capacity_ah"] * realized_capacity_factor
    wh_pack_usable = v_pack_nom * ah_pack * usable_soc_fraction

    r_pack = safe_div(s * cell["r_int_model_ohm"], p)

    useful_avg = total_avg_load_w(inputs)
    useful_peak = total_peak_load_w(inputs)

    target_bus_v = arch["target_bus_v"]

    avg_state = average_battery_state(
        v_pack_samples, target_bus_v, useful_avg, arch, r_pack, converter_curves,
    )

    p_batt_peak, converter_eff_peak = converter_input_power(
        v_pack_min, target_bus_v, useful_peak, arch, converter_curves,
    )

    converter_eff_worst_avg = worst_converter_efficiency(
        v_pack_samples, target_bus_v, useful_avg, arch, converter_curves,
    )

    converter_eff_worst_peak = worst_converter_efficiency(
        v_pack_samples, target_bus_v, useful_peak, arch, converter_curves,
    )

    converter_valid_avg = avg_state is not None
    converter_valid_peak = p_batt_peak is not None and converter_eff_peak is not None
    converter_valid = converter_valid_avg and converter_valid_peak

    if converter_valid_avg:
        p_batt_avg, converter_eff_avg, i_pack_avg, ir_loss_avg = avg_state
    else:
        p_batt_avg = float("inf")
        converter_eff_avg = None
        i_pack_avg = float("inf")
        ir_loss_avg = float("inf")

    if converter_valid_peak:
        i_pack_peak = safe_div(p_batt_peak, v_pack_min)
        ir_loss_peak = i_pack_peak * i_pack_peak * r_pack
    else:
        p_batt_peak = float("inf")
        converter_eff_peak = None
        i_pack_peak = float("inf")
        ir_loss_peak = float("inf")

    if not converter_valid:
        converter_eff_worst_avg = None
        converter_eff_worst_peak = None

    i_cell_peak = safe_div(i_pack_peak, p)
    i_cell_avg = safe_div(i_pack_avg, p)
    current_margin = safe_div(cell["i_cont_a"], i_cell_peak)

    wh_required_terminal = p_batt_avg * mission_time_hours
    wh_ir_loss = ir_loss_avg * mission_time_hours
    wh_required_chem = wh_required_terminal + wh_ir_loss

    energy_margin = safe_div(wh_pack_usable, wh_required_chem)
    reserve_pct = max(0.0, (energy_margin - 1.0) * 100.0)
    runtime_min = safe_div(wh_pack_usable, p_batt_avg + ir_loss_avg) * 60.0

    conv_loss_avg = p_batt_avg - useful_avg
    conv_loss_peak = p_batt_peak - useful_peak

    total_loss_avg = ir_loss_avg + conv_loss_avg
    system_eff_avg = safe_div(useful_avg, useful_avg + total_loss_avg)

    n_cells = s * p
    pack_cells_mass_kg = n_cells * cell["mass_g"] / 1000.0
    pack_mass_kg = pack_cells_mass_kg * pack_mass_overhead_factor
    pack_cost_usd = n_cells * cell["cost_usd"]
    wh_per_kg = safe_div(wh_pack_usable, pack_mass_kg)

    if converter_valid_peak:
        v_pack_min_terminal_peak = v_pack_min - i_pack_peak * r_pack
    else:
        v_pack_min_terminal_peak = v_pack_min

    reasons: List[str] = []
    if not converter_valid:
        reasons.append("converter_range")
    if current_margin < min_current_margin:
        reasons.append("current")
    if energy_margin < min_energy_margin:
        reasons.append("energy")
    if pack_mass_kg > max_pack_mass_kg:
        reasons.append("mass")
    if pack_cost_usd > max_pack_cost_usd:
        reasons.append("cost")
    if max_energy_margin is not None and energy_margin > max_energy_margin:
        reasons.append("oversized")
    if "pack_oper_min_v" in arch and v_pack_min_terminal_peak < arch["pack_oper_min_v"]:
        reasons.append("voltage_low")
    if "pack_oper_max_v" in arch and v_pack_max > arch["pack_oper_max_v"]:
        reasons.append("voltage_high")

    feasible = len(reasons) == 0
    right_sized = feasible

    return {
        "feasible": feasible,
        "right_sized": right_sized,
        "reasons": reasons,
        "architecture": arch["name"],
        "cell": cell["name"],
        "S": s,
        "P": p,

        "v_pack_min": round(v_pack_min, 2),
        "v_pack_nom": round(v_pack_nom, 2),
        "v_pack_max": round(v_pack_max, 2),
        "v_pack_min_terminal_peak": safe_round(v_pack_min_terminal_peak, 2),

        "i_cell_peak": safe_round(i_cell_peak, 2),
        "i_cell_avg": safe_round(i_cell_avg, 2),
        "current_margin": safe_round(current_margin, 2),

        "realized_capacity_factor": realized_capacity_factor,
        "wh_pack_usable": safe_round(wh_pack_usable, 1),
        "wh_required": safe_round(wh_required_terminal, 1),
        "wh_required_chem": safe_round(wh_required_chem, 1),
        "energy_margin": safe_round(energy_margin, 2),
        "reserve_pct": safe_round(reserve_pct, 1),
        "runtime_min": safe_round(runtime_min, 1),

        "p_batt_avg": safe_round(p_batt_avg, 1),
        "p_batt_peak": safe_round(p_batt_peak, 1),

        "ir_loss_avg": safe_round(ir_loss_avg, 2),
        "ir_loss_peak": safe_round(ir_loss_peak, 2),
        "conv_loss_avg": safe_round(conv_loss_avg, 2),
        "conv_loss_peak": safe_round(conv_loss_peak, 2),
        "system_eff_avg": safe_round(system_eff_avg, 4),

        "converter_eff_avg": safe_round(converter_eff_avg, 4),
        "converter_eff_peak": safe_round(converter_eff_peak, 4),
        "converter_eff_worst_avg": safe_round(converter_eff_worst_avg, 4),
        "converter_eff_worst_peak": safe_round(converter_eff_worst_peak, 4),

        "pack_cells_mass_kg": safe_round(pack_cells_mass_kg, 2),
        "pack_mass_kg": safe_round(pack_mass_kg, 2),
        "pack_cost_usd": safe_round(pack_cost_usd, 2),
        "wh_per_kg": safe_round(wh_per_kg, 1),
    }


def find_all_configs(inputs: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    feasible: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []

    for arch in inputs["architectures"]:
        for cell in inputs["cells"]:
            s_min, s_max = series_range(cell, arch)
            if s_min > s_max:
                continue
            for s in range(s_min, s_max + 1):
                for p in range(1, int(inputs["max_parallel"]) + 1):
                    result = evaluate(cell, arch, s, p, inputs)
                    if result["feasible"]:
                        feasible.append(result)
                    else:
                        rejected.append(result)

    return feasible, rejected


# ============================================================
# PICKS
# ============================================================

def _safe_key_num(x: Optional[float], fallback: float) -> float:
    if x is None:
        return fallback
    if isinstance(x, float) and (math.isinf(x) or math.isnan(x)):
        return fallback
    return x


def pick_cheapest(configs: List[Dict[str, Any]]) -> Dict[str, Any]:
    return min(
        configs,
        key=lambda x: (
            _safe_key_num(x["pack_cost_usd"], float("inf")),
            _safe_key_num(x["pack_mass_kg"], float("inf")),
            -_safe_key_num(x["system_eff_avg"], 0.0),
        ),
    )


def pick_lightest(configs: List[Dict[str, Any]]) -> Dict[str, Any]:
    return min(
        configs,
        key=lambda x: (
            _safe_key_num(x["pack_mass_kg"], float("inf")),
            _safe_key_num(x["pack_cost_usd"], float("inf")),
            -_safe_key_num(x["system_eff_avg"], 0.0),
        ),
    )


def pick_tightest(configs: List[Dict[str, Any]]) -> Dict[str, Any]:
    return min(
        configs,
        key=lambda x: (
            _safe_key_num(x["energy_margin"], float("inf")),
            _safe_key_num(x["pack_cost_usd"], float("inf")),
            _safe_key_num(x["pack_mass_kg"], float("inf")),
        ),
    )


def pick_most_efficient(configs: List[Dict[str, Any]]) -> Dict[str, Any]:
    return max(
        configs,
        key=lambda x: (
            _safe_key_num(x["system_eff_avg"], 0.0),
            -_safe_key_num(x["pack_mass_kg"], float("inf")),
            -_safe_key_num(x["pack_cost_usd"], float("inf")),
        ),
    )


def get_key_pick_entries(configs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not configs:
        return []
    labeled = [
        ("Lightest", pick_lightest(configs)),
        ("Cheapest", pick_cheapest(configs)),
        ("Least oversized", pick_tightest(configs)),
        ("Most efficient", pick_most_efficient(configs)),
    ]

    grouped: Dict[Tuple, Dict[str, Any]] = {}
    order: List[Tuple] = []

    for label, r in labeled:
        key = (r["architecture"], r["cell"], r["S"], r["P"])
        if key not in grouped:
            grouped[key] = {"config": r, "labels": []}
            order.append(key)
        grouped[key]["labels"].append(label)

    return [grouped[key] for key in order]


def get_closest_rejected(arch_name: str, rejected: List[Dict[str, Any]], cell_name: Optional[str] = None) -> List[Dict[str, Any]]:
    pool = [r for r in rejected if r["architecture"] == arch_name]
    if cell_name is not None:
        pool = [r for r in pool if r["cell"] == cell_name]
    if not pool:
        return []

    return sorted(
        pool,
        key=lambda x: (
            len(x["reasons"]),
            -_safe_key_num(x["current_margin"], 0.0),
            -_safe_key_num(x["energy_margin"], 0.0),
            _safe_key_num(x["pack_cost_usd"], float("inf")),
            _safe_key_num(x["pack_mass_kg"], float("inf")),
        ),
    )


def _arch_picks(arch_configs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Per-architecture pick labels, one entry per label, in display order."""
    if not arch_configs:
        return []
    return [
        {"label": "Lightest", "config": pick_lightest(arch_configs)},
        {"label": "Cheapest", "config": pick_cheapest(arch_configs)},
        {"label": "Most efficient", "config": pick_most_efficient(arch_configs)},
        {"label": "Least oversized", "config": pick_tightest(arch_configs)},
    ]


def build_key_picks_by_architecture(
    feasible: List[Dict[str, Any]],
    rejected: List[Dict[str, Any]],
    inputs: Dict[str, Any],
) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for arch in inputs["architectures"]:
        name = arch["name"]
        arch_configs = [r for r in feasible if r["architecture"] == name]
        if arch_configs:
            out[name] = {
                "has_feasible": True,
                "picks": _arch_picks(arch_configs),
                "closest_rejected": [],
            }
        else:
            out[name] = {
                "has_feasible": False,
                "picks": [],
                "closest_rejected": get_closest_rejected(name, rejected)[:5],
            }
    return out


# ============================================================
# THERMAL
# ============================================================

def pack_temperature_trace(config: Dict[str, Any], inputs: Dict[str, Any]) -> Dict[str, Any]:
    thermal = inputs["thermal"]
    ambient = thermal["ambient_temp_c"]
    cp = thermal["pack_specific_heat_j_per_kg_k"]
    n = int(thermal["num_time_points"])
    mission_seconds = inputs["mission_time_hours"] * 3600.0

    mass_kg = config.get("pack_mass_kg")
    p_heat_w = config.get("ir_loss_avg")

    base = {
        "architecture": config.get("architecture"),
        "cell": config.get("cell"),
        "S": config.get("S"),
        "P": config.get("P"),
        "label": f"{config.get('cell')} {config.get('S')}S{config.get('P')}P",
    }

    invalid = (
        mass_kg is None or mass_kg is False or mass_kg <= 0
        or cp is None or cp <= 0
        or p_heat_w is None
        or (isinstance(p_heat_w, float) and (math.isinf(p_heat_w) or math.isnan(p_heat_w)))
    )

    if invalid:
        return {**base, "end_temp_c": None, "temp_rise_c": None, "points": []}

    points = []
    for i in range(n):
        frac = i / (n - 1) if n > 1 else 1.0
        t_s = frac * mission_seconds
        t_min = t_s / 60.0
        temp_c = ambient + (p_heat_w / (mass_kg * cp)) * t_s
        points.append({"t_min": round(t_min, 3), "temp_c": round(temp_c, 3)})

    end_temp = points[-1]["temp_c"] if points else None
    return {
        **base,
        "end_temp_c": end_temp,
        "temp_rise_c": round(end_temp - ambient, 3) if end_temp is not None else None,
        "points": points,
    }


def build_thermal_traces(
    feasible: List[Dict[str, Any]],
    rejected: List[Dict[str, Any]],
    inputs: Dict[str, Any],
) -> List[Dict[str, Any]]:
    traces: List[Dict[str, Any]] = []
    seen = set()

    def add(cfg: Dict[str, Any]) -> None:
        key = (cfg["architecture"], cfg["cell"], cfg["S"], cfg["P"])
        if key in seen:
            return
        seen.add(key)
        traces.append(pack_temperature_trace(cfg, inputs))

    for arch in inputs["architectures"]:
        name = arch["name"]
        arch_feasible = [r for r in feasible if r["architecture"] == name]
        if arch_feasible:
            for entry in get_key_pick_entries(arch_feasible):
                add(entry["config"])
        else:
            for r in get_closest_rejected(name, rejected)[:3]:
                add(r)

    return traces


# ============================================================
# TOP-LEVEL API
# ============================================================

def run_model(inputs: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    merged = get_default_inputs()
    if inputs:
        merged = deep_merge(merged, inputs)

    feasible, rejected = find_all_configs(merged)

    feasible_sorted = sorted(
        feasible,
        key=lambda r: (
            _safe_key_num(r["pack_mass_kg"], float("inf")),
            _safe_key_num(r["pack_cost_usd"], float("inf")),
            -_safe_key_num(r["system_eff_avg"], 0.0),
        ),
    )

    key_picks_by_architecture = build_key_picks_by_architecture(feasible, rejected, merged)
    thermal_traces = build_thermal_traces(feasible, rejected, merged)

    return json_safe({
        "inputs": merged,
        "summary": {
            "feasible_count": len(feasible),
            "rejected_count": len(rejected),
            "total_avg_load_w": total_avg_load_w(merged),
            "total_peak_load_w": total_peak_load_w(merged),
        },
        "feasible": feasible_sorted,
        "rejected": rejected,
        "key_picks_by_architecture": key_picks_by_architecture,
        "thermal_traces": thermal_traces,
    })
