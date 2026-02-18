
import { Tile, TileType, Meld, YakuResult, WinningResult } from '../types';

// ==========================================
// 基礎工具
// ==========================================

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

// ==========================================
// 役滿與絕技生成器
// ==========================================

const createTile = (type: TileType, value: number, idSuffix: string): Tile => ({
  id: `god-${type}${value}-${idSuffix}`,
  type,
  value
});

// 內部使用：生成役滿 (給玩家用，或 CPU 不受限時使用)
const generateYakuman = (): { hand: Tile[], yakuName: string, fan: number } => {
  const yakumanTypes = [
    'Kokushi', 'Chuuren', 'Daisangen', 'Suuankou', 'Tsuuisa', 'Ryuuiisou', 
    'Chinroutou', 'Daisuushii', 'Shousuushii' 
  ];
  
  const selectedType = yakumanTypes[Math.floor(Math.random() * yakumanTypes.length)];
  let hand: Tile[] = [];
  let name = '';
  let fan = 13;

  const getSuuankouShape = () => {
     const tiles: Tile[] = [];
     const chosen: string[] = [];
     while(chosen.length < 5) {
        const t = ['m','p','s','z'][Math.floor(Math.random()*4)] as TileType;
        const v = t === 'z' ? Math.ceil(Math.random()*7) : Math.ceil(Math.random()*9);
        const k = `${t}${v}`;
        if (!chosen.includes(k)) chosen.push(k);
     }
     chosen.forEach((k, idx) => {
         const type = k[0] as TileType;
         const val = parseInt(k.slice(1));
         const count = idx < 4 ? 3 : 2;
         for(let i=0; i<count; i++) tiles.push(createTile(type, val, `${idx}-${i}`));
     });
     return tiles;
  };

  switch (selectedType) {
    case 'Kokushi':
      name = '國士無雙';
      const terminals = [
        {t:'m',v:1}, {t:'m',v:9}, {t:'p',v:1}, {t:'p',v:9}, {t:'s',v:1}, {t:'s',v:9},
        {t:'z',v:1}, {t:'z',v:2}, {t:'z',v:3}, {t:'z',v:4}, {t:'z',v:5}, {t:'z',v:6}, {t:'z',v:7}
      ];
      terminals.forEach((x, i) => hand.push(createTile(x.t as TileType, x.v, `${i}`)));
      const dup = terminals[Math.floor(Math.random() * terminals.length)];
      hand.push(createTile(dup.t as TileType, dup.v, 'dup'));
      break;

    case 'Chuuren':
      name = '九蓮寶燈';
      const suit = (['m', 'p', 's'] as TileType[])[Math.floor(Math.random() * 3)];
      const structure = [1,1,1,2,3,4,5,6,7,8,9,9,9];
      structure.forEach((v, i) => hand.push(createTile(suit, v, `${i}`)));
      const extra = Math.ceil(Math.random() * 9);
      hand.push(createTile(suit, extra, 'extra'));
      break;

    case 'Daisangen':
      name = '大三元';
      [5, 6, 7].forEach((v, idx) => {
          for(let i=0; i<3; i++) hand.push(createTile('z', v, `ds-${idx}-${i}`));
      });
      hand.push(createTile('m', 1, 'f1')); hand.push(createTile('m', 1, 'f2')); hand.push(createTile('m', 1, 'f3'));
      hand.push(createTile('s', 8, 'p1')); hand.push(createTile('s', 8, 'p2')); 
      break;
    
    case 'Tsuuisa':
      name = '字一色';
      const honors = [1,2,3,4,5,6,7].sort(() => Math.random() - 0.5).slice(0, 5);
      honors.forEach((v, idx) => {
          const count = idx < 4 ? 3 : 2;
          for(let i=0; i<count; i++) hand.push(createTile('z', v, `ts-${idx}-${i}`));
      });
      break;

    case 'Ryuuiisou':
      name = '綠一色';
      const greens = [
          {t:'s',v:2}, {t:'s',v:3}, {t:'s',v:4}, {t:'s',v:6}, {t:'s',v:8}, {t:'z',v:6}
      ];
      const chosenG: any[] = [];
      while(chosenG.length < 5) chosenG.push(greens[Math.floor(Math.random()*greens.length)]);
      chosenG.forEach((g, idx) => {
          const count = idx < 4 ? 3 : 2; 
          for(let i=0; i<count; i++) hand.push(createTile(g.t, g.v, `ry-${idx}-${i}`));
      });
      break;

    case 'Chinroutou':
      name = '清老頭';
      const ends = [
          {t:'m',v:1}, {t:'m',v:9}, {t:'p',v:1}, {t:'p',v:9}, {t:'s',v:1}, {t:'s',v:9}
      ];
      const chosenC: any[] = [];
      while(chosenC.length < 5) chosenC.push(ends[Math.floor(Math.random()*ends.length)]);
      chosenC.forEach((g, idx) => {
          const count = idx < 4 ? 3 : 2;
          for(let i=0; i<count; i++) hand.push(createTile(g.t, g.v, `ch-${idx}-${i}`));
      });
      break;

    case 'Daisuushii':
      name = '大四喜';
      fan = 26;
      [1, 2, 3, 4].forEach((v, idx) => {
          for(let i=0; i<3; i++) hand.push(createTile('z', v, `bw-${idx}-${i}`));
      });
      hand.push(createTile('m', 5, 'p1')); hand.push(createTile('m', 5, 'p2'));
      break;

    case 'Shousuushii':
      name = '小四喜';
      const winds = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
      winds.forEach((v, idx) => {
          const count = idx < 3 ? 3 : 2;
          for(let i=0; i<count; i++) hand.push(createTile('z', v, `sw-${idx}-${i}`));
      });
      for(let i=0; i<3; i++) hand.push(createTile('z', 7, `fill-${i}`));
      break;

    default:
      name = '四暗刻';
      hand = getSuuankouShape();
      break;
  }

  return { hand: sortHand(hand), yakuName: name, fan };
};

