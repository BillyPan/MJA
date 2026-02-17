
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

// --- 手牌分解邏輯 ---
interface HandStructure {
  sets: { type: 'shunsu' | 'kotsu'; tiles: Tile[] }[];
  pair: Tile[];
}

/**
 * 嘗試將手牌分解成面子和雀頭
 * 這是精確判定役種（如平和、一盃口）的唯一方法
 */
const decomposeHand = (counts: Record<string, number>, allTiles: Tile[]): HandStructure[] => {
  const structures: HandStructure[] = [];
  const findTile = (type: string, val: number) => allTiles.find(t => t.type === type && t.value === val);

  const backtrack = (currentCounts: Record<string, number>, sets: { type: 'shunsu' | 'kotsu'; tiles: Tile[] }[], pair: Tile[] | null) => {
    const keys = Object.keys(currentCounts).filter(k => currentCounts[k] > 0).sort();
    
    if (keys.length === 0) {
      if (pair) structures.push({ sets, pair });
      return;
    }

    const key = keys[0];
    const type = key[0] as TileType;
    const val = parseInt(key.slice(1));

    // 1. 嘗試做雀頭
    if (!pair && currentCounts[key] >= 2) {
      const t = findTile(type, val)!;
      currentCounts[key] -= 2;
      backtrack({ ...currentCounts }, [...sets], [t, t]);
      currentCounts[key] += 2;
    }

    // 2. 嘗試做刻子
    if (currentCounts[key] >= 3) {
      const t = findTile(type, val)!;
      currentCounts[key] -= 3;
      backtrack({ ...currentCounts }, [...sets, { type: 'kotsu', tiles: [t, t, t] }], pair);
      currentCounts[key] += 3;
    }

    // 3. 嘗試做順子
    if (type !== 'z' && val <= 7) {
      const k1 = `${type}${val + 1}`, k2 = `${type}${val + 2}`;
      if (currentCounts[k1] > 0 && currentCounts[k2] > 0) {
        currentCounts[key]--; currentCounts[k1]--; currentCounts[k2]--;
        backtrack({ ...currentCounts }, [...sets, { type: 'shunsu', tiles: [findTile(type, val)!, findTile(type, val+1)!, findTile(type, val+2)!] }], pair);
        currentCounts[key]++; currentCounts[k1]++; currentCounts[k2]++;
      }
    }
  };

  backtrack({ ...counts }, [], null);
  return structures;
};

export const checkWin = (hand: Tile[], melds: Meld[] = []): boolean => {
  const totalSlots = hand.length + melds.length * 3;
  if (totalSlots !== 14) return false;

  const counts = getCounts(hand);
  
  // 七對子特判
  if (melds.length === 0) {
    const vals = Object.values(counts);
    if (vals.length === 7 && vals.every(v => v === 2)) return true;
  }
  
  // 國士無雙特判
  if (melds.length === 0 && isKokushi(hand)) return true;

  return decomposeHand(counts, hand).length > 0;
};

