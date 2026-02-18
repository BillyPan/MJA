
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

// 生成天照大神 (Amaterasu) 的超級牌型
export const generateAmaterasuHand = (): WinningResult => {
    // 定義各種超級牌型
    const scenarios = [
        // 1. 天和九蓮寶燈 (雙倍役滿)
        {
            name: '天和九蓮寶燈',
            setup: () => {
                const hand: Tile[] = [];
                // 1112345678999m + 9m
                [1,1,1,2,3,4,5,6,7,8,9,9,9].forEach((v, i) => hand.push(createTile('m', v, `chuuren-${i}`)));
                hand.push(createTile('m', 9, 'tsumo'));
                return { hand, melds: [] };
            },
            yaku: [
                { name: '天照大神·天和', fan: 13 },
                { name: '純正九蓮寶燈', fan: 26 },
                { name: '雙倍役滿', fan: 26 }
            ],
            points: 128000,
            fan: 65,
            fu: 100
        },
        // 2. 140符 105番 (字一色、三暗刻、四槓子、役牌4、嶺上開花、寶牌72)
        // 牌型構造：4個槓子 (白發中北) + 西(雀頭)
        {
            name: '百五番繚亂',
            setup: () => {
                const hand: Tile[] = [];
                const melds: Meld[] = [];
                // 為了視覺效果，我們把槓子放入 melds
                // 白板槓
                melds.push({ type: 'kan', isClosed: true, tiles: Array(4).fill(null).map((_,i) => createTile('z', 5, `k1-${i}`)) });
                // 發財槓
                melds.push({ type: 'kan', isClosed: true, tiles: Array(4).fill(null).map((_,i) => createTile('z', 6, `k2-${i}`)) });
                // 紅中槓
                melds.push({ type: 'kan', isClosed: true, tiles: Array(4).fill(null).map((_,i) => createTile('z', 7, `k3-${i}`)) });
                // 北風槓
                melds.push({ type: 'kan', isClosed: true, tiles: Array(4).fill(null).map((_,i) => createTile('z', 4, `k4-${i}`)) });
                
                // 單騎聽牌：西風
                hand.push(createTile('z', 3, 'pair-1'));
                hand.push(createTile('z', 3, 'tsumo'));
                
                return { hand, melds };
            },
            yaku: [
                { name: '天照大神·字一色', fan: 13 },
                { name: '四槓子', fan: 13 },
                { name: '三暗刻', fan: 2 },
                { name: '役牌 4', fan: 4 },
                { name: '嶺上開花', fan: 1 },
                { name: '寶牌 72', fan: 72 }
            ],
            points: 999999, // 視覺極限
            fan: 105,
            fu: 140
        },
        // 3. 宇宙創生 (2.19e34點)
        // 立直，一发，海底摸月，自摸，断幺九，清一色，绿一色，四暗刻单骑，四杠子，宝牌40
        // 牌型：綠一色四槓子 (23468s + 發)
        // 構造：發槓、8s槓、6s槓、4s槓、2s單騎
        {
            name: '宇宙創生',
            setup: () => {
                const hand: Tile[] = [];
                const melds: Meld[] = [];
                // 6z 槓
                melds.push({ type: 'kan', isClosed: true, tiles: Array(4).fill(null).map((_,i) => createTile('z', 6, `k1-${i}`)) });
                // 8s 槓
                melds.push({ type: 'kan', isClosed: true, tiles: Array(4).fill(null).map((_,i) => createTile('s', 8, `k2-${i}`)) });
                // 6s 槓
                melds.push({ type: 'kan', isClosed: true, tiles: Array(4).fill(null).map((_,i) => createTile('s', 6, `k3-${i}`)) });
                // 4s 槓
                melds.push({ type: 'kan', isClosed: true, tiles: Array(4).fill(null).map((_,i) => createTile('s', 4, `k4-${i}`)) });
                
                // 2s 單騎
                hand.push(createTile('s', 2, 'pair'));
                hand.push(createTile('s', 2, 'tsumo'));

                return { hand, melds };
            },
            yaku: [
                { name: '天照大神·雙立直', fan: 2 },
                { name: '一發', fan: 1 },
                { name: '海底摸月', fan: 1 },
                { name: '門前清自摸', fan: 1 },
                { name: '斷么九', fan: 1 },
                { name: '清一色', fan: 6 },
                { name: '綠一色', fan: 13 },
                { name: '四暗刻單騎', fan: 26 },
                { name: '四槓子', fan: 13 },
                { name: '寶牌 40', fan: 40 }
            ],
            points: 2190500237194380, // JS Number max safe int approx 9e15, we use a big number. Real number 2e34 is too big for types
            fan: 103,
            fu: 90
        },
        // 4. 清一色三暗刻四槓子
        {
            name: '清一色連鎖',
            setup: () => {
                 const hand: Tile[] = [];
                 const melds: Meld[] = [];
                 // 1m Kan, 3m Kan, 5m Kan, 7m Kan, 9m Pair
                 [1, 3, 5, 7].forEach((v, idx) => {
                     melds.push({ type: 'kan', isClosed: true, tiles: Array(4).fill(null).map((_,i) => createTile('m', v, `k${idx}-${i}`)) });
                 });
                 hand.push(createTile('m', 9, 'p'));
                 hand.push(createTile('m', 9, 'tsumo'));
                 return { hand, melds };
            },
            yaku: [
                { name: '天照大神·清一色', fan: 6 },
                { name: '三暗刻', fan: 2 },
                { name: '四槓子', fan: 13 },
                { name: '對對和', fan: 2 },
                { name: '寶牌 20', fan: 20 }
            ],
            points: 168000,
            fan: 43,
            fu: 70
        },
        // 5. 四暗刻大三元
        {
            name: '白發中繚亂',
            setup: () => {
                const hand: Tile[] = [];
                // 白刻、發刻、中刻、東刻、西雀頭
                [5,6,7,1].forEach((v, idx) => {
                     for(let i=0; i<3; i++) hand.push(createTile('z', v, `tri-${idx}-${i}`));
                });
                hand.push(createTile('z', 3, 'p1'));
                hand.push(createTile('z', 3, 'tsumo')); // 單騎
                return { hand: sortHand(hand), melds: [] };
            },
            yaku: [
                { name: '天照大神·大三元', fan: 13 },
                { name: '四暗刻單騎', fan: 26 },
                { name: '字一色', fan: 13 },
                { name: '役牌 4', fan: 4 }
            ],
            points: 192000,
            fan: 56,
            fu: 60
        }
    ];

    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    const { hand, melds } = scenario.setup();

    return {
        winner: 'player',
        yaku: scenario.yaku,
        doraCount: 0, // Yaku handles dora display
        fan: scenario.fan,
        fu: scenario.fu,
        points: scenario.points,
        hand,
        melds,
        isTsumo: true
    };
};

