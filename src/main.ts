import "./styles.css";

type GardenCommand = {
  item: number;
  plot: number[];
};

type ParsedInstruction =
  | {
      ok: true;
      action: "plant" | "water" | "harvest";
      label: string;
      commands: GardenCommand[];
    }
  | {
      ok: false;
      message: string;
    };

const ITEM = {
  sunflower: 1,
  daisy: 2,
  rose: 3,
  special: 4,
  water: 5,
  harvest: 6,
} as const;

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
      <div class="quick-row" aria-label="Quick commands">
        <button type="button" data-command="在第一行种向日葵">第一行向日葵</button>
        <button type="button" data-command="给所有地块浇水">全部浇水</button>
        <button type="button" data-command="收获所有地块">全部收获</button>
      </div>
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

const frame = document.querySelector<HTMLIFrameElement>("#garden-frame");
const loadingMask = document.querySelector<HTMLDivElement>("#loading-mask");
const form = document.querySelector<HTMLFormElement>("#command-form");
const input = document.querySelector<HTMLInputElement>("#instruction-input");
const statusDot = document.querySelector<HTMLSpanElement>("#status-dot");
const statusText = document.querySelector<HTMLSpanElement>("#status-text");
const historyPanel = document.querySelector<HTMLElement>("#history-panel");
const historyList = document.querySelector<HTMLOListElement>("#history-list");
const historyToggle = document.querySelector<HTMLButtonElement>("#history-toggle");
const historyClose = document.querySelector<HTMLButtonElement>("#history-close");

let gameReady = false;

function setStatus(text: string, ready = gameReady) {
  if (statusText) statusText.textContent = text;
  if (statusDot) statusDot.dataset.ready = ready ? "true" : "false";
}

function getTinyGarden() {
  return frame?.contentWindow?.tinyGarden;
}

function markReady() {
  const api = getTinyGarden();
  if (!api?.runCommands) {
    window.setTimeout(markReady, 120);
    return;
  }

  gameReady = true;
  loadingMask?.classList.add("hide");
  setStatus("游戏已就绪，可以输入指令", true);
  input?.focus();
}

frame?.addEventListener("load", () => {
  setStatus("正在初始化游戏", false);
  window.setTimeout(markReady, 250);
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input?.value.trim() ?? "";
  if (!text) return;
  runInstruction(text);
  if (input) input.value = "";
});

document.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    const command = button.dataset.command;
    if (!command) return;
    runInstruction(command);
  });
});

historyToggle?.addEventListener("click", () => {
  historyPanel?.classList.add("open");
});

historyClose?.addEventListener("click", () => {
  historyPanel?.classList.remove("open");
});

function runInstruction(text: string) {
  if (!gameReady) {
    setStatus("游戏还没加载完", false);
    return;
  }

  const parsed = parseInstruction(text);
  if (!parsed.ok) {
    setStatus(parsed.message, false);
    addHistory(text, parsed.message, null);
    return;
  }

  const payload = JSON.stringify(parsed.commands);
  getTinyGarden()?.runCommands(payload);
  setStatus(parsed.label, true);
  addHistory(text, parsed.label, payload);
}

function addHistory(inputText: string, result: string, payload: string | null) {
  if (!historyList) return;

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

function parseInstruction(rawText: string): ParsedInstruction {
  const text = normalize(rawText);
  const plots = parsePlots(text);
  if (plots.length === 0) {
    return { ok: false, message: "没识别到地块。可以说第一行、左列、全部、5号地块等。" };
  }

  if (isHarvest(text)) {
    return {
      ok: true,
      action: "harvest",
      label: `收获地块 ${plots.join(", ")}`,
      commands: [{ item: ITEM.harvest, plot: plots }],
    };
  }

  if (isWater(text)) {
    return {
      ok: true,
      action: "water",
      label: `浇水地块 ${plots.join(", ")}`,
      commands: [{ item: ITEM.water, plot: plots }],
    };
  }

  const seed = parseSeed(text);
  if (seed) {
    return {
      ok: true,
      action: "plant",
      label: `种植 ${seed.name} 到地块 ${plots.join(", ")}`,
      commands: [{ item: seed.item, plot: plots }],
    };
  }

  return {
    ok: false,
    message: "没识别到动作。可以说种向日葵、浇水、收获。",
  };
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[，。；、]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isWater(text: string) {
  return /water|浇水|浇|灌溉|洒水/.test(text);
}

function isHarvest(text: string) {
  return /harvest|reap|收获|收割|采摘|摘/.test(text);
}

function parseSeed(text: string): { item: number; name: string } | null {
  if (/sunflower|向日葵|葵花/.test(text)) return { item: ITEM.sunflower, name: "sunflower" };
  if (/daisy|雏菊|小雏菊/.test(text)) return { item: ITEM.daisy, name: "daisy" };
  if (/rose|玫瑰/.test(text)) return { item: ITEM.rose, name: "rose" };
  if (/special|secret|edge gallery|gallery|特殊|秘密|隐藏/.test(text)) {
    return { item: ITEM.special, name: "special" };
  }
  return null;
}

function parsePlots(text: string) {
  const plots = new Set<number>();

  const add = (items: number[]) => {
    items.forEach((plot) => {
      plots.add(plot);
    });
  };

  if (/all|every|全部|所有|每个|全体/.test(text)) add([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  if (/top row|first row|row one|上排|顶部|第一行|第1行|一行/.test(text)) add([1, 2, 3]);
  if (/middle row|second row|row two|中排|中间行|第二行|第2行|二行/.test(text)) add([4, 5, 6]);
  if (/bottom row|third row|row three|下排|底部|第三行|第3行|三行/.test(text)) add([7, 8, 9]);
  if (/left column|first column|左列|左边|第一列|第1列/.test(text)) add([1, 4, 7]);
  if (/middle column|center column|中列|中间列|第二列|第2列/.test(text)) add([2, 5, 8]);
  if (/right column|third column|右列|右边|第三列|第3列/.test(text)) add([3, 6, 9]);
  if (/center|centre|中央|正中|中间/.test(text)) add([5]);
  if (/corner|角落|四角/.test(text)) add([1, 3, 7, 9]);

  for (const match of text.matchAll(/(?:plot|plots|地块|格子|格|块|第)\s*([1-9])/g)) {
    plots.add(Number(match[1]));
  }

  for (const match of text.matchAll(/([1-9])\s*(?:号|格|块|地)/g)) {
    plots.add(Number(match[1]));
  }

  const chineseNumbers: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  for (const match of text.matchAll(/(?:第)?([一二三四五六七八九])(?:号|格|块|地块)/g)) {
    plots.add(chineseNumbers[match[1]]);
  }

  return Array.from(plots).sort((a, b) => a - b);
}

declare global {
  interface Window {
    tinyGarden?: {
      runCommands: (commands: string) => void;
      showHelp?: () => void;
      showTutorial?: () => void;
      unlockAll?: () => void;
    };
  }
}
