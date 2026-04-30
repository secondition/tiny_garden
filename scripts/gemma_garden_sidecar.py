#!/usr/bin/env python3
"""LiteRT-LM Gemma sidecar for Tiny Garden.

The Tauri shell starts this script through WSL and sends one JSON request on stdin:

    {"instruction": "plant sunflowers in the top row"}

The script loads a full Gemma LiteRT-LM model, lets the model call garden tools, and prints one
JSON response on stdout:

    {"ok": true, "text": "...", "commands": [{"item": 1, "plot": [1, 2, 3]}]}
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from typing import Any

DEFAULT_MODEL_PATH = (
    "~/.cache/tiny-garden/models/gemma-4-E2B-it-litert-lm/gemma-4-E2B-it.litertlm"
)

SYSTEM_INSTRUCTION = """You are an assistant helping the user play a game about gardening.

The environment is a 3x3 grid of garden plots. The plots are numbered 1 through 9.

Garden Plot Layout:
- Row 1: Plots 1, 2, 3 (top row)
- Row 2: Plots 4, 5, 6 (middle row)
- Row 3: Plots 7, 8, 9 (bottom row)

Help the user plant seeds, water plots, and harvest flowers.

There are 4 kinds of seeds you can plant:
1. sunflower
2. daisy
3. rose
4. special (edge gallery, special, secret)

For each action, identify all individual plot numbers from 1 through 9, including implied plots
such as "top row", "middle column", "corners", or "all plots".

Use the available tools whenever the user asks to plant, water, or harvest. You may also explain
what you did in natural language after the tool call."""

ITEMS = {
    "sunflower": 1,
    "daisy": 2,
    "rose": 3,
    "special": 4,
    "edge gallery": 4,
    "secret": 4,
    "water": 5,
    "harvest": 6,
}


@dataclass
class GardenCommand:
    item: int
    plot: list[int]


commands: list[GardenCommand] = []


def waterPlots(plots: list[int]) -> dict[str, Any]:
    """Water one or more garden plots.

    Args:
        plots: The IDs of the plots to water. Each value must be between 1 and 9.
    """

    normalized_plots = _normalize_plots(plots)
    commands.append(GardenCommand(item=ITEMS["water"], plot=normalized_plots))
    return {"result": "success", "plots": normalized_plots}


def plantSeed(seed: str, plots: list[int]) -> dict[str, Any]:
    """Plant a seed in one or more garden plots.

    Args:
        seed: The name of the seed to plant. Use sunflower, daisy, rose, or special.
        plots: The IDs of the plots to plant in. Each value must be between 1 and 9.
    """

    normalized_seed = seed.strip().lower()
    item = ITEMS.get(normalized_seed)
    normalized_plots = _normalize_plots(plots)

    if item is not None:
        commands.append(GardenCommand(item=item, plot=normalized_plots))

    return {"result": "success", "seed": normalized_seed, "plots": normalized_plots}


def harvestPlots(plots: list[int]) -> dict[str, Any]:
    """Harvest one or more garden plots.

    Args:
        plots: The IDs of the plots to harvest. Each value must be between 1 and 9.
    """

    normalized_plots = _normalize_plots(plots)
    commands.append(GardenCommand(item=ITEMS["harvest"], plot=normalized_plots))
    return {"result": "success", "plots": normalized_plots}


def main() -> int:
    try:
        request = json.load(sys.stdin)
        instruction = str(request["instruction"]).strip()
        if not instruction:
            _write_response({"ok": False, "error": "Instruction is empty."})
            return 0

        response_text = run_gemma(instruction)
        _write_response(
            {
                "ok": True,
                "text": response_text,
                "commands": [
                    {"item": command.item, "plot": command.plot} for command in commands
                ],
            }
        )
        return 0
    except Exception as exc:  # noqa: BLE001 - errors are reported over the JSON boundary.
        _write_response({"ok": False, "error": str(exc)})
        return 1


def run_gemma(instruction: str) -> str:
    try:
        import litert_lm
    except ImportError as exc:
        raise RuntimeError(
            "litert_lm is not installed in WSL. Run scripts/setup-wsl-litertlm.ps1 first."
        ) from exc

    litert_lm.set_min_log_severity(litert_lm.LogSeverity.ERROR)

    model_path = os.path.expanduser(os.environ.get("TINY_GARDEN_GEMMA_MODEL", DEFAULT_MODEL_PATH))
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Gemma LiteRT-LM model not found at {model_path}. "
            "Run scripts/setup-wsl-litertlm.ps1 first or set TINY_GARDEN_GEMMA_MODEL."
        )

    messages = [
        {
            "role": "system",
            "content": [{"type": "text", "text": SYSTEM_INSTRUCTION}],
        }
    ]

    with litert_lm.Engine(model_path, backend=litert_lm.Backend.CPU) as engine:
        with engine.create_conversation(
            messages=messages,
            tools=[waterPlots, plantSeed, harvestPlots],
        ) as conversation:
            response = conversation.send_message(instruction)

    return _extract_text(response)


def _normalize_plots(plots: list[int]) -> list[int]:
    return sorted({int(plot) for plot in plots if 1 <= int(plot) <= 9})


def _extract_text(response: Any) -> str:
    if isinstance(response, dict):
        return "".join(
            item.get("text", "")
            for item in response.get("content", [])
            if item.get("type") == "text"
        ).strip()
    return str(response).strip()


def _write_response(response: dict[str, Any]) -> None:
    print(json.dumps(response, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
