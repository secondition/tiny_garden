import type { GardenCommand } from "./gardenCommands";

type TinyGardenApi = {
  runCommands: (commands: string) => void;
  showHelp?: () => void;
  showTutorial?: () => void;
  unlockAll?: () => void;
};

type ReadyListener = {
  onLoading: () => void;
  onReady: () => void;
};

const POLL_INTERVAL_MS = 120;
const LOAD_SETTLE_MS = 250;

export class TinyGardenBridge {
  #ready = false;
  #pollTimer = 0;

  constructor(
    private readonly frame: HTMLIFrameElement,
    private readonly listener: ReadyListener,
  ) {}

  get ready() {
    return this.#ready;
  }

  start() {
    this.frame.addEventListener("load", this.#handleLoad);
    this.#pollForApi();
  }

  run(commands: GardenCommand[]) {
    this.#getApi()?.runCommands(JSON.stringify(commands));
  }

  dispose() {
    window.clearTimeout(this.#pollTimer);
    this.frame.removeEventListener("load", this.#handleLoad);
  }

  #handleLoad = () => {
    this.#ready = false;
    this.listener.onLoading();
    window.clearTimeout(this.#pollTimer);
    this.#pollTimer = window.setTimeout(() => this.#pollForApi(), LOAD_SETTLE_MS);
  };

  #pollForApi() {
    if (this.#getApi()?.runCommands) {
      this.#ready = true;
      this.listener.onReady();
      return;
    }

    this.#pollTimer = window.setTimeout(() => this.#pollForApi(), POLL_INTERVAL_MS);
  }

  #getApi() {
    return this.frame.contentWindow?.tinyGarden;
  }
}

declare global {
  interface Window {
    tinyGarden?: TinyGardenApi;
  }
}