// 生成役滿 (給玩家用，或 CPU 不受限時使用)
export const generateSpecialHand = (limitScore?: number): { hand: Tile[], yakuName: string, fan: number } => {
  const yakumanTypes = [
    'Kokushi', 'Chuuren', 'Daisangen', 'Suuankou', 'Tsuuisa', 'Ryuuiisou', 
    'Chinroutou', 'Daisuushii', 'Shousuushii' 
  ];
  
  // 如果有限制分數，且限制分數低於役滿標準 (32000)，則不生成役滿
  if (limitScore === undefined || limitScore >= 32000) {
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
  }

  // 根據 limitScore 決定手牌等級
  // CPU 視為莊家，莊家點數約為閒家 1.5 倍
  // 倍滿 24000, 跳滿 18000, 滿貫 12000, 3番 5800/7700, 2番 2900, 1番 1500
  let hand: Tile[] = [];
  let name = '';
  let fan = 1;

  if (limitScore >= 24000) {
      name = '清一色 (倍滿)';
      fan = 8;
      const suit = (['m', 'p', 's'] as TileType[])[Math.floor(Math.random() * 3)];
      [1,1,1,2,3,4,5,6,7,8,9,9,9,5].forEach((v, i) => hand.push(createTile(suit, v, `bm-${i}`)));
  } else if (limitScore >= 18000) {
      name = '清一色 (跳滿)';
      fan = 6;
      const suit = (['m', 'p', 's'] as TileType[])[Math.floor(Math.random() * 3)];
      [1,2,3, 2,3,4, 5,6,7, 7,8,9, 5,5].forEach((v, i) => hand.push(createTile(suit, v, `hm-${i}`)));
  } else if (limitScore >= 12000) {
      name = '混一色 (滿貫)';
      fan = 5;
      const suit = (['m', 'p', 's'] as TileType[])[Math.floor(Math.random() * 3)];
      [1,2,3].forEach((v,i) => hand.push(createTile(suit, v, `mn-${i}`)));
      [4,5,6].forEach((v,i) => hand.push(createTile(suit, v, `mn2-${i}`)));
      [7,8,9].forEach((v,i) => hand.push(createTile(suit, v, `mn3-${i}`)));
      [1,1,1].forEach((v,i) => hand.push(createTile('z', 5, `mn4-${i}`))); // 白
      [1,1].forEach((v,i) => hand.push(createTile('z', 6, `mn5-${i}`))); // 發對
  } else if (limitScore >= 5800) {
      name = '斷么九 (三番)';
      fan = 3;
      [2,3,4, 2,3,4, 4,5,6, 6,7,8, 5,5].forEach((v, i) => {
         const t = i < 3 ? 'm' : i < 6 ? 'p' : i < 9 ? 's' : i < 12 ? 'm' : 's';
         hand.push(createTile(t as TileType, v, `f3-${i}`));
      });
  } else if (limitScore >= 2900) {
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
  
  // DFS Search for Mentsu (Sets) and Heads (Pairs)
  const search = (index: number, m: number, t: number, p: number) => {
    // 1. Advance index to next available tile
    while (index < 34 && handArr[index] === 0) index++;

    // 2. Base Case: No more tiles to process for sets
    if (index >= 34) {
      let taatsu = 0;
      // Greedy Taatsu Counting on the 'leftovers' in handArr
      // We need to consume tiles to avoid double counting.
      const temp = [...handArr]; 
      
      for (let i = 0; i < 34; i++) {
         if (temp[i] === 2) {
             // Pair treated as Taatsu
             taatsu++;
             temp[i] = 0;
         } else if (temp[i] === 1) {
             // Check Penchan/Ryanmen/Kanchan
             if (i < 27 && i % 9 < 8 && temp[i+1] > 0) {
                 taatsu++;
                 temp[i]--; 
                 temp[i+1]--;
             } else if (i < 27 && i % 9 < 7 && temp[i+2] > 0) {
                 taatsu++;
                 temp[i]--;
                 temp[i+2]--;
             }
         }
      }

      let potentialSets = m + meldsCount;
      let potentialTaatsu = t + taatsu;
      
      // Rule: Sets + Taatsus <= 4
      if (potentialSets + potentialTaatsu > 4) potentialTaatsu = 4 - potentialSets;
      
      // Shanten Formula: 8 - 2*Sets - Taatsu - Pair
      const shanten = 8 - (potentialSets * 2) - potentialTaatsu - p;
      if (shanten < minShanten) minShanten = shanten;
      return;
    }

    // 3. Recursive Step: Try to form sets starting at 'index'
    
    // Option A: Koutsu (Triplet)
    if (handArr[index] >= 3) {
      handArr[index] -= 3;
      search(index, m + 1, t, p);
      handArr[index] += 3;
    }
    
    // Option B: Shuntsu (Sequence)
    if (index < 27 && index % 9 < 7) {
       if (handArr[index+1] > 0 && handArr[index+2] > 0) {
          handArr[index]--; handArr[index+1]--; handArr[index+2]--;
          search(index, m + 1, t, p);
          handArr[index]++; handArr[index+1]++; handArr[index+2]++;
       }
    }
    
    // Option C: Pair (only if no head yet)
    if (p === 0 && handArr[index] >= 2) {
      handArr[index] -= 2;
      search(index, m, t, 1);
      handArr[index] += 2;
    }

    // Option D: SKIP this tile (treat as isolated or future taatsu)
    // We move to index + 1, leaving handArr[index] as is.
    search(index + 1, m, t, p);
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

// 取得所有可以吃的組合 (返回 Tile[] 的陣列，每個陣列是2張牌)
export const getChiCombinations = (hand: Tile[], tile: Tile): Tile[][] => {
  if (tile.type === 'z') return [];
  const combinations: Tile[][] = [];
  const v = tile.value;
  const t = tile.type;
  
  // 尋找手牌中特定值的第一張牌 (避免重複組合)
  const find = (val: number): Tile | undefined => hand.find(x => x.type === t && x.value === val);

  // 情況1: v-2, v-1, v
  if (v >= 3) {
      const t1 = find(v - 2);
      const t2 = find(v - 1);
      if (t1 && t2) combinations.push([t1, t2]);
  }
  // 情況2: v-1, v, v+1
  if (v >= 2 && v <= 8) {
      const t1 = find(v - 1);
      const t2 = find(v + 1);
      if (t1 && t2) combinations.push([t1, t2]);
  }
  // 情況3: v, v+1, v+2
  if (v <= 7) {
      const t1 = find(v + 1);
      const t2 = find(v + 2);
      if (t1 && t2) combinations.push([t1, t2]);
  }
  
  return combinations;
};

export const canChi = (hand: Tile[], tile: Tile): boolean => {
  return getChiCombinations(hand, tile).length > 0;
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
  
  // 修正：門前清判定，只有暗槓不算破壞門清
  const isMenzen = melds.every(m => m.isClosed === true);

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
  
  // 修正：門前清判定，只有暗槓不算破壞門清
  const isMenzen = melds.every(m => m.isClosed === true);

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
  const isForcedHand = !!forceYakuName;

  // IMPORTANT: 如果是絕技強制生成的牌型，不再疊加 Dora，避免分數超過預期的安全上限 (玩家保護機制)
  if (!isYakuman && dora > 0 && !isForcedHand) {
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

  return { winner: 'player', yaku, doraCount: isForcedHand ? 0 : dora, fan: totalFan, fu, points, hand, melds, isTsumo };
};

// ==========================================
// 立直判定
// ==========================================

export const checkReachAvailability = (hand: Tile[], melds: Meld[]): boolean => {
  // 檢查是否門前清：沒有副露，或者只有暗槓
  // 如果副露陣列中存在非暗槓的副露 (isClosed !== true)，則不為門前清，不可立直
  const isMenzen = melds.every(m => m.isClosed === true);
  if (!isMenzen) return false;
  
  // 必須是自己回合且手牌為 14 張 (3n+2)，代表剛摸牌尚未打出
  if (hand.length % 3 !== 2) return false;

  // 檢查是否打掉一張後聽牌 (Shanten == 0)
  // 輪詢打掉每一張牌
  for (let i = 0; i < hand.length; i++) {
    const tempHand = hand.filter((_, idx) => idx !== i);
    // 計算打掉這張牌後的向聽數
    const shanten = calculateShanten(tempHand, melds);
    // 向聽數為 0 代表聽牌
    if (shanten <= 0) {
        return true;
    }
  }
  return false;
};
