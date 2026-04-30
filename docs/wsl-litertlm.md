# WSL LiteRT-LM Gemma Backend

The Windows app can call a full Gemma LiteRT-LM model through WSL. The model backend is separate
from the fallback TypeScript rules parser:

- Rules parser: immediate, offline, bundled with the app.
- WSL Gemma backend: full Gemma text generation plus tool calls, backed by LiteRT-LM in WSL.

## Setup

Run from the Windows project root:

```powershell
.\scripts\setup-wsl-litertlm.ps1
```

The script creates a WSL virtual environment under `~/.cache/tiny-garden/.venv`, installs
`litert-lm-api-nightly`, and downloads:

```text
litert-community/gemma-4-E2B-it-litert-lm/gemma-4-E2B-it.litertlm
```

To use a different model file, set `TINY_GARDEN_GEMMA_MODEL` in WSL before launching the app's
sidecar, or pass different parameters to the setup script.

## Runtime Contract

The app sends a JSON request to `scripts/gemma_garden_sidecar.py`:

```json
{ "instruction": "plant roses in the right column" }
```

The sidecar returns:

```json
{
  "ok": true,
  "text": "I planted roses in the right column.",
  "commands": [{ "item": 3, "plot": [3, 6, 9] }]
}
```

If the WSL backend is unavailable or does not return a command, the app keeps the rules parser as
the fallback path.