// 匯出函式：生成絕技手牌 (可指定最高分數限制)
export const generateSpecialHand = (maxPoints?: number): { hand: Tile[], yakuName: string, fan: number } => {
  // 若無限制或限制很高，直接給役滿
  if (maxPoints === undefined || maxPoints >= 32000) {
      return generateYakuman();
  }

  let hand: Tile[] = [];
  let name = '';
  let fan = 1;

  // 根據 maxPoints 決定手牌等級 (假設 CPU 為莊家，莊家點數約為閒家 1.5 倍)
  // 倍滿 24000, 跳滿 18000, 滿貫 12000, 3番 5800, 2番 2900, 1番 1500
  
  if (maxPoints >= 24000) {
      name = '清一色 (倍滿)';
      fan = 8;
      // 構造清一色牌型
      const suit = (['m', 'p', 's'] as TileType[])[Math.floor(Math.random() * 3)];
      [1,1,1,2,3,4,5,6,7,8,9,9,9,5].forEach((v, i) => hand.push(createTile(suit, v, `bm-${i}`)));
  } else if (maxPoints >= 18000) {
      name = '清一色 (跳滿)';
      fan = 6;
      const suit = (['m', 'p', 's'] as TileType[])[Math.floor(Math.random() * 3)];
      [1,2,3, 2,3,4, 5,6,7, 7,8,9, 5,5].forEach((v, i) => hand.push(createTile(suit, v, `hm-${i}`)));
  } else if (maxPoints >= 12000) {
      name = '混一色 (滿貫)';
      fan = 5;
      const suit = (['m', 'p', 's'] as TileType[])[Math.floor(Math.random() * 3)];
      [1,2,3].forEach((v,i) => hand.push(createTile(suit, v, `mn-${i}`)));
      [4,5,6].forEach((v,i) => hand.push(createTile(suit, v, `mn2-${i}`)));
      [7,8,9].forEach((v,i) => hand.push(createTile(suit, v, `mn3-${i}`)));
      [1,1,1].forEach((v,i) => hand.push(createTile('z', 5, `mn4-${i}`))); // 白
      [1,1].forEach((v,i) => hand.push(createTile('z', 6, `mn5-${i}`))); // 發對
  } else if (maxPoints >= 5800) {
      name = '斷么九 (三番)';
      fan = 3;
      // 斷么牌型
      [2,3,4, 2,3,4, 4,5,6, 6,7,8, 5,5].forEach((v, i) => {
         const t = i < 3 ? 'm' : i < 6 ? 'p' : i < 9 ? 's' : i < 12 ? 'm' : 's';
         hand.push(createTile(t as TileType, v, `f3-${i}`));
      });
  } else if (maxPoints >= 2900) {
      name = '斷么九 (二番)';
      fan = 2;
      [2,3,4, 3,4,5, 4,5,6, 5,6,7, 8,8].forEach((v, i) => {
         const t = 'p';
         hand.push(createTile(t, v, `f2-${i}`));
      });
  } else {
      name = '斷么九 (一番)';
      fan = 1;
      [3,4,5, 3,4,5, 3,4,5, 3,4,5, 2,2].forEach((v, i) => {
         const t = 's';
         hand.push(createTile(t, v, `f1-${i}`));
      });
  }

  return { hand: sortHand(hand), yakuName: name, fan };
};

