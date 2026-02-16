
import { Tile, TileType, Meld } from '../types';

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

// 核心胡牌檢查：使用更高效的遞迴與剪枝
export const checkWin = (hand: Tile[], melds: Meld[] = []): boolean => {
  const totalTiles = hand.length + melds.length * 3;
  if (totalTiles !== 14) return false;
  
  const counts = getCounts(hand);

  // 1. 七對子
  if (melds.length === 0) {
    const values = Object.values(counts);
    if (values.length === 7 && values.every(v => v === 2)) return true;
  }

  // 2. 國士無雙
  if (melds.length === 0 && isKokushi(hand)) return true;

  // 3. 一般型 (4面子 + 1雀頭)
  // 遍歷所有可能的雀頭
  for (const key in counts) {
    if (counts[key] >= 2) {
      const copy = { ...counts };
      copy[key] -= 2;
      if (canFormSets(copy)) return true;
    }
  }

  return false;
};

const isKokushi = (hand: Tile[]): boolean => {
  const terminals = ['m1', 'm9', 'p1', 'p9', 's1', 's9', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'];
  const handKeys = new Set(hand.map(t => `${t.type}${t.value}`));
  if (handKeys.size < 13) return false;
  return terminals.every(t => handKeys.has(t));
};

const canFormSets = (counts: Record<string, number>): boolean => {
  const keys = Object.keys(counts).filter(k => counts[k] > 0).sort();
  if (keys.length === 0) return true;

  const key = keys[0];
  // 嘗試刻子
  if (counts[key] >= 3) {
    counts[key] -= 3;
    if (canFormSets(counts)) return true;
    counts[key] += 3;
  }

  // 嘗試順子
  const type = key[0];
  const val = parseInt(key.slice(1));
  if (type !== 'z' && val <= 7) {
    const n1 = `${type}${val + 1}`;
    const n2 = `${type}${val + 2}`;
    if (counts[n1] > 0 && counts[n2] > 0) {
      counts[key]--;
      counts[n1]--;
      counts[n2]--;
      if (canFormSets(counts)) return true;
      counts[key]++;
      counts[n1]++;
      counts[n2]++;
    }
  }

  return false;
};

export const evaluateHand = (hand: Tile[], melds: Meld[] = [], isReach: boolean = false): string[] => {
  const yaku: string[] = [];
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  const counts = getCounts(allTiles);

  // 役滿判定
  const isDaisushi = ['z1', 'z2', 'z3', 'z4'].every(k => (counts[k] || 0) >= 3);
  if (isDaisushi) yaku.push("大四喜 (役滿)");

  const isSuanko = melds.length === 0 && Object.values(getCounts(hand)).filter(v => v >= 3).length === 4;
  if (isSuanko) yaku.push("四暗刻 (役滿)");

  // 一般役
  if (melds.length === 0) {
    const handCounts = getCounts(hand);
    if (Object.values(handCounts).filter(v => v === 2).length === 7) yaku.push("七對子");
    
    // 一盃口判定 (門前限定)
    if (yaku.indexOf("七對子") === -1) {
      const sequences: string[] = [];
      const tempCounts = { ...handCounts };
      // 提取所有順子
      for (const t of ['m', 'p', 's']) {
        for (let v = 1; v <= 7; v++) {
          while (tempCounts[`${t}${v}`] > 0 && tempCounts[`${t}${v+1}`] > 0 && tempCounts[`${t}${v+2}`] > 0) {
            sequences.push(`${t}${v}${v+1}${v+2}`);
            tempCounts[`${t}${v}`]--;
            tempCounts[`${t}${v+1}`]--;
            tempCounts[`${t}${v+2}`]--;
          }
        }
      }
      const seqCounts: Record<string, number> = {};
      sequences.forEach(s => seqCounts[s] = (seqCounts[s] || 0) + 1);
      if (Object.values(seqCounts).some(v => v >= 2)) yaku.push("一盃口");
    }
  }

  const suitTypes = new Set(allTiles.map(t => t.type));
  if (suitTypes.size === 1 && !suitTypes.has('z')) yaku.push("清一色");
  if (isReach) yaku.push("立直");

  if (yaku.length === 0) yaku.push("平胡");
  return yaku;
};

export const canPon = (hand: Tile[], tile: Tile): boolean => {
  return hand.filter(t => t.type === tile.type && t.value === tile.value).length >= 2;
};

export const canChi = (hand: Tile[], tile: Tile): boolean => {
  if (tile.type === 'z') return false;
  const v = tile.value;
  const t = tile.type;
  const has = (val: number) => hand.some(x => x.type === t && x.value === val);
  return (v >= 3 && has(v - 2) && has(v - 1)) || 
         (v >= 2 && v <= 8 && has(v - 1) && has(v + 1)) || 
         (v <= 7 && has(v + 1) && has(v + 2));
};

export const canKan = (hand: Tile[], tile: Tile): boolean => {
  return hand.filter(t => t.type === tile.type && t.value === tile.value).length >= 3;
};

// 聽牌檢查：加入簡單快取與提早中斷
export const checkTenpai = (hand: Tile[], melds: Meld[] = []): boolean => {
  if (hand.length + melds.length * 3 !== 13) return false;
  
  const types: TileType[] = ['m', 'p', 's', 'z'];
  for (const type of types) {
    const maxV = type === 'z' ? 7 : 9;
    for (let v = 1; v <= maxV; v++) {
      if (checkWin([...hand, { id: 'temp', type, value: v }], melds)) return true;
    }
  }
  return false;
};
