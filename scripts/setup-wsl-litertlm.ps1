param(
  [string]$ModelRepo = "litert-community/gemma-4-E2B-it-litert-lm",
  [string]$ModelFile = "gemma-4-E2B-it.litertlm",
  [string]$InstallRoot = "~/.cache/tiny-garden",
  [switch]$InstallAptPackages
)

$ErrorActionPreference = "Stop"

$bash = @"
set -euo pipefail

INSTALL_ROOT="$InstallRoot"
MODEL_REPO="$ModelRepo"
MODEL_FILE="$ModelFile"
VENV_DIR="\$INSTALL_ROOT/.venv"
MODEL_DIR="\$INSTALL_ROOT/models/\${MODEL_REPO##*/}"

mkdir -p "\$INSTALL_ROOT" "\$MODEL_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required in WSL." >&2
  exit 1
fi

if ! python3 -m venv --help >/dev/null 2>&1; then
  if [ "$($InstallAptPackages.IsPresent.ToString().ToLowerInvariant())" = "true" ]; then
    sudo apt-get update
    sudo apt-get install -y python3-venv python3-pip
  else
    echo "python3-venv is required in WSL." >&2
    echo "Re-run with -InstallAptPackages to install python3-venv and python3-pip through apt." >&2
    exit 1
  fi
fi

python3 -m venv "\$VENV_DIR"
"\$VENV_DIR/bin/python" -m ensurepip --upgrade
"\$VENV_DIR/bin/python" -m pip install --upgrade pip
"\$VENV_DIR/bin/python" -m pip install --upgrade litert-lm-api-nightly huggingface_hub

"\$VENV_DIR/bin/python" - <<'PY'
from huggingface_hub import hf_hub_download
import os

repo_id = os.environ["MODEL_REPO"]
filename = os.environ["MODEL_FILE"]
local_dir = os.environ["MODEL_DIR"]

path = hf_hub_download(
    repo_id=repo_id,
    filename=filename,
    local_dir=local_dir,
    local_dir_use_symlinks=False,
)
print(path)
PY

echo "LiteRT-LM Gemma model is ready at \$MODEL_DIR/\$MODEL_FILE"
"@

$bash = "MODEL_REPO='$ModelRepo' MODEL_FILE='$ModelFile' MODEL_DIR='$InstallRoot/models/$($ModelRepo.Split('/')[-1])' " + $bash

wsl.exe bash -lc $bash
