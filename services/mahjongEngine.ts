
import { Tile, TileType, Meld, YakuResult, WinningResult } from '../types';

export const sortHand = (hand: Tile[]): Tile[] => {
  return [...hand].sort((a, b) => {
    if (a.type !== b.type) {
      const order = { m: 1, p: 2, s: 3, z: 4 };
      return order[a.type] - order[b.type];
    }
    return a.value - b.value;
  });
};

const getCounts = (tiles: Tile[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  tiles.forEach(t => {
    const key = `${t.type}${t.value}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
};

const isTerminalOrHonor = (t: Tile) => t.type === 'z' || t.value === 1 || t.value === 9;

// --- 核心：嚴謹的手牌分解判定 ---
const canFormSets = (counts: Record<string, number>, setsNeeded: number): boolean => {
  const keys = Object.keys(counts).filter(k => counts[k] > 0).sort();
  if (keys.length === 0) return setsNeeded === 0;

  const key = keys[0];
  const type = key[0];
  const val = parseInt(key.slice(1));

  // 1. 嘗試組成刻子
  if (counts[key] >= 3) {
    counts[key] -= 3;
    if (canFormSets(counts, setsNeeded - 1)) return true;
    counts[key] += 3;
  }

  // 2. 嘗試組成順子
  if (type !== 'z' && val <= 7) {
    const k2 = `${type}${val + 1}`;
    const k3 = `${type}${val + 2}`;
    if (counts[k2] > 0 && counts[k3] > 0) {
      counts[key]--; counts[k2]--; counts[k3]--;
      if (canFormSets(counts, setsNeeded - 1)) return true;
      counts[key]++; counts[k2]++; counts[k3]++;
    }
  }

  return false;
};

export const checkWin = (hand: Tile[], melds: Meld[] = []): boolean => {
  const totalTiles = hand.length + melds.length * 3;
  if (totalTiles !== 14) return false;

  const counts = getCounts(hand);

  // 七對子
  if (melds.length === 0) {
    const pairs = Object.values(counts).filter(v => v === 2).length;
    if (pairs === 7) return true;
    if (isKokushi(hand)) return true;
  }

  // 標準形
  for (const key in counts) {
    if (counts[key] >= 2) {
      const nextCounts = { ...counts };
      nextCounts[key] -= 2;
      if (canFormSets(nextCounts, 4 - melds.length)) return true;
    }
  }

  return false;
};

const isKokushi = (hand: Tile[]): boolean => {
  const terminals = ['m1', 'm9', 'p1', 'p9', 's1', 's9', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'];
  const handKeys = new Set(hand.map(t => `${t.type}${t.value}`));
  return terminals.every(t => handKeys.has(t)) && handKeys.size === 13;
};

export const calculateShanten = (hand: Tile[], melds: Meld[]): number => {
  const counts = getCounts(hand);
  let minShanten = 8;
  const countPotential = (currentCounts: Record<string, number>) => {
    let sets = 0;
    let taatsu = 0;
    const keys = Object.keys(currentCounts).sort();
    keys.forEach(k => {
      const type = k[0];
      const val = parseInt(k.slice(1));
      while (currentCounts[k] >= 3) { sets++; currentCounts[k] -= 3; }
      if (type !== 'z') {
        while (currentCounts[k] > 0 && currentCounts[`${type}${val+1}`] > 0 && currentCounts[`${type}${val+2}`] > 0) {
          sets++; currentCounts[k]--; currentCounts[`${type}${val+1}`]--; currentCounts[`${type}${val+2}`]--;
        }
      }
    });
    keys.forEach(k => {
      const type = k[0];
      const val = parseInt(k.slice(1));
      if (currentCounts[k] >= 2) { taatsu++; currentCounts[k] -= 2; }
      else if (type !== 'z') {
        if (currentCounts[`${type}${val+1}`] > 0) { taatsu++; currentCounts[k]--; currentCounts[`${type}${val+1}`]--; }
        else if (currentCounts[`${type}${val+2}`] > 0) { taatsu++; currentCounts[k]--; currentCounts[`${type}${val+2}`]--; }
      }
    });
    return { sets, taatsu };
  };

  for (const key in counts) {
    if (counts[key] >= 2) {
      const tempCounts = { ...counts };
      tempCounts[key] -= 2;
      const { sets, taatsu } = countPotential(tempCounts);
      const s = 8 - (sets + melds.length) * 2 - taatsu - 1;
      if (s < minShanten) minShanten = s;
    }
  }
  return Math.max(-1, minShanten);
};

const CPU_WEIGHTS: Record<number, any> = {
  1: { W_shanten: 80, W_ukeire: 5, W_plan: 5, W_isolated: 5, W_break: 5, W_risk: 5 },
  2: { W_shanten: 90, W_ukeire: 7, W_plan: 6, W_isolated: 6, W_break: 4, W_risk: 4 },
  3: { W_shanten: 85, W_ukeire: 5, W_plan: 6, W_isolated: 5, W_break: 6, W_risk: 12 },
  4: { W_shanten: 95, W_ukeire: 6, W_plan: 8, W_isolated: 6, W_break: 12, W_risk: 8 },
  5: { W_shanten: 100, W_ukeire: 7, W_plan: 15, W_isolated: 6, W_break: 10, W_risk: 8 },
  6: { W_shanten: 105, W_ukeire: 10, W_plan: 10, W_isolated: 7, W_break: 8, W_risk: 8 },
  7: { W_shanten: 110, W_ukeire: 11, W_plan: 12, W_isolated: 8, W_break: 8, W_risk: 10 },
  8: { W_shanten: 115, W_ukeire: 12, W_plan: 12, W_isolated: 8, W_break: 7, W_risk: 15 },
  9: { W_shanten: 130, W_ukeire: 15, W_plan: 15, W_isolated: 12, W_break: 3, W_risk: 2 },
};

export const getBestDiscard = (hand: Tile[], melds: Meld[], difficulty: number, playerDiscards: Tile[] = [], isPlayerReach: boolean = false): number => {
  const weights = CPU_WEIGHTS[difficulty] || CPU_WEIGHTS[1];
  const currentShanten = calculateShanten(hand, melds);
  const results = hand.map((targetTile, idx) => {
    let score = 0;
    const tempHand = hand.filter((_, i) => i !== idx);
    const newShanten = calculateShanten(tempHand, melds);
    if (newShanten <= currentShanten) score += weights.W_shanten;
    const waiters = getWaitingTiles(tempHand, melds);
    score += waiters.length * weights.W_ukeire;
    const isSafe = playerDiscards.some(d => d.type === targetTile.type && d.value === targetTile.value);
    if (isSafe) score += weights.W_risk;
    return { idx, score, shanten: newShanten };
  });
  results.sort((a, b) => b.score - a.score);
  return results[0].idx;
};

export const getWaitingTiles = (hand: Tile[], melds: Meld[]): string[] => {
  const waiting: string[] = [];
  const types: TileType[] = ['m', 'p', 's', 'z'];
  for (const t of types) {
    const max = t === 'z' ? 7 : 9;
    for (let v = 1; v <= max; v++) {
      if (checkWin([...hand, { id: 'temp', type: t, value: v }], melds)) {
        waiting.push(`${t}${v}`);
      }
    }
  }
  return waiting;
};

export const calculateFinalScore = (hand: Tile[], melds: Meld[], isTsumo: boolean, isReach: boolean, indicator: Tile | null, isDealer: boolean = false, isSkill: boolean = false): WinningResult | null => {
  // 如果是技能胡牌，不需要 checkWin 判定（因為技能已經選好牌了），但為了安全我們還是呼叫
  if (!isSkill && !checkWin(hand, melds)) return null;

  const yaku = evaluateYaku(hand, melds, isReach, isTsumo);
  
  // 街機技能強制胡牌
  if (isSkill) {
    yaku.push({ name: "絕技：必殺自摸", fan: 13 });
  }

  if (yaku.length === 0) return null;

  const dora = calculateDora(hand, melds, indicator);
  const totalFan = yaku.reduce((s, y) => s + y.fan, 0) + dora;
  let fu = (yaku.some(y => y.name === '七對子')) ? 25 : (isTsumo ? 20 : 30);

  let points = 0;
  if (totalFan >= 13) points = 32000;
  else if (totalFan >= 11) points = 24000;
  else if (totalFan >= 8) points = 16000;
  else if (totalFan >= 6) points = 12000;
  else if (totalFan >= 5) points = 8000;
  else {
    const base = fu * Math.pow(2, totalFan + 2);
    points = Math.ceil((base * 4) / 100) * 100;
  }
  if (isDealer) points = Math.ceil((points * 1.5) / 100) * 100;

  return { winner: 'player', yaku, doraCount: dora, fan: totalFan, fu, points, hand, melds, isTsumo };
};

const evaluateYaku = (hand: Tile[], melds: Meld[], isReach: boolean, isTsumo: boolean): YakuResult[] => {
  const yaku: YakuResult[] = [];
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  const counts = getCounts(allTiles);
  const isMenzen = melds.length === 0;

  if (isReach) yaku.push({ name: '立直', fan: 1 });
  if (isTsumo && isMenzen) yaku.push({ name: '門前自摸', fan: 1 });
  if (allTiles.every(t => !isTerminalOrHonor(t))) yaku.push({ name: '斷么九', fan: 1 });
  if (counts['z5'] >= 3) yaku.push({ name: '役牌：白', fan: 1 });
  if (counts['z6'] >= 3) yaku.push({ name: '役牌：發', fan: 1 });
  if (counts['z7'] >= 3) yaku.push({ name: '役牌：中', fan: 1 });
  
  const suits = new Set(allTiles.filter(t => t.type !== 'z').map(t => t.type));
  const hasHonor = allTiles.some(t => t.type === 'z');
  if (suits.size === 1) {
    if (!hasHonor) yaku.push({ name: '清一色', fan: isMenzen ? 6 : 5 });
    else yaku.push({ name: '混一色', fan: isMenzen ? 3 : 2 });
  }

  if (isMenzen && Object.values(getCounts(hand)).filter(v => v === 2).length === 7) yaku.push({ name: '七對子', fan: 2 });
  if (isKokushi(hand)) yaku.push({ name: '國士無雙', fan: 13 });

  // 街機常見的大牌
  if (counts['z1'] >= 3 && counts['z2'] >= 3 && counts['z3'] >= 3 && counts['z4'] >= 3) yaku.push({ name: "大四喜", fan: 13 });

  return yaku;
};

export const calculateDora = (hand: Tile[], melds: Meld[], indicator: Tile | null): number => {
  if (!indicator) return 0;
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  let targetType = indicator.type;
  let targetVal = indicator.value + 1;
  if (targetType === 'z') {
    if (indicator.value <= 4) targetVal = indicator.value === 4 ? 1 : indicator.value + 1;
    else targetVal = indicator.value === 7 ? 5 : indicator.value + 1;
  } else if (targetVal > 9) targetVal = 1;
  return allTiles.filter(t => t.type === targetType && t.value === targetVal).length;
};

export const checkOwnTurnKan = (hand: Tile[], melds: Meld[]): Tile | null => {
  const counts = getCounts(hand);
  for (const k in counts) if (counts[k] === 4) return hand.find(t => `${t.type}${t.value}` === k) || null;
  // 檢查加槓
  for (const m of melds) {
    if (m.type === 'pon') {
      const match = hand.find(t => t.type === m.tiles[0].type && t.value === m.tiles[0].value);
      if (match) return match;
    }
  }
  return null;
};

export const isFuriten = (discards: Tile[], waiting: string[]): boolean => discards.some(d => waiting.includes(`${d.type}${d.value}`));
export const canPon = (hand: Tile[], tile: Tile): boolean => hand.filter(t => t.type === tile.type && t.value === tile.value).length >= 2;
export const canKan = (hand: Tile[], tile: Tile): boolean => hand.filter(t => t.type === tile.type && t.value === tile.value).length >= 3;
export const canChi = (hand: Tile[], tile: Tile): boolean => {
  if (tile.type === 'z') return false;
  const v = tile.value, t = tile.type;
  const has = (val: number) => hand.some(x => x.type === t && x.value === val);
  return (v >= 3 && has(v-2) && has(v-1)) || (v >= 2 && v <= 8 && has(v-1) && has(v+1)) || (v <= 7 && has(v+1) && has(v+2));
};
