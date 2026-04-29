import { invoke } from "@tauri-apps/api/core";

export type EngineStatus = {
  activeEngine: "rules";
  wslAvailable: boolean;
  litertLmCliAvailable: boolean;
  pythonPipAvailable: boolean;
  notes: string[];
};

export async function loadEngineStatus() {
  return invoke<EngineStatus>("engine_status");
}