// ==========================================
// 核心演算法：向聽數計算
// ==========================================

const getStandardShanten = (handArr: number[], meldsCount: number): number => {
  let minShanten = 8;
  const search = (depth: number, m: number, t: number, p: number) => {
    const currentScore = 8 - 2 * m - t - p - (meldsCount * 2); 
    if (currentScore >= minShanten && depth > 33) return;

    for (let i = 0; i < 34; i++) {
      if (handArr[i] > 0) {
        if (p === 0 && handArr[i] >= 2) {
          handArr[i] -= 2;
          search(depth + 1, m, t, 1);
          handArr[i] += 2;
        }
        if (handArr[i] >= 3) {
          handArr[i] -= 3;
          search(depth + 1, m + 1, t, p);
          handArr[i] += 3;
        }
        if (i < 27 && i % 9 < 7) {
           if (handArr[i] > 0 && handArr[i+1] > 0 && handArr[i+2] > 0) {
             handArr[i]--; handArr[i+1]--; handArr[i+2]--;
             search(depth + 1, m + 1, t, p);
             handArr[i]++; handArr[i+1]++; handArr[i+2]++;
           }
        }
        return; 
      }
    }

    let taatsu = 0;
    for(let i=0; i<34; i++) {
        if (handArr[i] === 2) taatsu++;
        else if (handArr[i] === 1 && i < 27 && i % 9 < 8 && handArr[i+1] === 1) taatsu++; 
        else if (handArr[i] === 1 && i < 27 && i % 9 < 7 && handArr[i+2] === 1) taatsu++;
    }
    let potentialSets = m + meldsCount;
    let potentialTaatsu = t + taatsu;
    if (potentialSets + potentialTaatsu > 4) potentialTaatsu = 4 - potentialSets;
    
    let shanten = 8 - (potentialSets * 2) - potentialTaatsu - p;
    if (shanten < minShanten) minShanten = shanten;
  };

  search(0, 0, 0, 0);
  return minShanten;
};

const getChitoitsuShanten = (handArr: number[]): number => {
  let pairs = 0;
  for (let i = 0; i < 34; i++) if (handArr[i] >= 2) pairs++;
  return 6 - pairs;
};

const getKokushiShanten = (handArr: number[]): number => {
  const terminals = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  let count = 0;
  let hasPair = false;
  terminals.forEach(idx => {
    if (handArr[idx] > 0) {
      count++;
      if (handArr[idx] >= 2) hasPair = true;
    }
  });
  return 13 - count - (hasPair ? 1 : 0);
};

const tilesToArr = (tiles: Tile[]): number[] => {
  const arr = new Array(34).fill(0);
  tiles.forEach(t => {
    let idx = -1;
    if (t.type === 'm') idx = t.value - 1;
    else if (t.type === 'p') idx = 9 + t.value - 1;
    else if (t.type === 's') idx = 18 + t.value - 1;
    else if (t.type === 'z') idx = 27 + t.value - 1;
    if (idx >= 0) arr[idx]++;
  });
  return arr;
};

