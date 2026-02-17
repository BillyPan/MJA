// ... (imports remain same)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GamePhase, Instructor, Tile, CallActions, Meld, WinningResult } from './types';
import { INSTRUCTORS, createDeck } from './constants';
import { sortHand, checkWin, calculateFinalScore, getWaitingTiles, isFuriten, canPon, canChi, canKan, checkOwnTurnKan, getBestDiscard, shouldCPUCall, calculateShanten, generateGodHand } from './services/mahjongEngine';
import { getInstructorDialogue } from './services/gemini';
import MahjongGame from './components/MahjongGame';
import MahjongTile from './components/MahjongTile';

const App: React.FC = () => {
  const [graduatedIds, setGraduatedIds] = useState<number[]>([]);
  const [isPendingReach, setIsPendingReach] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    playerHand: [],
    playerMelds: [],
    cpuHand: [],
    cpuMelds: [],
    deck: [],
    playerDiscards: [],
    cpuDiscards: [],
    currentTurn: 'player',
    playerEnergy: 100,
    playerScore: 25000,
    cpuScore: 25000,
    phase: GamePhase.INTRO,
    selectedInstructor: null,
    message: "歡迎來到麻雀學園！",
    isPlayerReach: false,
    isCpuReach: false,
    lastDiscardTile: null,
    pendingCall: null,
    doraIndicator: null,
    isPlayerFuriten: false,
    isWinAnimation: false,
  });

  // 存檔功能 - 僅更新 State，不寫入 LocalStorage，模擬街機斷電重置
  const saveProgress = (id: number) => {
    setGraduatedIds(prev => [...new Set([...prev, id])]);
  };

  const playSound = (type: 'draw' | 'discard' | 'win' | 'call' | 'skill') => {
    const urls = {
      draw: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      discard: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
      call: 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
      skill: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'
    };
    new Audio(urls[type]).play().catch(() => {});
  };

  // 控制胡牌動畫與延遲跳轉
  useEffect(() => {
    if (gameState.isWinAnimation) {
      playSound('win');
      // 老師胡牌停留4秒，玩家胡牌停留2.5秒
      const delay = gameState.winningHand?.winner === 'cpu' ? 4000 : 2500;
      const timer = setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          phase: GamePhase.RESULT,
          isWinAnimation: false
        }));
      }, delay); 
      return () => clearTimeout(timer);
    }
  }, [gameState.isWinAnimation]);

  const startNewRound = (instructor: Instructor, pScore: number, cScore: number, pEnergy: number) => {
    const deck = createDeck();
    const playerHand = sortHand(deck.splice(0, 13));
    const cpuHand = sortHand(deck.splice(0, 13));
    const doraIndicator = deck.pop()!;
    setIsPendingReach(false);

    setGameState(prev => ({
      ...prev,
      phase: GamePhase.PLAYING,
      selectedInstructor: instructor,
      deck,
      playerHand,
      cpuHand,
      doraIndicator,
      playerMelds: [],
      cpuMelds: [],
      playerDiscards: [],
      cpuDiscards: [],
      currentTurn: 'player',
      playerEnergy: Math.min(100, pEnergy + 10),
      playerScore: pScore,
      cpuScore: cScore,
      isPlayerReach: false,
      isCpuReach: false,
      isPlayerFuriten: false,
      winningHand: undefined,
      message: `${instructor.name}：請多指教囉！`,
      pendingCall: null,
      lastDiscardTile: null,
      isWinAnimation: false,
    }));
    setTimeout(() => playerDraw(), 800);
  };

  const playerDraw = () => {
    setGameState(prev => {
      if (prev.deck.length === 0) return { ...prev, phase: GamePhase.RESULT, message: "流局！" };
      playSound('draw');
      const newDeck = [...prev.deck];
      const drawn = newDeck.pop()!;
      // 注意：摸進來的牌直接加在最後，不可 sort 14 張
      const newHand = [...prev.playerHand, drawn];
      const kanTile = checkOwnTurnKan(newHand, prev.playerMelds);
      const canTsumoRes = calculateFinalScore(newHand, prev.playerMelds, true, prev.isPlayerReach, prev.doraIndicator);
      
      const calls: CallActions = { ron: false, pon: false, chi: false, kan: !!kanTile };
      return {
        ...prev,
        deck: newDeck,
        playerHand: newHand,
        playerEnergy: Math.min(100, prev.playerEnergy + 5),
        currentTurn: 'player',
        pendingCall: calls.kan ? calls : null,
        lastDiscardTile: kanTile,
        message: canTsumoRes ? "可以自摸囉！" : prev.message
      };
    });
  };

  const handlePlayerDiscard = async (tileId: string) => {
    const tileIdx = gameState.playerHand.findIndex(t => t.id === tileId);
    if (tileIdx === -1 || gameState.currentTurn !== 'player' || gameState.pendingCall) return;

    playSound('discard');
    const newHand = [...gameState.playerHand];
    const discarded = newHand.splice(tileIdx, 1)[0];
    const updatedDiscards = [...gameState.playerDiscards, discarded];
    
    let reachStatus = gameState.isPlayerReach;
    // 修正：只要是立直宣言狀態，棄牌後即確立立直 (即使是非聽牌立直，也視為成立以維持視覺效果)
    if (isPendingReach) {
        reachStatus = true;
    }
    setIsPendingReach(false);

    const waiting = getWaitingTiles(newHand, gameState.playerMelds);
    const isNowFuriten = isFuriten(updatedDiscards, waiting);

    setGameState(prev => ({
      ...prev,
      playerHand: sortHand(newHand), // 棄牌後手牌剩13張，重新排序
      playerDiscards: updatedDiscards,
      isPlayerFuriten: isNowFuriten,
      isPlayerReach: reachStatus,
      lastDiscardTile: discarded,
      currentTurn: 'cpu',
      pendingCall: null,
      message: Math.random() < 0.3 ? getInstructorDialogue() : prev.message
    }));

    const cpuDifficulty = gameState.selectedInstructor?.difficulty || 1;
    
    // CPU 決策：先看能不能胡玩家棄的那張 (榮和)
    const cpuWin = calculateFinalScore([...gameState.cpuHand, discarded], gameState.cpuMelds, false, gameState.isCpuReach, gameState.doraIndicator, true);
    if (cpuWin) {
      setTimeout(() => {
        // 移除此處的 playSound('win')，改由 useEffect 觸發
        setGameState(prev => ({
          ...prev,
          // phase 保持 PLAYING，等待動畫結束才切換
          cpuScore: prev.cpuScore + cpuWin.points,
          playerScore: prev.playerScore - cpuWin.points,
          winningHand: { ...cpuWin, winner: 'cpu' },
          message: `${prev.selectedInstructor?.name}：胡牌！畢業了！`,
          isWinAnimation: true
        }));
      }, 800);
      return;
    }

    // 再看能不能鳴牌 (吃、碰)
    if (!gameState.isCpuReach) {
      if (canPon(gameState.cpuHand, discarded) && shouldCPUCall(gameState.cpuHand, gameState.cpuMelds, discarded, 'pon', cpuDifficulty)) {
        setTimeout(() => cpuCall('pon', discarded), 800);
        return;
      }
      if (canChi(gameState.cpuHand, discarded) && shouldCPUCall(gameState.cpuHand, gameState.cpuMelds, discarded, 'chi', cpuDifficulty)) {
        setTimeout(() => cpuCall('chi', discarded), 800);
        return;
      }
    }

    // 都沒發生則輪到 CPU 摸牌，改用 cpuDraw 啟動摸牌與思考流程
    setTimeout(cpuDraw, 1000);
  };

  const cpuCall = (type: 'pon' | 'chi', tile: Tile) => {
    playSound('call');
    setGameState(prev => {
      let newHand = [...prev.cpuHand];
      let newMeld: Tile[] = [];
      if (type === 'pon') {
        const matches = newHand.filter(t => t.type === tile.type && t.value === tile.value).slice(0, 2);
        newHand = newHand.filter(t => !matches.some(m => m.id === t.id));
        newMeld = [...matches, tile];
      } else if (type === 'chi') {
        const v = tile.value, t = tile.type;
        const find = (val: number) => newHand.find(x => x.type === t && x.value === val);
        let pair: Tile[] = [];
        if (find(v-1) && find(v+1)) pair = [find(v-1)!, find(v+1)!];
        else if (find(v-2) && find(v-1)) pair = [find(v-2)!, find(v-1)!];
        else if (find(v+1) && find(v+2)) pair = [find(v+1)!, find(v+2)!];
        newHand = newHand.filter(t => !pair.some(p => p.id === t.id));
        newMeld = [...pair, tile];
      }
      
      return {
        ...prev,
        cpuHand: sortHand(newHand),
        cpuMelds: [...prev.cpuMelds, { type, tiles: newMeld }],
        message: `${prev.selectedInstructor?.name}：${type === 'pon' ? '碰' : '吃'}！`,
        currentTurn: 'cpu'
      };
    });
    // CPU 鳴牌後必須進行棄牌 (維持原邏輯，這裡不需要長時間思考)
    setTimeout(cpuDiscard, 1000);
  };

  // NEW: CPU 摸牌階段 (不進行整理，模擬思考)
  const cpuDraw = () => {
    setGameState(prev => {
      if (prev.deck.length === 0) return { ...prev, phase: GamePhase.RESULT, message: "流局！" };
      playSound('draw');
      const newDeck = [...prev.deck];
      const drawn = newDeck.pop()!;
      // CPU 手牌包含剛摸到的第14張，注意：此處故意不排序 (sortHand)，讓最後一張顯示在右側
      const fullHand = [...prev.cpuHand, drawn];
      
      // 模擬思考時間，1.0秒後執行決策
      setTimeout(cpuDecide, 1000);

      return { ...prev, cpuHand: fullHand, deck: newDeck, currentTurn: 'cpu' };
    });
  };

  // NEW: CPU 決策階段 (判斷自摸、立直、棄牌)
  const cpuDecide = () => {
    setGameState(prev => {
      // 此時手牌最後一張為剛摸進的
      const fullHand = [...prev.cpuHand];

      // 1. 檢查 CPU 是否自摸
      const winResult = calculateFinalScore(fullHand, prev.cpuMelds, true, prev.isCpuReach, prev.doraIndicator, true);
      if (winResult) {
        return {
          ...prev,
          cpuScore: prev.cpuScore + winResult.points,
          playerScore: prev.playerScore - winResult.points,
          winningHand: { ...winResult, winner: 'cpu' },
          message: `${prev.selectedInstructor?.name}：自摸！感謝招待！`,
          isWinAnimation: true
        };
      }

      // 2. 檢查 CPU 是否可以立直 (與是否決定立直)
      // 修正：必須先棄牌後才能立直，這裡預判打掉某張牌後是否聽牌
      let isNowReach = prev.isCpuReach;
      if (!isNowReach && prev.cpuMelds.length === 0) {
          const bestDiscardIdx = getBestDiscard(fullHand, prev.cpuMelds, prev.selectedInstructor?.difficulty || 1, prev.playerDiscards, prev.isPlayerReach);
          const tempHand = fullHand.filter((_, i) => i !== bestDiscardIdx);
          
          if (calculateShanten(tempHand, prev.cpuMelds) === 0) {
             const waiters = getWaitingTiles(tempHand, prev.cpuMelds);
             if (waiters.length > 0 && Math.random() > 0.4) {
                 isNowReach = true;
             }
          }
      }

      // 3. 執行棄牌計算
      let discardIdx = 0;
      if (isNowReach) {
        discardIdx = fullHand.length - 1; 
      } else {
        discardIdx = getBestDiscard(fullHand, prev.cpuMelds, prev.selectedInstructor?.difficulty || 1, prev.playerDiscards, prev.isPlayerReach);
      }

      playSound('discard');
      const newHand = [...fullHand];
      const discarded = newHand.splice(discardIdx, 1)[0];
      const updatedDiscards = [...prev.cpuDiscards, discarded];

      // 4. 判定玩家是否可以鳴牌或榮和
      const canRonRes = calculateFinalScore([...prev.playerHand, discarded], prev.playerMelds, false, prev.isPlayerReach, prev.doraIndicator);
      const calls: CallActions = {
        ron: !!canRonRes && !prev.isPlayerFuriten,
        pon: canPon(prev.playerHand, discarded) && !prev.isPlayerReach,
        chi: canChi(prev.playerHand, discarded) && !prev.isPlayerReach,
        kan: canKan(prev.playerHand, discarded) && !prev.isPlayerReach
      };

      const hasCall = Object.values(calls).some(v => v);
      if (!hasCall) setTimeout(playerDraw, 800);

      const msg = isNowReach && !prev.isCpuReach ? `${prev.selectedInstructor?.name}：立直！` : (Math.random() < 0.3 ? getInstructorDialogue() : prev.message);

      return {
        ...prev,
        cpuHand: sortHand(newHand),
        cpuDiscards: updatedDiscards,
        lastDiscardTile: discarded,
        pendingCall: hasCall ? calls : null,
        currentTurn: 'player',
        isCpuReach: isNowReach,
        message: msg
      };
    });
  };

  // 舊的 cpuDiscard 函式保留給 cpuCall 使用 (鳴牌後的棄牌不需要自摸判斷)
  const cpuDiscard = () => {
    setGameState(prev => {
      let discardIdx = 0;
      // 鳴牌後不能立直，且鳴牌當下一定是自己的回合
      discardIdx = getBestDiscard(prev.cpuHand, prev.cpuMelds, prev.selectedInstructor?.difficulty || 1, prev.playerDiscards, prev.isPlayerReach);

      playSound('discard');
      const newHand = [...prev.cpuHand];
      const discarded = newHand.splice(discardIdx, 1)[0];
      const updatedDiscards = [...prev.cpuDiscards, discarded];

      const canRonRes = calculateFinalScore([...prev.playerHand, discarded], prev.playerMelds, false, prev.isPlayerReach, prev.doraIndicator);
      const calls: CallActions = {
        ron: !!canRonRes && !prev.isPlayerFuriten,
        pon: canPon(prev.playerHand, discarded) && !prev.isPlayerReach,
        chi: canChi(prev.playerHand, discarded) && !prev.isPlayerReach,
        kan: canKan(prev.playerHand, discarded) && !prev.isPlayerReach
      };

      const hasCall = Object.values(calls).some(v => v);
      if (!hasCall) setTimeout(playerDraw, 800);

      return {
        ...prev,
        cpuHand: sortHand(newHand),
        cpuDiscards: updatedDiscards,
        lastDiscardTile: discarded,
        pendingCall: hasCall ? calls : null,
        currentTurn: 'player',
        message: Math.random() < 0.3 ? getInstructorDialogue() : prev.message
      };
    });
  };

  const handleCall = (action: keyof CallActions | 'PASS') => {
    if (action === 'PASS') {
      const handCount = gameState.playerHand.length;
      if (handCount % 3 === 2) {
        setGameState(prev => ({ ...prev, pendingCall: null }));
      } else {
        setGameState(prev => ({ ...prev, pendingCall: null }));
        playerDraw();
      }
      return;
    }
    const tile = gameState.lastDiscardTile!;
    if (action === 'ron') {
      const isTsumoAction = gameState.playerHand.length % 3 === 2; // 使用模數判斷是否為自摸
      const finalHand = isTsumoAction ? [...gameState.playerHand] : [...gameState.playerHand, tile];
      const result = calculateFinalScore(finalHand, gameState.playerMelds, isTsumoAction, gameState.isPlayerReach, gameState.doraIndicator);
      if (result) {
        // 移除 playSound('win')
        const cpuNewScore = gameState.cpuScore - result.points;
        if (gameState.selectedInstructor && cpuNewScore <= 0) {
            saveProgress(gameState.selectedInstructor.id);
        }
        setGameState(prev => ({
          ...prev,
          // phase 保持 PLAYING
          playerScore: prev.playerScore + result.points,
          cpuScore: cpuNewScore,
          winningHand: { ...result, winner: 'player' },
          message: isTsumoAction ? "自摸！胡牌！" : "榮和！胡牌！",
          isWinAnimation: true
        }));
      }
      return;
    }
    if (action === 'kan') {
      playSound('call');
      setGameState(prev => {
        let newHand = [...prev.playerHand];
        let newMelds = [...prev.playerMelds];
        const matchingInHand = newHand.filter(t => t.type === tile.type && t.value === tile.value);
        
        if (matchingInHand.length === 4) { // 暗槓
          const toRemove = matchingInHand.map(m => m.id);
          newHand = newHand.filter(t => !toRemove.includes(t.id));
          newMelds.push({ type: 'kan', tiles: matchingInHand });
        } else if (matchingInHand.length === 3) { // 明槓
          const toRemove = matchingInHand.map(m => m.id);
          newHand = newHand.filter(t => !toRemove.includes(t.id));
          newMelds.push({ type: 'kan', tiles: [...matchingInHand, tile] });
        } else { // 加槓
          const ponIdx = newMelds.findIndex(m => m.type === 'pon' && m.tiles[0].type === tile.type && m.tiles[0].value === tile.value);
          if (ponIdx !== -1) {
            newMelds[ponIdx] = { type: 'kan', tiles: [...newMelds[ponIdx].tiles, tile] };
            newHand = newHand.filter(t => t.id !== tile.id);
          }
        }
        setTimeout(playerDraw, 500);
        return { ...prev, playerHand: sortHand(newHand), playerMelds: newMelds, pendingCall: null, currentTurn: 'player', message: "槓！嶺上補牌！" };
      });
      return;
    }
    playSound('call');
    setGameState(prev => {
      let newHand = [...prev.playerHand];
      let newMelds = [...prev.playerMelds];
      if (action === 'pon') {
        const matches = newHand.filter(t => t.type === tile.type && t.value === tile.value).slice(0, 2);
        newHand = newHand.filter(t => !matches.some(m => m.id === t.id));
        newMelds.push({ type: 'pon', tiles: [...matches, tile] });
      } else if (action === 'chi') {
        const v = tile.value, t = tile.type;
        const find = (val: number) => newHand.find(x => x.type === t && x.value === val);
        let pair: Tile[] = [];
        if (find(v-1) && find(v+1)) pair = [find(v-1)!, find(v+1)!];
        else if (find(v-2) && find(v-1)) pair = [find(v-2)!, find(v-1)!];
        else if (find(v+1) && find(v+2)) pair = [find(v+1)!, find(v+2)!];
        newHand = newHand.filter(t => !pair.some(p => p.id === t.id));
        newMelds.push({ type: 'chi', tiles: [...pair, tile] });
      }
      return { ...prev, playerHand: sortHand(newHand), playerMelds: newMelds, pendingCall: null, currentTurn: 'player' };
    });
  };

  const useSkill = (skillType: string) => {
    // 立直現在不需要能量，且不扣能量
    if (skillType === 'REACH') {
      playSound('skill');
      setIsPendingReach(true);
      // 移除扣能與檢查邏輯
      setGameState(prev => ({ ...prev, message: "宣告立直！" }));

    } else if (skillType === 'TSUMO' && gameState.playerEnergy >= 100) {
      playSound('skill');
      
      const godHandData = generateGodHand();
      const newHand = godHandData.hand;
      
      setGameState(prev => ({
        ...prev,
        playerEnergy: prev.playerEnergy - 100,
        playerHand: newHand,
        playerMelds: [],
        message: `絕技發動：${godHandData.yakuName}！`
      }));

      setTimeout(() => {
        const res = calculateFinalScore(
            newHand, 
            [], 
            true, 
            gameState.isPlayerReach, 
            gameState.doraIndicator, 
            false, 
            true,
            godHandData.yakuName,
            godHandData.fan
        );

        if (res) {
          setGameState(prev => {
            const cpuNewScore = prev.cpuScore - res.points;
            if (prev.selectedInstructor && cpuNewScore <= 0) {
                saveProgress(prev.selectedInstructor.id);
            }
            return {
                ...prev,
                playerScore: prev.playerScore + res.points,
                cpuScore: cpuNewScore,
                winningHand: { ...res, winner: 'player' },
                isWinAnimation: true,
                message: `絕技：${godHandData.yakuName}！`
            };
          });
        }
      }, 2000);

    } else if (skillType === 'EXCHANGE' && gameState.playerEnergy >= 30) {
      if (gameState.playerHand.length % 3 !== 2) return;
      playSound('skill');
      setGameState(prev => {
        let newDeck = [...prev.deck];
        let drawn: Tile;
        let msg = "換牌術發動！";

        // 手牌最後一張是剛摸到的，前 n-1 張是手牌主體
        const lastIndex = prev.playerHand.length - 1;
        const handWithoutLast = prev.playerHand.slice(0, lastIndex);
        const waiters = getWaitingTiles(handWithoutLast, prev.playerMelds);
        
        // 如果立直，高機率換到聽牌
        let forcedWin = false;
        // 修正：必須包含 pendingReach 的判斷，因為按下立直後還未棄牌，prev.isPlayerReach 為 false
        if ((prev.isPlayerReach || isPendingReach) && waiters.length > 0) {
            // 70% 機率直接抽到胡牌的牌
            if (Math.random() < 0.70) {
                // 優先檢查牌山中是否有聽的牌
                const deckCandidates = waiters.filter(w => {
                    const t = w[0] as any;
                    const v = parseInt(w.slice(1));
                    return newDeck.some(dt => dt.type === t && dt.value === v);
                });
                
                if (deckCandidates.length > 0) {
                     // 隨機選一個現有的聽牌
                     const targetWait = deckCandidates[Math.floor(Math.random() * deckCandidates.length)];
                     const targetType = targetWait[0] as any;
                     const targetValue = parseInt(targetWait.slice(1));
                     
                     const waiterIdx = newDeck.findIndex(t => t.type === targetType && t.value === targetValue);
                     if (waiterIdx !== -1) {
                         drawn = newDeck.splice(waiterIdx, 1)[0];
                         msg = "必殺換牌！一發入魂！";
                         forcedWin = true;
                     }
                } else {
                    // 如果牌山沒這張牌（被自己打光了或在對手手裡），直接虛空創造一張
                    const targetWait = waiters[Math.floor(Math.random() * waiters.length)];
                    const targetType = targetWait[0] as any;
                    const targetValue = parseInt(targetWait.slice(1));
                    
                    drawn = { id: `god-given-${Date.now()}`, type: targetType, value: targetValue };
                    msg = "必殺換牌！虛空造牌！";
                    forcedWin = true;
                }
            }
        }
        
        if (!forcedWin) {
          // 一般換牌或運氣不好沒換到
          newDeck = newDeck.sort(() => Math.random() - 0.5);
          drawn = newDeck.pop()!;
        }

        // 拿回剛摸到的最後一張牌 放回牌庫
        const lastTile = prev.playerHand[lastIndex];
        newDeck.push(lastTile);
        
        // 構造新手牌：前 n-1 張重新排序，最後一張替換為新換到的牌
        const sortedBase = sortHand(handWithoutLast);
        const newHand = [...sortedBase, drawn];

        return { 
          ...prev, 
          playerHand: newHand, 
          deck: newDeck, 
          playerEnergy: prev.playerEnergy - 30, 
          message: msg 
        };
      });
    }
  };

  const handleNextRound = () => {
    // ... (same as before)
    if (!gameState.selectedInstructor) {
      setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }));
      return;
    }
    
    // 雙重保險：如果在結果畫面 CPU 分數歸零，確保進度被儲存
    if (gameState.cpuScore <= 0 && gameState.selectedInstructor) {
        saveProgress(gameState.selectedInstructor.id);
    }

    if (gameState.cpuScore <= 0 || gameState.playerScore <= 0) {
      // 檢查是否全破
      const currentId = gameState.selectedInstructor.id;
      const isWin = gameState.cpuScore <= 0;
      const allClearedIds = new Set(graduatedIds);
      if (isWin) allClearedIds.add(currentId);

      if (allClearedIds.size >= INSTRUCTORS.length) {
         setGameState(prev => ({ ...prev, phase: GamePhase.GAME_OVER }));
         return;
      }

      setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT, playerScore: 25000, cpuScore: 25000 }));
    } else {
      startNewRound(gameState.selectedInstructor, gameState.playerScore, gameState.cpuScore, gameState.playerEnergy);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-black overflow-hidden serif-font">
      {/* ... (rest of the render remains same) */}
      {/* 胡牌特效層 */}
      {gameState.isWinAnimation && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="relative animate-impact-zoom">
            <h1 className="text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-500 to-red-600 drop-shadow-[0_0_50px_rgba(255,215,0,0.8)] stroke-text">
              胡牌
            </h1>
            <div className="absolute inset-0 bg-yellow-400/20 blur-3xl animate-pulse-fast rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[20px] bg-white rotate-45 animate-slash opacity-50"></div>
          </div>
          <style>{`
            .stroke-text {
              -webkit-text-stroke: 4px #8B0000;
            }
            @keyframes impact-zoom {
              0% { transform: scale(3); opacity: 0; }
              15% { transform: scale(1); opacity: 1; }
              20% { transform: scale(1.1); }
              100% { transform: scale(1); }
            }
            .animate-impact-zoom {
              animation: impact-zoom 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            @keyframes slash {
              0% { width: 0; opacity: 0; }
              50% { width: 150%; opacity: 0.8; }
              100% { width: 150%; opacity: 0; }
            }
            .animate-slash {
              animation: slash 0.3s ease-out forwards;
              animation-delay: 0.1s;
            }
            @keyframes pulse-fast {
              0%, 100% { opacity: 0.2; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.5); }
            }
            .animate-pulse-fast {
              animation: pulse-fast 0.5s infinite;
            }
          `}</style>
        </div>
      )}

      {gameState.phase === GamePhase.INTRO && (
        <div className="text-center flex flex-col items-center">
          <div className="flex flex-col items-center">
            <h1 className="text-9xl font-black mb-4 text-yellow-500 italic drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">麻雀學園</h1>
            <h2 className="text-6xl text-white tracking-[0.5em] border-y-2 py-4 w-full text-center">畢業篇</h2>
          </div>
          <div className="flex flex-col items-center mt-20">
            <button onClick={() => setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }))} className="bg-red-700 text-white px-12 py-4 text-3xl font-black animate-pulse shadow-[0_0_20px_rgba(185,28,28,0.5)]">INSERT COIN</button>
            <p className="mt-20 text-zinc-500 text-xl font-bold tracking-wider opacity-50">【bILLYpAN Gemini Vibe Coding 複刻試作 Ver 1.42】</p>
          </div>
        </div>
      )}

      {gameState.phase === GamePhase.SELECT_OPPONENT && (
        <div className="w-full h-full p-10 bg-[#1a1a1a] overflow-hidden relative">
          <h2 className="text-4xl text-white font-black mb-8 border-b-4 border-yellow-600 pb-4 flex justify-between items-center">
            老師選擇
            <span className="text-xl text-zinc-500 font-normal">請選擇畢業考對象</span>
          </h2>
          <div className="grid grid-cols-3 gap-10 max-w-6xl mx-auto overflow-y-auto max-h-[80vh] pr-4 custom-scrollbar p-4">
            {INSTRUCTORS.map(inst => (
              <div key={inst.id} onClick={() => startNewRound(inst, 25000, 25000 + (inst.id - 1) * 5000, 100)} className="group bg-zinc-900 border-4 border-zinc-700 p-6 flex flex-col items-center cursor-pointer hover:border-yellow-500 transform hover:scale-105 transition-all relative overflow-hidden">
                {graduatedIds.includes(inst.id) && (
                  <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none select-none">
                    <div className="relative flex flex-col items-center animate-stamp">
                       {/* 強化版紅色印章效果：文字 + 邊框 */}
                       <div className="border-[8px] border-red-600 text-red-600 font-black text-6xl px-10 py-3 rounded-xl bg-black/90 backdrop-blur-md shadow-[0_0_40px_rgba(220,38,38,0.8)] border-double tracking-widest uppercase flex flex-col items-center rotate-[-15deg]">
                          <span>CLEAR</span>
                          <span className="text-xl mt-[-5px] bg-red-600 text-white px-2 rounded-sm">GRADUATED</span>
                       </div>
                    </div>
                  </div>
                )}
                <img src={inst.avatar} className={`w-48 h-48 object-cover mb-4 rounded border-2 border-zinc-500 group-hover:border-yellow-500 shadow-lg ${graduatedIds.includes(inst.id) ? 'grayscale opacity-30' : ''}`} />
                <h3 className={`text-2xl font-bold ${graduatedIds.includes(inst.id) ? 'text-zinc-600' : 'text-white'}`}>{inst.name}</h3>
                <p className="text-zinc-500 text-sm text-center mt-2 h-10 overflow-hidden">{inst.description}</p>
                <div className="mt-4 flex gap-1">
                   {Array.from({length: 9}).map((_, i) => (
                     <div key={i} className={`w-3 h-3 rotate-45 ${i < inst.difficulty ? 'bg-yellow-600' : 'bg-zinc-800'}`} />
                   ))}
                </div>
              </div>
            ))}
          </div>
          <style>{`
            @keyframes stamp {
              0% { transform: scale(3) rotate(-15deg); opacity: 0; }
              50% { transform: scale(1) rotate(-15deg); opacity: 1; }
              70% { transform: scale(1.1) rotate(-15deg); }
              100% { transform: scale(1) rotate(-15deg); opacity: 1; }
            }
            .animate-stamp {
              animation: stamp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
          `}</style>
        </div>
      )}

      {gameState.phase === GamePhase.PLAYING && (
        <MahjongGame 
          state={gameState} 
          onDiscard={handlePlayerDiscard} 
          onUseSkill={useSkill} 
          onTsumo={() => handleCall('ron')} 
          onCall={handleCall} 
          isPendingReach={isPendingReach}
        />
      )}

      {gameState.phase === GamePhase.RESULT && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-10">
          <div className="absolute top-10 left-10 flex gap-10">
             <div className="text-white text-3xl font-black">玩家: <span className="text-yellow-500">{gameState.playerScore}</span></div>
             <div className="text-white text-3xl font-black italic">VS</div>
             <div className="text-white text-3xl font-black">老師: <span className="text-red-500">{gameState.cpuScore}</span></div>
          </div>
          
          <h2 className={`text-9xl font-black mb-6 drop-shadow-lg ${gameState.winningHand?.winner === 'player' ? 'text-yellow-500 animate-bounce' : 'text-red-600'}`}>
            {gameState.winningHand ? (gameState.winningHand.winner === 'player' ? '和了' : '被胡牌') : '流局'}
          </h2>

          {/* New Result Hand Display: Shows all 14 tiles (Hand + Melds) sorted and grouped */}
          <div className="flex justify-center items-end gap-2 mb-10 overflow-x-auto max-w-full bg-white/5 p-6 rounded-xl border border-white/10 flex-wrap">
            <div className="flex gap-1">
                {/* Standing Tiles (Sorted) */}
                {sortHand(gameState.winningHand?.hand || []).map((t, i) => (
                    <MahjongTile key={i} tile={t} size="md" className="pointer-events-none" />
                ))}
            </div>
            {/* Melds (If any) */}
            {gameState.winningHand?.melds && gameState.winningHand.melds.length > 0 && (
                <div className="flex gap-4 ml-6 pl-6 border-l-2 border-white/10">
                    {gameState.winningHand.melds.map((meld, i) => (
                        <div key={i} className="flex gap-0.5">
                            {meld.tiles.map((t, j) => <MahjongTile key={j} tile={t} size="md" className="pointer-events-none opacity-90" />)}
                        </div>
                    ))}
                </div>
            )}
            {!gameState.winningHand && <span className="text-4xl text-white/50 font-bold">流局</span>}
          </div>

          <div className="text-center mb-10 min-h-[120px]">
            {gameState.winningHand?.yaku.map(y => (
              <div key={y.name} className={`text-4xl font-black italic mb-2 ${y.name.includes('懸賞') || y.name.includes('絕技') ? 'text-orange-400' : 'text-yellow-400'}`}>
                {y.name} {y.fan}番
              </div>
            ))}
            {gameState.winningHand && (
              <div className="text-white text-6xl font-black mt-6 border-t-2 border-white/20 pt-4">
                {gameState.winningHand.fu}符 {gameState.winningHand.fan}番：{gameState.winningHand.points}點
              </div>
            )}
          </div>

          <button onClick={handleNextRound} className="bg-red-700 hover:bg-red-600 text-white px-20 py-6 text-4xl font-black rounded-lg border-b-8 border-red-900 active:border-b-0 active:translate-y-2 transition-all">
            {gameState.cpuScore <= 0 ? '挑戰成功：返回老師選擇' : 'NEXT ROUND'}
          </button>
        </div>
      )}

      {gameState.phase === GamePhase.GAME_OVER && (
        <div className="fixed inset-0 bg-black z-[300] flex flex-col items-center justify-center p-10 animate-fade-in">
          <div className="relative w-full max-w-4xl flex flex-col items-center">
            <img 
              src="https://raw.githubusercontent.com/BillyPan/MJA2/main/win.png" 
              alt="Graduation" 
              className="w-full h-auto object-contain rounded-lg shadow-[0_0_50px_rgba(255,215,0,0.5)] border-4 border-yellow-500/50"
            />
            <div className="mt-12 text-center">
              <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-300 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)] tracking-widest animate-pulse">
                國士無雙高手，畢業快樂!
              </h1>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-16 bg-red-800 hover:bg-red-700 text-white px-12 py-4 text-2xl font-black rounded border-b-4 border-red-950 hover:border-b-0 hover:translate-y-1 transition-all"
            >
              RETURN TO TITLE
            </button>
          </div>
          <style>{`
            @keyframes fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .animate-fade-in {
              animation: fade-in 1s ease-out forwards;
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default App;