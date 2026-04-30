import { invoke } from "@tauri-apps/api/core";

export type EngineStatus = {
  activeEngine: "rules" | "gemma-wsl";
  wslAvailable: boolean;
  litertLmCliAvailable: boolean;
  pythonPipAvailable: boolean;
  sidecarAvailable: boolean;
  notes: string[];
};

export type GemmaCommandResponse = {
  ok: boolean;
  text: string;
  commands: Array<{ item: number; plot: number[] }>;
  engine: "gemma-wsl";
  error?: string;
};

export async function loadEngineStatus() {
  return invoke<EngineStatus>("engine_status");
}

export async function requestGemmaCommand(instruction: string) {
  return invoke<GemmaCommandResponse>("gemma_command", {
    request: { instruction },
  });
}