export const calculateShanten = (hand: Tile[], melds: Meld[]): number => {
  const handArr = tilesToArr(hand);
  let sStandard = getStandardShanten([...handArr], melds.length);
  if (melds.length === 0) {
    const sChitoi = getChitoitsuShanten(handArr);
    const sKokushi = getKokushiShanten(handArr);
    return Math.min(sStandard, sChitoi, sKokushi);
  }
  return sStandard;
};

// ==========================================
// AI 決策邏輯
// ==========================================

const getEffectiveTileCount = (hand: Tile[], melds: Meld[]): number => {
  const currentShanten = calculateShanten(hand, melds);
  let effectiveCount = 0;
  const types: TileType[] = ['m', 'p', 's', 'z'];
  for (const t of types) {
    const max = t === 'z' ? 7 : 9;
    for (let v = 1; v <= max; v++) {
      const testTile: Tile = { id: 'test', type: t, value: v };
      const newHand = [...hand, testTile];
      if (calculateShanten(newHand, melds) < currentShanten) effectiveCount += 3; 
    }
  }
  return effectiveCount;
};

export const getBestDiscard = (hand: Tile[], melds: Meld[], difficulty: number, playerDiscards: Tile[] = [], isPlayerReach: boolean = false): number => {
  const currentShanten = calculateShanten(hand, melds);
  const results = hand.map((targetTile, idx) => {
    let score = 0;
    const tempHand = hand.filter((_, i) => i !== idx);
    const newShanten = calculateShanten(tempHand, melds);
    
    if (newShanten === currentShanten) score += 5000;
    else if (newShanten > currentShanten) score -= 10000;

    if (score > 0) {
        const effective = getEffectiveTileCount(tempHand, melds);
        score += effective * 10;
    }
    
    if (isTerminalOrHonor(targetTile)) {
        if (targetTile.type === 'z') {
            if (targetTile.value >= 5 || targetTile.value === 1) score -= 20; 
            else score += 100; 
        } else {
            score += 50; 
        }
    } else {
        score -= 50;
    }

    if (isPlayerReach) {
      const isSafe = playerDiscards.some(d => d.type === targetTile.type && d.value === targetTile.value);
      if (isSafe) score += 20000;
      else if (targetTile.type === 'z') score += 5000;
      else if (isTerminalOrHonor(targetTile)) score += 2000;
      else score -= 5000;
    }
    return { idx, score };
  });

  results.sort((a, b) => b.score - a.score);
  return results[0].idx;
};

export const shouldCPUCall = (hand: Tile[], melds: Meld[], tile: Tile, type: 'pon' | 'chi', difficulty: number): boolean => {
  const currentShanten = calculateShanten(hand, melds);
  let tempHand: Tile[] = [];
  if (type === 'pon') {
      let removed = 0;
      tempHand = hand.filter(t => {
          if (removed < 2 && t.type === tile.type && t.value === tile.value) {
              removed++;
              return false;
          }
          return true;
      });
      if (removed < 2) return false;
  } else {
      return false; 
  }
  
  const newMeldsCount = melds.length + 1;
  const newShanten = getStandardShanten(tilesToArr(tempHand), newMeldsCount);
  
  if (type === 'pon' && tile.type === 'z') {
      if (tile.value >= 5) return true;
      if (tile.value === 1) return true;
  }

  if (newShanten === 0 && currentShanten > 0) return true;
  if (newShanten < currentShanten) {
      const isTanyao = tempHand.every(t => !isTerminalOrHonor(t)) && !isTerminalOrHonor(tile);
      if (isTanyao) return true;
      if (Math.random() > 0.5) return true;
  }
  return false;
};

// ==========================================
// 輔助與判定
// ==========================================

export const checkWin = (hand: Tile[], melds: Meld[] = []): boolean => {
  const totalTiles = hand.length + melds.length * 3;
  if (totalTiles !== 14) return false;
  
  const handArr = tilesToArr(hand);
  const standardWin = isStandardWin(handArr, melds.length);
  if (standardWin) return true;
  
  if (melds.length === 0) {
      if (getChitoitsuShanten(handArr) === -1) return true;
      if (getKokushiShanten(handArr) === -1) return true;
  }
  return false;
};