const isKokushi = (hand: Tile[]): boolean => {
  const terminals = ['m1', 'm9', 'p1', 'p9', 's1', 's9', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'];
  const handKeys = new Set(hand.map(t => `${t.type}${t.value}`));
  return terminals.every(t => handKeys.has(t)) && handKeys.size === 13;
};

export const checkOwnTurnKan = (hand: Tile[], melds: Meld[]): Tile | null => {
  const counts = getCounts(hand);
  for (const key in counts) {
    if (counts[key] === 4) return hand.find(t => `${t.type}${t.value}` === key) || null;
  }
  return null;
};

export const getWaitingTiles = (hand: Tile[], melds: Meld[]): string[] => {
  const waiting: string[] = [];
  const types: TileType[] = ['m', 'p', 's', 'z'];
  for (const t of types) {
    const maxVal = (t === 'z' ? 7 : 9);
    for (let v = 1; v <= maxVal; v++) {
      if (checkWin([...hand, { id: 'test', type: t, value: v }], melds)) {
        waiting.push(`${t}${v}`);
      }
    }
  }
  return waiting;
};

export const isFuriten = (discards: Tile[], waitingTiles: string[]): boolean => {
  return discards.some(d => waitingTiles.includes(`${d.type}${d.value}`));
};

export const calculateDora = (hand: Tile[], melds: Meld[], indicator: Tile | null): number => {
  if (!indicator) return 0;
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  let targetType = indicator.type;
  let targetValue = indicator.value + 1;
  if (targetType === 'z') {
    if (indicator.value <= 4) { if (targetValue > 4) targetValue = 1; } 
    else { if (targetValue > 7) targetValue = 5; }
  } else { if (targetValue > 9) targetValue = 1; }
  return allTiles.filter(t => t.type === targetType && t.value === targetValue).length;
};

export const calculateFinalScore = (
  hand: Tile[], 
  melds: Meld[], 
  isTsumo: boolean, 
  isReach: boolean, 
  doraIndicator: Tile | null,
  isDealer: boolean = false
): WinningResult | null => {
  if (!checkWin(hand, melds)) return null;
  
  const yakuList = evaluateYaku(hand, melds, isReach, isTsumo);
  if (yakuList.length === 0) return null;

  const doraCount = calculateDora(hand, melds, doraIndicator);
  const yakuFan = yakuList.reduce((sum, y) => sum + y.fan, 0);
  const totalFan = yakuFan + doraCount;
  
  let fu = 30; 
  if (melds.length === 0 && !isTsumo) fu = 40;
  else if (isTsumo) fu = 20;
  if (yakuList.some(y => y.name === '七對子')) fu = 25;

  let points = 0;
  if (totalFan >= 13) points = 32000;
  else if (totalFan >= 11) points = 24000;
  else if (totalFan >= 8) points = 16000;
  else if (totalFan >= 6) points = 12000;
  else if (totalFan >= 5 || (totalFan === 4 && fu >= 40) || (totalFan === 3 && fu >= 70)) points = 8000;
  else {
    const baseScore = fu * Math.pow(2, totalFan + 2);
    points = Math.ceil((baseScore * 4) / 100) * 100;
  }

  if (isDealer) points = Math.ceil((points * 1.5) / 100) * 100;

  const displayYaku = [...yakuList];
  if (doraCount > 0) displayYaku.push({ name: '懸賞牌 (Dora)', fan: doraCount });

  return { winner: 'player', yaku: displayYaku, doraCount, fan: totalFan, fu, points, hand, melds, isTsumo };
};

const evaluateYaku = (hand: Tile[], melds: Meld[], isReach: boolean, isTsumo: boolean): YakuResult[] => {
  const yaku: YakuResult[] = [];
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  const counts = getCounts(allTiles);
  const isMenzen = melds.length === 0;

  // 1. 基礎役
  if (isReach) yaku.push({ name: '立直', fan: 1 });
  if (isTsumo && isMenzen) yaku.push({ name: '門前自摸', fan: 1 });
  if (allTiles.every(t => !isTerminalOrHonor(t))) yaku.push({ name: '斷么九', fan: 1 });
  
  // 役牌
  if ((counts['z5'] || 0) >= 3) yaku.push({ name: '役牌：白', fan: 1 });
  if ((counts['z6'] || 0) >= 3) yaku.push({ name: '役牌：發', fan: 1 });
  if ((counts['z7'] || 0) >= 3) yaku.push({ name: '役牌：中', fan: 1 });

  // 2. 顏色役 (修正處)
  const suits = new Set(allTiles.filter(t => t.type !== 'z').map(t => t.type));
  const hasHonors = allTiles.some(t => t.type === 'z');

  if (suits.size === 1) {
    if (!hasHonors) {
      yaku.push({ name: '清一色', fan: isMenzen ? 6 : 5 });
    } else {
      yaku.push({ name: '混一色', fan: isMenzen ? 3 : 2 });
    }
  } else if (suits.size === 0 && hasHonors) {
    yaku.push({ name: '字一色', fan: 13 });
  }

  // 3. 結構役 (基於手牌分解)
  const structures = decomposeHand(getCounts(hand), hand);
  const meldSets = melds.map(m => ({ type: m.type === 'chi' ? 'shunsu' : 'kotsu' as any, tiles: m.tiles }));
  
  let bestStructureYaku: YakuResult[] = [];
  let maxFan = -1;

  for (const struct of structures) {
    const currentYaku: YakuResult[] = [];
    const allSets = [...struct.sets, ...meldSets];
    
    // 對對和
    if (allSets.every(s => s.type === 'kotsu')) currentYaku.push({ name: '對對和', fan: 2 });
    
    // 一氣通貫
    for (const s of ['m', 'p', 's']) {
      const has = (start: number) => allSets.some(set => set.type === 'shunsu' && set.tiles[0].type === s && set.tiles[0].value === start);
      if (has(1) && has(4) && has(7)) currentYaku.push({ name: '一氣通貫', fan: isMenzen ? 2 : 1 });
    }

    // 三色同順
    for (let v = 1; v <= 7; v++) {
      const has = (s: string) => allSets.some(set => set.type === 'shunsu' && set.tiles[0].type === s && set.tiles[0].value === v);
      if (has('m') && has('p') && has('s')) currentYaku.push({ name: '三色同順', fan: isMenzen ? 2 : 1 });
    }

    // 四暗刻 / 三暗刻
    const ankouCount = struct.sets.filter(s => s.type === 'kotsu').length;
    if (ankouCount === 4) currentYaku.push({ name: '四暗刻', fan: 13 });
    else if (ankouCount === 3) currentYaku.push({ name: '三暗刻', fan: 2 });

    const fan = currentYaku.reduce((a, b) => a + b.fan, 0);
    if (fan > maxFan) {
      maxFan = fan;
      bestStructureYaku = currentYaku;
    }
  }

  yaku.push(...bestStructureYaku);

  // 4. 特殊役
  if (isMenzen && Object.values(counts).filter(v => v === 2).length === 7) yaku.push({ name: '七對子', fan: 2 });
  if (isKokushi(hand)) yaku.push({ name: '國士無雙', fan: 13 });

  // 役滿檢查: 大三元
  if ((counts['z5'] || 0) >= 3 && (counts['z6'] || 0) >= 3 && (counts['z7'] || 0) >= 3) {
    yaku.push({ name: '大三元', fan: 13 });
  }

  // 移除重複（如果有）並確保役種唯一性
  const uniqueYaku: YakuResult[] = [];
  const seen = new Set();
  for (const y of yaku) {
    if (!seen.has(y.name)) {
      uniqueYaku.push(y);
      seen.add(y.name);
    }
  }

  return uniqueYaku;
};

export const getBestDiscard = (hand: Tile[], melds: Meld[], difficulty: number): number => {
  const counts = getCounts(hand);
  const scores = hand.map((t, idx) => {
    let score = 0;
    const key = `${t.type}${t.value}`;
    const tempHand = hand.filter((_, i) => i !== idx);
    const waiting = getWaitingTiles(tempHand, melds);
    if (waiting.length > 0) score += 1000 * waiting.length;
    if (counts[key] >= 3) score += 200;
    else if (counts[key] === 2) score += 80;
    if (t.type === 'z') { if (counts[key] === 1) score -= 150; } 
    else {
      if (t.value === 1 || t.value === 9) score -= 50;
      const v = t.value;
      const has = (val: number) => hand.some(x => x.type === t.type && x.value === val);
      if (has(v-1) || has(v+1)) score += 40;
      if (has(v-2) || has(v+2)) score += 15;
    }
    score += (Math.random() - 0.5) * (50 / difficulty);
    return { idx, score };
  });
  scores.sort((a, b) => b.score - a.score); 
  return scores[scores.length - 1].idx;
};

export const canPon = (hand: Tile[], tile: Tile): boolean => hand.filter(t => t.type === tile.type && t.value === tile.value).length >= 2;
export const canKan = (hand: Tile[], tile: Tile): boolean => hand.filter(t => t.type === tile.type && t.value === tile.value).length >= 3;
export const canChi = (hand: Tile[], tile: Tile): boolean => {
  if (tile.type === 'z') return false;
  const v = tile.value, t = tile.type;
  const has = (val: number) => hand.some(x => x.type === t && x.value === val);
  return (v >= 3 && has(v-2) && has(v-1)) || (v >= 2 && v <= 8 && has(v-1) && has(v+1)) || (v <= 7 && has(v+1) && has(v+2));
};
