"""Smoke test for the browser-safe battery model.

Run with:
    python scripts/check_model.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "public" / "python"))

from model_api import get_default_inputs_json, run_model_json  # noqa: E402


REQUIRED_BEST_FIELDS = [
    "architecture",
    "cell",
    "S",
    "P",
    "pack_mass_kg",
    "pack_cost_usd",
    "runtime_min",
    "energy_margin",
    "current_margin",
    "system_eff_avg",
]


def _assert_json_safe(value, path="result"):
    if isinstance(value, dict):
        for k, v in value.items():
            _assert_json_safe(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _assert_json_safe(v, f"{path}[{i}]")
    elif isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            raise AssertionError(f"Non-JSON-safe float at {path}: {value!r}")


def main() -> int:
    defaults = json.loads(get_default_inputs_json())
    assert "cells" in defaults and len(defaults["cells"]) > 0, "No default cells"
    assert "architectures" in defaults and len(defaults["architectures"]) > 0, "No default architectures"

    result_str = run_model_json(json.dumps(defaults))
    result = json.loads(result_str)

    assert "summary" in result, "Missing summary"
    assert "feasible" in result, "Missing feasible list"
    assert "rejected" in result, "Missing rejected list"
    assert "key_picks_by_architecture" in result, "Missing key_picks_by_architecture"
    assert "thermal_traces" in result, "Missing thermal_traces"

    total = result["summary"]["feasible_count"] + result["summary"]["rejected_count"]
    assert total > 0, "No configurations were evaluated"

    for arch_name, block in result["key_picks_by_architecture"].items():
        assert "has_feasible" in block and "picks" in block and "closest_rejected" in block, (
            f"Arch {arch_name} block missing fields"
        )
        if block["has_feasible"]:
            assert len(block["picks"]) == 4, (
                f"Arch {arch_name} should have 4 picks, got {len(block['picks'])}"
            )
            for entry in block["picks"]:
                for key in REQUIRED_BEST_FIELDS:
                    assert key in entry["config"], (
                        f"Arch {arch_name} pick {entry['label']} missing {key}"
                    )

    _assert_json_safe(result)

    print("Model check passed")
    print(f"  feasible: {result['summary']['feasible_count']}")
    print(f"  rejected: {result['summary']['rejected_count']}")
    print(f"  total avg load: {result['summary']['total_avg_load_w']} W")
    print(f"  total peak load: {result['summary']['total_peak_load_w']} W")
    for arch_name, block in result["key_picks_by_architecture"].items():
        if not block["has_feasible"]:
            print(f"  [{arch_name}] no feasible (closest rejected: {len(block['closest_rejected'])})")
            continue
        print(f"  [{arch_name}]")
        for entry in block["picks"]:
            c = entry["config"]
            print(
                f"    {entry['label']:>16}: {c['cell']} {c['S']}S{c['P']}P"
                f" | mass={c['pack_mass_kg']} kg | cost=${c['pack_cost_usd']}"
                f" | runtime={c['runtime_min']} min | em={c['energy_margin']}"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