const isStandardWin = (handArr: number[], meldsCount: number): boolean => {
    for(let i=0; i<34; i++) {
        if (handArr[i] >= 2) {
            handArr[i] -= 2;
            if (canFormMelds(handArr, 4 - meldsCount)) {
                handArr[i] += 2;
                return true;
            }
            handArr[i] += 2;
        }
    }
    return false;
};

const canFormMelds = (handArr: number[], count: number): boolean => {
    if (count === 0) return true;
    for(let i=0; i<34; i++) {
        if (handArr[i] > 0) {
            if (handArr[i] >= 3) {
                handArr[i] -= 3;
                if (canFormMelds(handArr, count - 1)) {
                    handArr[i] += 3;
                    return true;
                }
                handArr[i] += 3;
            }
            if (i < 27 && i % 9 < 7 && handArr[i+1] > 0 && handArr[i+2] > 0) {
                handArr[i]--; handArr[i+1]--; handArr[i+2]--;
                if (canFormMelds(handArr, count - 1)) {
                    handArr[i]++; handArr[i+1]++; handArr[i+2]++;
                    return true;
                }
                handArr[i]++; handArr[i+1]++; handArr[i+2]++;
            }
            return false;
        }
    }
    return true;
};

const isValidStructure = (arr: number[], setsNeeded: number): boolean => {
    for (let i = 0; i < 34; i++) {
        if (arr[i] >= 2) {
            arr[i] -= 2;
            if (canFormMelds(arr, setsNeeded)) {
                arr[i] += 2;
                return true;
            }
            arr[i] += 2;
        }
    }
    return false;
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

const isAllSequencesWithPair = (counts: Record<string, number>, pairTileKey: string): boolean => {
  const tempCounts = { ...counts };
  tempCounts[pairTileKey] -= 2;
  const removeSequences = (c: Record<string, number>, setsNeeded: number): boolean => {
    if (setsNeeded === 0) return true;
    const keys = Object.keys(c).filter(k => c[k] > 0).sort();
    if (keys.length === 0) return false;
    const key = keys[0];
    const type = key[0];
    const val = parseInt(key.slice(1));
    if (type === 'z') return false;
    if (val > 7) return false;
    const k2 = `${type}${val + 1}`;
    const k3 = `${type}${val + 2}`;
    if (c[k2] > 0 && c[k3] > 0) {
      c[key]--; c[k2]--; c[k3]--;
      if (removeSequences(c, setsNeeded - 1)) return true;
      c[key]++; c[k2]++; c[k3]++;
    }
    return false;
  };
  return removeSequences(tempCounts, 4);
};

// ==========================================
// 役滿與役判定
// ==========================================

const checkYakuman = (hand: Tile[], melds: Meld[], isMenzen: boolean, isTsumo: boolean): YakuResult[] => {
    const yakumanList: YakuResult[] = [];
    const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
    const counts = getCounts(allTiles);
    const handCounts = getCounts(hand);

    const uniqueKeys = Object.keys(counts);
    const terminals = uniqueKeys.filter(k => {
        const t = k[0]; const v = parseInt(k.slice(1));
        return t === 'z' || v === 1 || v === 9;
    });
    if (isMenzen && uniqueKeys.length === 13 && terminals.length === 13) {
        yakumanList.push({ name: '國士無雙', fan: 13 });
    }

    if (isMenzen) {
        let tri = 0;
        for (const k in handCounts) {
            if (handCounts[k] >= 3) tri++;
        }
        if (tri === 4) {
             if (isTsumo) {
                 yakumanList.push({ name: '四暗刻', fan: 13 });
             } 
        }
    }

    const dragons = ['z5', 'z6', 'z7'];
    const dragonTriplets = dragons.filter(k => counts[k] >= 3).length;
    if (dragonTriplets === 3) {
        yakumanList.push({ name: '大三元', fan: 13 });
    }

    if (Object.keys(counts).every(k => k.startsWith('z'))) {
        yakumanList.push({ name: '字一色', fan: 13 });
    }

    const greens = ['s2', 's3', 's4', 's6', 's8', 'z6'];
    if (Object.keys(counts).every(k => greens.includes(k))) {
        yakumanList.push({ name: '綠一色', fan: 13 });
    }

    const isTerminal = (k: string) => {
        const t = k[0]; const v = parseInt(k.slice(1));
        return t !== 'z' && (v === 1 || v === 9);
    };
    if (Object.keys(counts).every(k => isTerminal(k))) {
         yakumanList.push({ name: '清老頭', fan: 13 });
    }

    const winds = ['z1', 'z2', 'z3', 'z4'];
    const windTriplets = winds.filter(k => counts[k] >= 3).length;
    const windPairs = winds.filter(k => counts[k] >= 2).length;
    if (windTriplets === 4) {
        yakumanList.push({ name: '大四喜', fan: 26 });
    } else if (windTriplets === 3 && windPairs === 4) {
        yakumanList.push({ name: '小四喜', fan: 13 });
    }
    
    if (isMenzen) {
        const suits = new Set(allTiles.map(t => t.type));
        if (suits.size === 1 && !suits.has('z')) {
             const s = [...suits][0];
             if (counts[`${s}1`] >= 3 && counts[`${s}9`] >= 3) {
                 let valid = true;
                 for(let i=2; i<=8; i++) {
                     if (!counts[`${s}${i}`]) valid = false;
                 }
                 if (valid) yakumanList.push({ name: '九蓮寶燈', fan: 13 });
             }
        }
    }

    return yakumanList;
};

const evaluateYaku = (hand: Tile[], melds: Meld[], isReach: boolean, isTsumo: boolean): YakuResult[] => {
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  const counts = getCounts(allTiles);
  const handCounts = getCounts(hand);
  const isMenzen = melds.length === 0;

  const yakuman = checkYakuman(hand, melds, isMenzen, isTsumo);
  if (yakuman.length > 0) return yakuman;

  const yaku: YakuResult[] = [];
  
  if (isReach) yaku.push({ name: '立直', fan: 1 });
  if (isTsumo && isMenzen) yaku.push({ name: '門前自摸', fan: 1 });
  if (allTiles.every(t => !isTerminalOrHonor(t))) yaku.push({ name: '斷么九', fan: 1 });
  
  if (counts['z5'] >= 3) yaku.push({ name: '役牌：白', fan: 1 });
  if (counts['z6'] >= 3) yaku.push({ name: '役牌：發', fan: 1 });
  if (counts['z7'] >= 3) yaku.push({ name: '役牌：中', fan: 1 });
  if (counts['z1'] >= 3) yaku.push({ name: '役牌：東', fan: 1 });
  
  const suits = new Set(allTiles.filter(t => t.type !== 'z').map(t => t.type));
  const hasHonor = allTiles.some(t => t.type === 'z');
  if (suits.size === 1) {
    if (!hasHonor) yaku.push({ name: '清一色', fan: isMenzen ? 6 : 5 });
    else yaku.push({ name: '混一色', fan: isMenzen ? 3 : 2 });
  }
  
  if (isMenzen && Object.values(getCounts(hand)).filter(v => v === 2).length === 7) {
      yaku.push({ name: '七對子', fan: 2 });
      return yaku;
  } 

  for (let startVal = 1; startVal <= 7; startVal++) {
    const suitTypes = ['m', 'p', 's'];
    const tempArr = tilesToArr(hand);
    let neededSets = 4 - melds.length;
    let validSanshokuAllocation = true;

    for (const s of suitTypes) {
        const isMeld = melds.some(m => 
            m.type === 'chi' && 
            m.tiles[0].type === s && 
            Math.min(...m.tiles.map(t=>t.value)) === startVal
        );
        
        if (!isMeld) {
            let offset = s === 'm' ? 0 : s === 'p' ? 9 : 18;
            let idx = offset + startVal - 1;
            
            if (tempArr[idx] > 0 && tempArr[idx+1] > 0 && tempArr[idx+2] > 0) {
                tempArr[idx]--;
                tempArr[idx+1]--;
                tempArr[idx+2]--;
                neededSets--;
            } else {
                validSanshokuAllocation = false;
                break;
            }
        }
    }

    if (validSanshokuAllocation) {
        if (isValidStructure(tempArr, neededSets)) {
            yaku.push({ name: '三色同順', fan: isMenzen ? 2 : 1 });
            break;
        }
    }
  }

  if (isMenzen) {
      const pairs = Object.keys(handCounts).filter(k => handCounts[k] >= 2);
      let isPinfu = false;
      for (const pairKey of pairs) {
          const type = pairKey[0];
          const val = parseInt(pairKey.slice(1));
          const isYakuhaiHead = type === 'z' && (val >= 5 || val === 1); 
          if (!isYakuhaiHead && isAllSequencesWithPair(handCounts, pairKey)) {
              isPinfu = true;
              break;
          }
      }
      if (isPinfu) yaku.push({ name: '平和', fan: 1 });
      
      let ippeikoFound = false;
      for (const key in handCounts) {
         const type = key[0];
         const val = parseInt(key.slice(1));
         if (type !== 'z' && val <= 7) {
             const k2 = `${type}${val+1}`;
             const k3 = `${type}${val+2}`;
             if (handCounts[key] >= 2 && handCounts[k2] >= 2 && handCounts[k3] >= 2) {
                 ippeikoFound = true;
                 break;
             }
         }
      }
      if (ippeikoFound) yaku.push({ name: '一盃口', fan: 1 });
  }
      
  const meldTriplets = melds.filter(m => m.type === 'pon' || m.type === 'kan').length;
  let handTriplets = 0;
  for (const k in handCounts) {
      if (handCounts[k] >= 3) handTriplets++;
  }
  
  if (meldTriplets + handTriplets >= 4) { 
      yaku.push({ name: '對對和', fan: 2 });
  }

  if (handTriplets >= 3) {
      if (handTriplets === 4 || isTsumo || isMenzen) {
          yaku.push({ name: '三暗刻', fan: 2 });
      }
  }
  
  return yaku;
};

export const calculateFinalScore = (
  hand: Tile[], 
  melds: Meld[], 
  isTsumo: boolean, 
  isReach: boolean, 
  indicator: Tile | null, 
  isDealer: boolean = false, 
  isSkill: boolean = false,
  forceYakuName?: string,
  forceFan?: number
): WinningResult | null => {
  if (!forceYakuName && !isSkill && !checkWin(hand, melds)) return null;
  
  const isMenzen = melds.length === 0;

  let yaku: YakuResult[] = [];
  
  if (forceYakuName && forceFan) {
      yaku.push({ name: `絕技：${forceYakuName}`, fan: forceFan });
  } else {
      yaku = evaluateYaku(hand, melds, isReach, isTsumo);
      if (isSkill) yaku.push({ name: "絕技：必殺自摸", fan: 13 });
  }

  if (yaku.length === 0) return null;

  const dora = calculateDora(hand, melds, indicator);
  
  const isYakuman = yaku.some(y => y.fan >= 13);

  if (!isYakuman && dora > 0) {
      yaku.push({ name: '懸賞牌', fan: dora });
  }

  const totalFan = yaku.reduce((s, y) => s + y.fan, 0);
  
  let fu = 30;
  if (!forceYakuName) {
      if (yaku.some(y => y.name === '七對子')) fu = 25;
      else if (yaku.some(y => y.name === '平和')) {
          fu = isTsumo ? 20 : 30;
      } else {
          const handCounts = getCounts(hand);
          for (const k in handCounts) {
              if (handCounts[k] >= 3) {
                  const val = parseInt(k.slice(1));
                  const isYaochu = k[0] === 'z' || val === 1 || val === 9;
                  fu += isYaochu ? 8 : 4;
              }
          }
          if (isTsumo) fu += 2;
          if (isMenzen && !isTsumo) fu += 10;
      }
  }

  let points = 0;
  if (totalFan >= 13) points = 32000 * Math.floor(totalFan / 13);
  else if (totalFan >= 11) points = 24000;
  else if (totalFan >= 8) points = 16000;
  else if (totalFan >= 6) points = 12000;
  else if (totalFan >= 5) points = 8000;
  else {
    fu = Math.ceil(fu / 10) * 10;
    const base = fu * Math.pow(2, totalFan + 2);
    points = Math.min(Math.ceil((base * 4) / 100) * 100, 8000);
  }
  if (isDealer) points = Math.ceil((points * 1.5) / 100) * 100;

  return { winner: 'player', yaku, doraCount: dora, fan: totalFan, fu, points, hand, melds, isTsumo };
};
