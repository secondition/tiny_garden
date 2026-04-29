export type GardenCommand = {
  item: number;
  plot: number[];
};

export type GardenAction = "plant" | "water" | "harvest";

export type ParsedInstruction =
  | {
      ok: true;
      action: GardenAction;
      label: string;
      commands: GardenCommand[];
    }
  | {
      ok: false;
      message: string;
    };

export type ExampleCommand = {
  label: string;
  instruction: string;
};

const GARDEN_ITEM = {
  sunflower: 1,
  daisy: 2,
  rose: 3,
  special: 4,
  water: 5,
  harvest: 6,
} as const;

export const EXAMPLE_COMMANDS: ExampleCommand[] = [
  { label: "第一行向日葵", instruction: "在第一行种向日葵" },
  { label: "全部浇水", instruction: "给所有地块浇水" },
  { label: "全部收获", instruction: "收获所有地块" },
];

export function parseGardenInstruction(rawText: string): ParsedInstruction {
  const text = normalize(rawText);
  const plots = parsePlots(text);

  if (plots.length === 0) {
    return {
      ok: false,
      message: "没识别到地块。可以说第一行、左列、全部、5号地块等。",
    };
  }

  if (isHarvest(text)) {
    return {
      ok: true,
      action: "harvest",
      label: `收获地块 ${plots.join(", ")}`,
      commands: [{ item: GARDEN_ITEM.harvest, plot: plots }],
    };
  }

  if (isWater(text)) {
    return {
      ok: true,
      action: "water",
      label: `浇水地块 ${plots.join(", ")}`,
      commands: [{ item: GARDEN_ITEM.water, plot: plots }],
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
  if (/sunflower|向日葵|葵花/.test(text)) {
    return { item: GARDEN_ITEM.sunflower, name: "sunflower" };
  }
  if (/daisy|雏菊|小雏菊/.test(text)) {
    return { item: GARDEN_ITEM.daisy, name: "daisy" };
  }
  if (/rose|玫瑰/.test(text)) {
    return { item: GARDEN_ITEM.rose, name: "rose" };
  }
  if (/special|secret|edge gallery|gallery|特殊|秘密|隐藏/.test(text)) {
    return { item: GARDEN_ITEM.special, name: "special" };
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
  if (/middle row|second row|row two|中排|中间行|第二行|第2行|二行/.test(text)) {
    add([4, 5, 6]);
  }
  if (/bottom row|third row|row three|下排|底部|第三行|第3行|三行/.test(text)) {
    add([7, 8, 9]);
  }
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
