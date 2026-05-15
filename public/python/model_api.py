"""JSON entrypoints for the browser model, called from Pyodide."""

import json

from battery_model import get_default_inputs, run_model, json_safe


def get_default_inputs_json() -> str:
    return json.dumps(json_safe(get_default_inputs()))


def run_model_json(input_json: str) -> str:
    inputs = json.loads(input_json) if input_json else {}
    result = run_model(inputs)
    return json.dumps(json_safe(result))
