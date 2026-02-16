
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

export const checkWin = (hand: Tile[], melds: Meld[] = []): boolean => {
  const totalTiles = hand.length + melds.length * 3;
  if (totalTiles !== 14) return false;
  const counts = getCounts(hand);

  // Seven Pairs (Chitsu)
  if (melds.length === 0) {
    const vals = Object.values(counts);
    if (vals.length === 7 && vals.every(v => v === 2)) return true;
  }

  // Kokushi Musou
  if (melds.length === 0 && isKokushi(hand)) return true;

  // Standard form: 4 sets + 1 pair
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
  return terminals.every(t => handKeys.has(t)) && handKeys.size === 13;
};

const canFormSets = (counts: Record<string, number>): boolean => {
  const keys = Object.keys(counts).filter(k => counts[k] > 0).sort();
  if (keys.length === 0) return true;
  const key = keys[0];

  // Triplet
  if (counts[key] >= 3) {
    counts[key] -= 3;
    if (canFormSets(counts)) return true;
    counts[key] += 3;
  }

  // Sequence
  const type = key[0];
  const val = parseInt(key.slice(1));
  if (type !== 'z' && val <= 7) {
    const n1 = `${type}${val + 1}`, n2 = `${type}${val + 2}`;
    if (counts[n1] > 0 && counts[n2] > 0) {
      counts[key]--; counts[n1]--; counts[n2]--;
      if (canFormSets(counts)) return true;
      counts[key]++; counts[n1]++; counts[n2]++;
    }
  }
  return false;
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
  if (yakuList.length === 0) return null; // Must have at least 1 Yaku

  let fan = yakuList.reduce((sum, y) => sum + y.fan, 0);
  const doraCount = calculateDora(hand, melds, doraIndicator);
  const totalFan = fan + doraCount;
  
  // Fu Calculation (Simplified logic for Arcade)
  let fu = 30; 
  if (melds.length === 0 && !isTsumo) fu = 40; // Menzen Ron
  else if (isTsumo) fu = 20; // Simplified tsumo fu
  
  // Special for Seven Pairs
  if (yakuList.some(y => y.name === '七對子')) fu = 25;

  let points = 0;
  if (totalFan >= 13) points = 32000;
  else if (totalFan >= 11) points = 24000;
  else if (totalFan >= 8) points = 16000;
  else if (totalFan >= 6) points = 12000;
  else if (totalFan >= 5 || (totalFan === 4 && fu >= 40)) points = 8000;
  else {
    let base = fu * Math.pow(2, totalFan + 2);
    points = Math.ceil((base * 4) / 100) * 100;
  }

  if (isDealer) points = Math.floor(points * 1.5);

  return {
    winner: 'player', 
    yaku: yakuList,
    doraCount,
    fan: totalFan,
    fu,
    points,
    hand,
    melds,
    isTsumo
  };
};

const evaluateYaku = (hand: Tile[], melds: Meld[], isReach: boolean, isTsumo: boolean): YakuResult[] => {
  const res: YakuResult[] = [];
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  const counts = getCounts(allTiles);
  const isMenzen = melds.length === 0;

  if (isReach) res.push({ name: '立直', fan: 1 });
  if (isTsumo && isMenzen) res.push({ name: '門前清自摸和', fan: 1 });

  // Tanyao
  if (allTiles.every(t => !isTerminalOrHonor(t))) res.push({ name: '斷么九', fan: 1 });

  // Yakuhai
  if ((counts['z5'] || 0) >= 3) res.push({ name: '役牌：白', fan: 1 });
  if ((counts['z6'] || 0) >= 3) res.push({ name: '役牌：發', fan: 1 });
  if ((counts['z7'] || 0) >= 3) res.push({ name: '役牌：中', fan: 1 });

  // Toitoi (All Triplets)
  const setCounts = melds.filter(m => m.type === 'pon' || m.type === 'kan').length + Object.values(getCounts(hand)).filter(v => v >= 3).length;
  if (setCounts === 4) res.push({ name: '對對和', fan: 2 });

  // Seven Pairs
  if (isMenzen && Object.values(getCounts(hand)).filter(v => v === 2).length === 7) res.push({ name: '七對子', fan: 2 });

  // Honitsu / Chinitsu
  const suits = new Set(allTiles.map(t => t.type).filter(s => s !== 'z'));
  const hasHonors = allTiles.some(t => t.type === 'z');
  if (suits.size === 1) {
    if (hasHonors) res.push({ name: '混一色', fan: isMenzen ? 3 : 2 });
    else res.push({ name: '清一色', fan: isMenzen ? 6 : 5 });
  }

  // Yakuman
  if (['z1', 'z2', 'z3', 'z4'].every(k => (counts[k] || 0) >= 3)) res.push({ name: '大四喜', fan: 13 });
  if (isMenzen && Object.values(getCounts(hand)).filter(v => v >= 3).length === 4) res.push({ name: '四暗刻', fan: 13 });

  return res;
};

const calculateDora = (hand: Tile[], melds: Meld[], indicator: Tile | null): number => {
  if (!indicator) return 0;
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  let tType = indicator.type, tVal = indicator.value + 1;
  if (tType !== 'z' && tVal > 9) tVal = 1;
  if (tType === 'z') {
    if (indicator.value <= 4 && tVal > 4) tVal = 1;
    if (indicator.value > 4 && tVal > 7) tVal = 5;
  }
  return allTiles.filter(t => t.type === tType && t.value === tVal).length;
};

export const checkTenpai = (hand: Tile[], melds: Meld[] = []): boolean => {
  const types: TileType[] = ['m', 'p', 's', 'z'];
  for (const t of types) {
    for (let v = 1; v <= (t === 'z' ? 7 : 9); v++) {
      const testHand = [...hand, { id: 't', type: t, value: v }];
      if (checkWin(testHand, melds)) return true;
    }
  }
  return false;
};

export const getWaitingTiles = (hand: Tile[], melds: Meld[]): string[] => {
  const waiting: string[] = [];
  const types: TileType[] = ['m', 'p', 's', 'z'];
  for (const t of types) {
    for (let v = 1; v <= (t === 'z' ? 7 : 9); v++) {
      if (checkWin([...hand, { id: 't', type: t, value: v }], melds)) {
        waiting.push(`${t}${v}`);
      }
    }
  }
  return waiting;
};

export const isFuriten = (discards: Tile[], waitingTiles: string[]): boolean => {
  return discards.some(d => waitingTiles.includes(`${d.type}${d.value}`));
};

export const canPon = (hand: Tile[], tile: Tile): boolean => hand.filter(t => t.type === tile.type && t.value === tile.value).length >= 2;
export const canKan = (hand: Tile[], tile: Tile): boolean => hand.filter(t => t.type === tile.type && t.value === tile.value).length >= 3;
export const canChi = (hand: Tile[], tile: Tile): boolean => {
  if (tile.type === 'z') return false;
  const v = tile.value, t = tile.type;
  const has = (val: number) => hand.some(x => x.type === t && x.value === val);
  return (v >= 3 && has(v-2) && has(v-1)) || (v >= 2 && v <= 8 && has(v-1) && has(v+1)) || (v <= 7 && has(v+1) && has(v+2));
};
