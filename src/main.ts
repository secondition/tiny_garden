import { loadEngineStatus } from "./engineStatus";
import { EXAMPLE_COMMANDS, parseGardenInstruction } from "./gardenCommands";
import "./styles.css";
import { TinyGardenBridge } from "./tinyGardenBridge";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app");
}

app.innerHTML = `
  <main class="shell">
    <section class="game-stage" aria-label="Tiny Garden game">
      <iframe
        id="garden-frame"
        title="Tiny Garden"
        src="/assets/tinygarden/index.html?tutorial=1"
        allow="autoplay"
      ></iframe>
      <div id="loading-mask" class="loading-mask">Loading Tiny Garden</div>
    </section>

    <section class="command-bar" aria-label="Garden controls">
      <div class="status-row">
        <span id="status-dot" class="status-dot"></span>
        <span id="status-text">等待游戏加载</span>
        <button id="history-toggle" type="button" class="ghost-button">历史</button>
      </div>
      <div class="engine-row">
        <span>引擎</span>
        <strong id="engine-mode">规则解析</strong>
        <span id="engine-note">正在检查 LiteRT-LM 环境</span>
      </div>
      <form id="command-form" class="command-form">
        <input
          id="instruction-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="例如：在第一行种向日葵"
        />
        <button id="send-button" type="submit">执行</button>
      </form>
      <div id="quick-row" class="quick-row" aria-label="Quick commands"></div>
    </section>

    <aside id="history-panel" class="history-panel" aria-label="Command history">
      <header>
        <h2>历史</h2>
        <button id="history-close" type="button" aria-label="Close history">×</button>
      </header>
      <ol id="history-list"></ol>
    </aside>
  </main>
`;

const frame = getElement<HTMLIFrameElement>("#garden-frame");
const loadingMask = getElement<HTMLDivElement>("#loading-mask");
const form = getElement<HTMLFormElement>("#command-form");
const input = getElement<HTMLInputElement>("#instruction-input");
const statusDot = getElement<HTMLSpanElement>("#status-dot");
const statusText = getElement<HTMLSpanElement>("#status-text");
const engineMode = getElement<HTMLElement>("#engine-mode");
const engineNote = getElement<HTMLSpanElement>("#engine-note");
const historyPanel = getElement<HTMLElement>("#history-panel");
const historyList = getElement<HTMLOListElement>("#history-list");
const historyToggle = getElement<HTMLButtonElement>("#history-toggle");
const historyClose = getElement<HTMLButtonElement>("#history-close");
const quickRow = getElement<HTMLDivElement>("#quick-row");

const bridge = new TinyGardenBridge(frame, {
  onLoading: () => {
    setStatus("正在初始化游戏", false);
  },
  onReady: () => {
    loadingMask.classList.add("hide");
    setStatus("游戏已就绪，可以输入指令", true);
    input.focus();
  },
});

renderQuickCommands();
bridge.start();
renderEngineStatus();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  runInstruction(text);
  input.value = "";
});

historyToggle.addEventListener("click", () => {
  historyPanel.classList.add("open");
});

historyClose.addEventListener("click", () => {
  historyPanel.classList.remove("open");
});

window.addEventListener("beforeunload", () => {
  bridge.dispose();
});

function renderQuickCommands() {
  for (const example of EXAMPLE_COMMANDS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = example.label;
    button.addEventListener("click", () => {
      runInstruction(example.instruction);
    });
    quickRow.append(button);
  }
}

function runInstruction(text: string) {
  if (!bridge.ready) {
    setStatus("游戏还没加载完", false);
    return;
  }

  const parsed = parseGardenInstruction(text);
  if (!parsed.ok) {
    setStatus(parsed.message, false);
    addHistory(text, parsed.message, null);
    return;
  }

  bridge.run(parsed.commands);
  const payload = JSON.stringify(parsed.commands);
  setStatus(parsed.label, true);
  addHistory(text, parsed.label, payload);
}

function setStatus(text: string, ready: boolean) {
  statusText.textContent = text;
  statusDot.dataset.ready = ready ? "true" : "false";
}

async function renderEngineStatus() {
  try {
    const status = await loadEngineStatus();
    engineMode.textContent = status.activeEngine === "rules" ? "规则解析" : status.activeEngine;

    if (status.litertLmCliAvailable) {
      engineNote.textContent = "检测到 LiteRT-LM CLI，可接入模型 sidecar";
      return;
    }

    engineNote.textContent = status.notes[0] ?? "LiteRT-LM 尚未连接";
  } catch (error) {
    engineNote.textContent = error instanceof Error ? error.message : "引擎诊断不可用";
  }
}

function addHistory(inputText: string, result: string, payload: string | null) {
  const item = document.createElement("li");
  const command = document.createElement("strong");
  const output = document.createElement("span");
  command.textContent = inputText;
  output.textContent = result;
  item.append(command, output);

  if (payload) {
    const code = document.createElement("code");
    code.textContent = payload;
    item.append(code);
  }

  historyList.prepend(item);
}

function getElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}
