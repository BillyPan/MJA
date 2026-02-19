
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GamePhase, Instructor, Tile, CallActions, Meld, WinningResult } from './types';
import { INSTRUCTORS, createDeck } from './constants';
import { sortHand, checkWin, calculateFinalScore, getWaitingTiles, isFuriten, canPon, canChi, canKan, checkOwnTurnKan, getBestDiscard, shouldCPUCall, calculateShanten, generateSpecialHand, getChiCombinations, generateAmaterasuHand, generateLuckyStart } from './services/mahjongEngine';
import { getInstructorDialogue } from './services/gemini';
import MahjongGame from './components/MahjongGame';
import MahjongTile from './components/MahjongTile';

const STAGE_CLEAR_DIALOGUES: Record<number, string> = {
  1: "怎麼會輸成這樣，連心都被你整個奪走了", // 美雪
  2: "太犯規了吧你，把我打到全身都在發燙", // 麗奈
  3: "我明明想冷靜，卻被你這一手徹底打亂", // 靜香
  4: "牌輸了還能忍，但臉紅成這樣我不行了", // 優子
  5: "你真的很壞，把我一步步逼到完全失守", // 小藍
  6: "完全被你掌控，連心跳都不聽我指揮", // 佐和子
  7: "原來我也會這樣輸得不矜持，太危險了", // 惠美
  8: "連我都被你看穿，這種輸法太刺激了", // 神秘客
  9: "居然被你擊倒，這種快感我不想承認"  // 畢業生
};

const App: React.FC = () => {
  const [graduatedIds, setGraduatedIds] = useState<number[]>([]);
  const [isPendingReach, setIsPendingReach] = useState(false);
  
  // Mobile/Tablet Optimization Hooks
  const [layoutDims, setLayoutDims] = useState({ w: 1280, h: 720, scale: 1, needsScaling: false });
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isLandscape = w > h;
        setIsPortrait(!isLandscape);

        const targetW = 1280;
        const targetH = 720;
        
        const needsScaling = w < targetW || h < targetH;

        if (needsScaling) {
           const scaleX = w / targetW;
           const scaleY = h / targetH;
           const scale = Math.min(scaleX, scaleY);
           setLayoutDims({ w: targetW, h: targetH, scale, needsScaling: true });
        } else {
           setLayoutDims({ w: w, h: h, scale: 1, needsScaling: false });
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [gameState, setGameState] = useState<GameState>({
    playerHand: [],
    playerMelds: [],
    cpuHand: [],
    cpuMelds: [],
    deck: [],
    playerDiscards: [],
    cpuDiscards: [],
    currentTurn: 'player',
    playerEnergy: 100, // Initial EP is 100
    playerScore: 25000,
    cpuScore: 25000,
    phase: GamePhase.INTRO,
    selectedInstructor: null,
    message: "歡迎來到麻雀學園！",
    isPlayerReach: false,
    isCpuReach: false,
    lastDiscardTile: null,
    pendingCall: null,
    chiCombinations: null, // Initial state
    doraIndicator: null,
    isPlayerFuriten: false,
    isWinAnimation: false,
    skillUsedCount: 0,
  });

  const saveProgress = (id: number) => {
    setGraduatedIds(prev => [...new Set([...prev, id])]);
  };

  const playSound = (type: 'draw' | 'discard' | 'win' | 'call' | 'skill' | 'stage_clear') => {
    const urls = {
      draw: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      discard: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
      call: 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
      skill: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
      stage_clear: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3' 
    };
    new Audio(urls[type]).play().catch(() => {});
  };

  useEffect(() => {
    if (gameState.isWinAnimation) {
      playSound('win');
      const isAmaterasu = gameState.winningHand?.yaku.some(y => y.name.includes('天照'));
      const delay = isAmaterasu ? 8000 : (gameState.winningHand?.winner === 'cpu' ? 4000 : 2500);
      
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

  useEffect(() => {
    if (gameState.phase === GamePhase.STAGE_CLEAR) {
        playSound('stage_clear');
        const timer = setTimeout(() => {
            setGameState(prev => ({ 
                ...prev, 
                phase: GamePhase.SELECT_OPPONENT, 
                playerScore: 25000, 
                cpuScore: 25000,
                playerEnergy: prev.playerEnergy 
            }));
        }, 10000); // 10秒
        return () => clearTimeout(timer);
    }
  }, [gameState.phase]);

  const startNewRound = (instructor: Instructor, pScore: number, cScore: number, pEnergy: number, existingSkillCount: number = 0) => {
    const deck = createDeck();
    let playerHand: Tile[];
    let initMsg = `${instructor.name}：請多指教囉！`;

    if (Math.random() < 0.80) {
        const luckyResult = generateLuckyStart(deck);
        if (luckyResult) {
            playerHand = luckyResult.hand;
            initMsg = `${instructor.name}：【好手氣】起手牌不錯喔！`;
        } else {
            playerHand = sortHand(deck.splice(0, 13));
        }
    } else {
        playerHand = sortHand(deck.splice(0, 13));
    }

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
      playerEnergy: Math.min(300, pEnergy + 10),
      playerScore: pScore,
      cpuScore: cScore,
      isPlayerReach: false,
      isCpuReach: false,
      isPlayerFuriten: false,
      winningHand: undefined,
      message: initMsg,
      pendingCall: null,
      chiCombinations: null,
      lastDiscardTile: null,
      isWinAnimation: false,
      skillUsedCount: existingSkillCount,
    }));
    setTimeout(() => playerDraw(), 800);
  };

  const playerDraw = () => {
    setGameState(prev => {
      if (prev.deck.length === 0) return { ...prev, phase: GamePhase.RESULT, message: "流局！" };
      playSound('draw');
      const newDeck = [...prev.deck];
      const drawn = newDeck.pop()!;
      const newHand = [...prev.playerHand, drawn];
      const kanTile = checkOwnTurnKan(newHand, prev.playerMelds);
      
      const canTsumoRes = calculateFinalScore(newHand, prev.playerMelds, true, prev.isPlayerReach, prev.doraIndicator);
      
      const calls: CallActions = { ron: false, pon: false, chi: false, kan: !!kanTile };
      return {
        ...prev,
        deck: newDeck,
        playerHand: newHand,
        playerEnergy: Math.min(300, prev.playerEnergy + 5),
        currentTurn: 'player',
        pendingCall: calls.kan ? calls : null,
        lastDiscardTile: kanTile || null, 
        message: canTsumoRes ? "可以自摸囉！" : prev.message
      };
    });
  };

  const cpuDiscard = () => {
    setGameState(prev => {
      const difficulty = prev.selectedInstructor?.difficulty || 1;
      if (prev.cpuHand.length === 0) return prev;

      const discardIdx = getBestDiscard(prev.cpuHand, prev.cpuMelds, difficulty, prev.cpuDiscards, prev.isCpuReach);
      const newHand = [...prev.cpuHand];
      const discarded = newHand.splice(discardIdx, 1)[0];
      const newCpuDiscards = [...prev.cpuDiscards, discarded];
      const sortedCpuHand = sortHand(newHand);

      const playerCanRon = calculateFinalScore(
        [...prev.playerHand, discarded], 
        prev.playerMelds, 
        false, 
        prev.isPlayerReach, 
        prev.doraIndicator, 
        false
      );

      let callActions: CallActions | null = null;
      let chiCombs: Tile[][] | null = null;

      if (playerCanRon) {
        callActions = { ron: true, pon: false, chi: false, kan: false };
      }

      if (!prev.isPlayerReach) {
         const cPon = canPon(prev.playerHand, discarded);
         const cKan = canKan(prev.playerHand, discarded);
         const cChi = canChi(prev.playerHand, discarded);
         
         if (cPon || cKan || cChi) {
             callActions = callActions || { ron: false, pon: false, chi: false, kan: false };
             if (cPon) callActions.pon = true;
             if (cKan) callActions.kan = true;
             if (cChi) {
                 callActions.chi = true;
                 chiCombs = getChiCombinations(prev.playerHand, discarded);
             }
         }
      }

      if (!callActions) {
         setTimeout(playerDraw, 500);
      }

      return {
          ...prev,
          cpuHand: sortedCpuHand,
          cpuDiscards: newCpuDiscards,
          lastDiscardTile: discarded,
          currentTurn: callActions ? 'player' : 'player', 
          pendingCall: callActions,
          chiCombinations: chiCombs,
          message: `${prev.selectedInstructor?.name}：打出 ${
            discarded.type === 'z' 
              ? (['','東','南','西','北','白','發','中'][discarded.value]) 
              : `${discarded.value}${discarded.type === 'm' ? '萬' : discarded.type === 'p' ? '筒' : '索'}`
          }`
      };
    });
  };

  const cpuDraw = () => {
    setGameState(prev => {
      if (prev.deck.length === 0) return { ...prev, phase: GamePhase.RESULT, message: "流局！" };
      
      const newDeck = [...prev.deck];
      const drawn = newDeck.pop()!;
      const newHand = [...prev.cpuHand, drawn];
      
      const winResult = calculateFinalScore(newHand, prev.cpuMelds, true, prev.isCpuReach, prev.doraIndicator, true); 

      if (winResult) {
          setTimeout(() => {
              setGameState(ps => ({
                  ...ps,
                  cpuScore: ps.cpuScore + winResult.points,
                  playerScore: ps.playerScore - winResult.points,
                  winningHand: { ...winResult, winner: 'cpu' },
                  isWinAnimation: true,
                  message: `${ps.selectedInstructor?.name}：自摸！`
              }));
          }, 500);
          return { ...prev, deck: newDeck, cpuHand: newHand };
      }
      
      setTimeout(cpuDiscard, 500);

      return {
        ...prev,
        deck: newDeck,
        cpuHand: newHand,
        currentTurn: 'cpu',
        message: prev.message 
      };
    });
  };

  const handleCall = (action: keyof CallActions | 'PASS', tiles?: Tile[]) => {
    if (action === 'PASS') {
        setGameState(prev => {
            // 修正：如果手牌已經是滿的 (例如槓牌後摸了嶺上牌又觸發槓牌詢問，此時選擇 PASS)，
            // 不應該再摸牌，而是直接進入棄牌階段。
            // 14張, 11張, 8張... % 3 === 2
            if (prev.playerHand.length % 3 === 2) {
                 return { ...prev, pendingCall: null, chiCombinations: null, lastDiscardTile: null, message: "請棄牌" };
            }
            setTimeout(playerDraw, 300);
            return { ...prev, pendingCall: null, chiCombinations: null, message: "過牌..." };
        });
        return;
    }

    if (action === 'ron') {
        setGameState(prev => {
            const isTsumo = prev.currentTurn === 'player' && !prev.pendingCall?.ron;
            const targetTile = isTsumo ? prev.playerHand[prev.playerHand.length - 1] : prev.lastDiscardTile;

            if (!targetTile && !isTsumo) return prev;

            const handForCalc = isTsumo ? prev.playerHand : [...prev.playerHand, targetTile!];
            const res = calculateFinalScore(
                handForCalc, 
                prev.playerMelds, 
                isTsumo, 
                prev.isPlayerReach, 
                prev.doraIndicator, 
                false
            );

            if (res) {
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
                     message: isTsumo ? "自摸！" : "榮和！"
                 };
            }
            return prev;
        });
        return;
    }

    setGameState(prev => {
        const discard = prev.lastDiscardTile!;
        let newHand = [...prev.playerHand];
        let meldTiles: Tile[] = [];
        let isClosed = false;
        
        const isSelfTurn = prev.currentTurn === 'player';
        
        if (action === 'kan' && isSelfTurn) {
             isClosed = true;
             const kTile = prev.lastDiscardTile || checkOwnTurnKan(prev.playerHand, prev.playerMelds);
             if (!kTile) return prev;
             const quads = newHand.filter(t => t.type === kTile.type && t.value === kTile.value);
             newHand = newHand.filter(t => !quads.includes(t));
             meldTiles = quads;
        } else if (action === 'kan') {
             const triplets = newHand.filter(t => t.type === discard.type && t.value === discard.value).slice(0, 3);
             newHand = newHand.filter(t => !triplets.includes(t));
             meldTiles = [...triplets, discard];
        } else if (action === 'pon') {
             const pairs = newHand.filter(t => t.type === discard.type && t.value === discard.value).slice(0, 2);
             newHand = newHand.filter(t => !pairs.includes(t));
             meldTiles = [...pairs, discard];
        } else if (action === 'chi') {
             if (!tiles) return prev;
             newHand = newHand.filter(t => !tiles.some(x => x.id === t.id));
             meldTiles = [...tiles, discard].sort((a,b) => a.value - b.value);
        }

        const newMeld: Meld = {
            type: action as any,
            tiles: meldTiles,
            isClosed
        };

        if (action === 'kan') {
             const newDeck = [...prev.deck];
             const replacement = newDeck.pop();
             if (!replacement) return { ...prev, phase: GamePhase.RESULT, message: "流局" };
             newHand.push(replacement);
             const nextKan = checkOwnTurnKan(newHand, [...prev.playerMelds, newMeld]);
             const nextCall = nextKan ? { ron:false, pon:false, chi:false, kan:true } : null;

             return {
                 ...prev,
                 playerHand: newHand,
                 playerMelds: [...prev.playerMelds, newMeld],
                 deck: newDeck,
                 currentTurn: 'player',
                 pendingCall: nextCall,
                 lastDiscardTile: nextKan || null,
                 message: "槓！嶺上牌..."
             };
        }

        return {
            ...prev,
            playerHand: newHand,
            playerMelds: [...prev.playerMelds, newMeld],
            currentTurn: 'player',
            pendingCall: null,
            chiCombinations: null,
            lastDiscardTile: null,
            message: `${action === 'chi' ? '吃' : '碰'}！請棄牌`
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
    if (isPendingReach) {
        reachStatus = true;
    }
    setIsPendingReach(false);

    const waiting = getWaitingTiles(newHand, gameState.playerMelds);
    const isNowFuriten = isFuriten(updatedDiscards, waiting);

    setGameState(prev => ({
      ...prev,
      playerHand: sortHand(newHand),
      playerDiscards: updatedDiscards,
      isPlayerFuriten: isNowFuriten,
      isPlayerReach: reachStatus,
      lastDiscardTile: discarded,
      currentTurn: 'cpu',
      pendingCall: null,
      message: Math.random() < 0.7 ? getInstructorDialogue() : prev.message
    }));

    const cpuDifficulty = gameState.selectedInstructor?.difficulty || 1;
    
    const cpuWin = calculateFinalScore(
        [...gameState.cpuHand, discarded], 
        gameState.cpuMelds, 
        false, 
        gameState.isCpuReach, 
        gameState.doraIndicator, 
        true
    );

    if (cpuWin) {
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          cpuScore: prev.cpuScore + cpuWin.points,
          playerScore: prev.playerScore - cpuWin.points,
          winningHand: { ...cpuWin, winner: 'cpu' },
          message: `${prev.selectedInstructor?.name}：胡牌！畢業了！`,
          isWinAnimation: true
        }));
      }, 500); 
      return;
    }

    if (!gameState.isCpuReach) {
      if (canPon(gameState.cpuHand, discarded) && shouldCPUCall(gameState.cpuHand, gameState.cpuMelds, discarded, 'pon', cpuDifficulty)) {
        setTimeout(() => cpuCall('pon', discarded), 500); 
        return;
      }
      if (canChi(gameState.cpuHand, discarded) && shouldCPUCall(gameState.cpuHand, gameState.cpuMelds, discarded, 'chi', cpuDifficulty)) {
        setTimeout(() => cpuCall('chi', discarded), 500); 
        return;
      }
    }

    setTimeout(cpuDraw, 500);
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
        cpuMelds: [...prev.cpuMelds, { type, tiles: newMeld, isClosed: false }],
        message: `${prev.selectedInstructor?.name}：${type === 'pon' ? '碰' : '吃'}！`,
        currentTurn: 'cpu'
      };
    });
    setTimeout(cpuDiscard, 500);
  };

  const useSkill = (skillType: string) => {
    if (skillType === 'CHEAT_CHARGE') {
      setGameState(prev => ({ ...prev, playerEnergy: 300 }));
      return;
    }

    if (skillType === 'REACH') {
      playSound('skill');
      setIsPendingReach(true);
      setGameState(prev => ({ ...prev, message: "宣告立直！", pendingCall: null }));

    } else if (skillType === 'TSUMO' && gameState.playerEnergy >= 100) {
      playSound('skill');
      
      const godHandData = generateSpecialHand(); 
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

    } else if (skillType === 'EXCHANGE' && gameState.playerEnergy >= 40) {
      if (gameState.playerHand.length % 3 !== 2) return;
      playSound('skill');
      setGameState(prev => {
        let newDeck = [...prev.deck];
        let drawn: Tile;
        let msg = "換牌術發動！";

        const lastIndex = prev.playerHand.length - 1;
        const handWithoutLast = prev.playerHand.slice(0, lastIndex);
        const waiters = getWaitingTiles(handWithoutLast, prev.playerMelds);
        
        let forcedWin = false;
        if ((prev.isPlayerReach || isPendingReach) && waiters.length > 0) {
            if (Math.random() < 0.70) {
                const deckCandidates = waiters.filter(w => {
                    const t = w[0] as any;
                    const v = parseInt(w.slice(1));
                    return newDeck.some(dt => dt.type === t && dt.value === v);
                });
                
                if (deckCandidates.length > 0) {
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
          newDeck = newDeck.sort(() => Math.random() - 0.5);
          drawn = newDeck.pop()!;
        }

        const lastTile = prev.playerHand[lastIndex];
        newDeck.push(lastTile);
        
        const sortedBase = sortHand(handWithoutLast);
        const newHand = [...sortedBase, drawn];

        return { 
          ...prev, 
          playerHand: newHand, 
          deck: newDeck, 
          playerEnergy: prev.playerEnergy - 40, 
          message: msg 
        };
      });
    } else if (skillType === 'AMATERASU' && gameState.playerEnergy >= 300) {
      playSound('skill');
      const amaterasuResult = generateAmaterasuHand();
      
      setGameState(prev => {
        const newHand = amaterasuResult.hand;
        const newMelds = amaterasuResult.melds;
        
        const cpuNewScore = Math.max(0, prev.cpuScore - 100000); 
        
        if (prev.selectedInstructor && cpuNewScore <= 0) {
           saveProgress(prev.selectedInstructor.id);
        }

        return {
           ...prev,
           playerEnergy: prev.playerEnergy - 300,
           playerHand: newHand,
           playerMelds: newMelds, 
           playerScore: prev.playerScore + amaterasuResult.points, 
           cpuScore: cpuNewScore, 
           winningHand: amaterasuResult,
           isWinAnimation: true,
           message: "禁忌·天照大神！森羅萬象灰飛煙滅！"
        };
      });
    }
  };

  const handleNextRound = () => {
    if (!gameState.selectedInstructor) {
      setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }));
      return;
    }
    
    if (gameState.cpuScore <= 0 && gameState.selectedInstructor) {
        saveProgress(gameState.selectedInstructor.id);
    }

    if (gameState.cpuScore <= 0) {
        const currentId = gameState.selectedInstructor.id;
        const allClearedIds = new Set(graduatedIds);
        allClearedIds.add(currentId);
        
        if (allClearedIds.size >= INSTRUCTORS.length) {
             setGameState(prev => ({ ...prev, phase: GamePhase.GAME_OVER }));
             return;
        }

        setGameState(prev => ({ ...prev, phase: GamePhase.STAGE_CLEAR }));
        return;
    } 
    
    if (gameState.playerScore <= 0) {
        setGameState(prev => ({ 
            ...prev, 
            phase: GamePhase.SELECT_OPPONENT, 
            playerScore: 25000, 
            cpuScore: 25000,
            playerEnergy: 100 
        }));
        return;
    }

    startNewRound(
        gameState.selectedInstructor, 
        gameState.playerScore, 
        gameState.cpuScore, 
        gameState.playerEnergy,
        gameState.skillUsedCount 
    );
  };

  const formatLargeNumber = (num: number) => {
    if (num < 100000000) return num.toLocaleString();
    const exponent = Math.floor(Math.log10(num));
    const mantissa = (num / Math.pow(10, exponent)).toFixed(2);
    return <>{mantissa} × 10<sup className="text-4xl ml-1">{exponent}</sup></>;
  };

  return (
    <>
        <div className={`fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center text-white transition-opacity duration-300 ${isPortrait ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
             <div className="animate-pulse flex flex-col items-center">
                <div className="w-16 h-24 border-4 border-white rounded-lg mb-4 animate-spin-slow"></div>
                <p className="text-2xl font-bold">請將裝置轉為橫向</p>
                <p className="text-sm mt-2 text-zinc-400">Please rotate your device</p>
             </div>
             <style>{`
               @keyframes spin-slow {
                 0% { transform: rotate(0deg); }
                 25% { transform: rotate(90deg); }
                 100% { transform: rotate(90deg); }
               }
               .animate-spin-slow {
                 animation: spin-slow 2s infinite ease-in-out;
               }
             `}</style>
        </div>

        <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden serif-font">
            <div style={
                layoutDims.needsScaling ? {
                    width: `${layoutDims.w}px`,
                    height: `${layoutDims.h}px`,
                    transform: `scale(${layoutDims.scale})`,
                    transformOrigin: 'center center',
                    boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                    position: 'absolute'
                } : {
                    width: '100%',
                    height: '100%'
                }
            }>
                {gameState.isWinAnimation && (
                    <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/60 pointer-events-none">
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
                    <div className="text-center flex flex-col items-center justify-center h-full w-full">
                    <div className="flex flex-col items-center">
                        <h1 className="text-9xl font-black mb-4 text-yellow-500 italic drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">麻雀學園</h1>
                        <h2 className="text-6xl text-white tracking-[0.5em] border-y-2 py-4 w-full text-center">卒業篇</h2>
                    </div>
                    <div className="flex flex-col items-center mt-20">
                        <button onClick={() => setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }))} className="bg-red-700 text-white px-12 py-4 text-3xl font-black animate-pulse shadow-[0_0_20px_rgba(185,28,28,0.5)]">INSERT COIN</button>
                        <p className="mt-20 text-zinc-500 text-xl font-bold tracking-wider opacity-50">【bILLYpAN Gemini Vibe Coding 複刻試作 Ver 1.23】</p>
                    </div>
                    </div>
                )}

                {gameState.phase === GamePhase.SELECT_OPPONENT && (
                    <div className="w-full h-full p-6 bg-[#1a1a1a] overflow-hidden relative flex flex-col">
                    <h2 className="text-4xl text-white font-black mb-6 border-b-4 border-yellow-600 pb-4 flex justify-between items-center flex-shrink-0">
                        老師選擇
                        <span className="text-xl text-zinc-500 font-normal">請選擇畢業考對象</span>
                    </h2>
                    <div className="grid grid-cols-3 gap-10 max-w-6xl mx-auto overflow-y-auto pr-4 custom-scrollbar p-4 flex-1 min-h-0">
                        {INSTRUCTORS.map(inst => (
                        <div 
                            key={inst.id} 
                            onClick={() => {
                                if (graduatedIds.includes(inst.id)) {
                                    setGameState(prev => ({ 
                                        ...prev, 
                                        selectedInstructor: inst,
                                        phase: GamePhase.STAGE_CLEAR 
                                    }));
                                } else {
                                    startNewRound(inst, 25000, 25000 + (inst.id - 1) * 5000, gameState.playerEnergy);
                                }
                            }} 
                            className="group bg-zinc-900 border-4 border-zinc-700 p-2 flex flex-col items-center cursor-pointer hover:border-yellow-500 transform hover:scale-105 transition-all relative overflow-hidden flex-shrink-0 shadow-xl"
                        >
                            {graduatedIds.includes(inst.id) && (
                            <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none select-none">
                                <div className="relative flex flex-col items-center animate-stamp">
                                <div className="border-[8px] border-red-600 text-red-600 font-black text-6xl px-10 py-3 rounded-xl bg-black/90 backdrop-blur-md shadow-[0_0_40px_rgba(220,38,38,0.8)] border-double tracking-widest uppercase flex flex-col items-center rotate-[-15deg]">
                                    <span>CLEAR</span>
                                    <span className="text-xl mt-[-5px] bg-red-600 text-white px-2 rounded-sm">GRADUATED</span>
                                </div>
                                </div>
                            </div>
                            )}
                            
                            <div className="relative w-full h-[400px] bg-zinc-800 rounded border border-zinc-600 group-hover:border-yellow-500 overflow-hidden">
                                <img src={inst.avatar} className={`w-full h-full object-cover object-[50%_25%] ${graduatedIds.includes(inst.id) ? 'grayscale opacity-30' : ''}`} />
                                <div className="absolute bottom-0 left-0 w-full pb-3 pt-12 bg-gradient-to-t from-white/90 via-white/50 to-transparent">
                                    <h3 className={`text-4xl font-black text-center w-full truncate relative z-10 ${graduatedIds.includes(inst.id) ? 'text-zinc-600' : 'text-black'}`} style={graduatedIds.includes(inst.id) ? {} : { textShadow: '2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 0 0 #fff, -2px 0 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff' }}>
                                        {inst.name}
                                    </h3>
                                </div>
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

                {gameState.phase === GamePhase.RESULT && (() => {
                    const isAmaterasu = gameState.winningHand?.yaku.some(y => y.name.includes('天照')) || (gameState.winningHand?.points ?? 0) > 100000;

                    return (
                    <div className={`absolute inset-0 bg-black/95 z-[200] flex ${isAmaterasu ? '' : 'flex-col items-center justify-center'} p-10`}>
                    
                    <div className="absolute top-10 left-10 flex gap-10 z-10">
                        <div className="text-white text-3xl font-black">玩家: <span className="text-yellow-500">{gameState.playerScore}</span></div>
                        <div className="text-white text-3xl font-black italic">VS</div>
                        <div className="text-white text-3xl font-black">老師: <span className="text-red-500">{gameState.cpuScore}</span></div>
                    </div>
                    
                    <h2 className={`text-9xl font-black mb-6 drop-shadow-lg ${isAmaterasu ? 'absolute bottom-10 right-10 z-0 opacity-50 text-[8rem]' : 'relative'} ${gameState.winningHand?.winner === 'player' ? 'text-yellow-500 animate-bounce' : 'text-red-600'}`}>
                        {gameState.winningHand ? (gameState.winningHand.winner === 'player' ? '和了' : '老師胡牌!') : '流局'}
                    </h2>

                    {isAmaterasu && (
                        <div className="absolute top-10 right-10 z-50">
                            <button onClick={handleNextRound} className="bg-red-700 hover:bg-red-600 text-white px-12 py-4 text-3xl font-black rounded-lg border-b-8 border-red-900 active:border-b-0 active:translate-y-2 transition-all shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-pulse">
                                {gameState.cpuScore <= 0 ? '挑戰成功' : 'NEXT ROUND'}
                            </button>
                        </div>
                    )}

                    <div className={`w-full flex flex-col ${isAmaterasu ? 'mt-32 h-full' : 'items-center'}`}>

                        <div className={`flex justify-center items-end gap-2 mb-10 overflow-x-auto max-w-full bg-white/5 p-6 rounded-xl border border-white/10 flex-wrap ${isAmaterasu ? 'mx-auto scale-90 origin-top' : ''}`}>
                            <div className="flex gap-1">
                                {sortHand(gameState.winningHand?.hand || []).map((t, i) => (
                                    <MahjongTile key={i} tile={t} size="md" className="pointer-events-none" />
                                ))}
                            </div>
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

                        <div className={`${isAmaterasu ? 'grid grid-cols-2 gap-x-12 gap-y-1 w-full max-w-6xl px-10 overflow-y-auto max-h-[45vh] pr-4 custom-scrollbar' : 'flex flex-col items-center text-center mb-10 min-h-[120px]'}`}>
                            {gameState.winningHand?.yaku.map(y => (
                            <div key={y.name} className={`font-black italic ${isAmaterasu ? 'text-3xl text-left border-b border-white/10 pb-1' : 'text-4xl mb-2'} ${y.name.includes('懸賞') || y.name.includes('絕技') || y.name.includes('寶牌') ? 'text-orange-400' : 'text-yellow-400'}`}>
                                <span className="mr-4">{y.name}</span>
                                <span className={isAmaterasu ? 'float-right' : ''}>{y.fan}番</span>
                            </div>
                            ))}
                        </div>
                        
                        {gameState.winningHand && (
                        <div className={`text-white font-black mt-6 border-t-2 border-white/20 pt-4 ${isAmaterasu ? 'absolute bottom-10 left-10 text-8xl z-50 drop-shadow-xl' : 'text-6xl text-center'}`}>
                            {gameState.winningHand.fu}符 {gameState.winningHand.fan}番：{
                                gameState.winningHand.points > 100000 
                                ? formatLargeNumber(gameState.winningHand.points)
                                : gameState.winningHand.points + "點"
                            }
                        </div>
                        )}
                    </div>

                    {!isAmaterasu && (
                        <div className="absolute bottom-10 right-10 z-50">
                            <button onClick={handleNextRound} className="bg-red-700 hover:bg-red-600 text-white px-20 py-6 text-4xl font-black rounded-lg border-b-8 border-red-900 active:border-b-0 active:translate-y-2 transition-all animate-pulse">
                                {gameState.cpuScore <= 0 ? '挑戰成功' : 'NEXT ROUND'}
                            </button>
                        </div>
                    )}

                    </div>
                    );
                })()}

                {gameState.phase === GamePhase.STAGE_CLEAR && (
                    <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black overflow-hidden animate-fade-in">
                        <img 
                            src={`https://raw.githubusercontent.com/BillyPan/MJA2/main/${gameState.selectedInstructor?.id || 1}.webp`}
                            className="w-full h-full object-contain"
                            alt="Stage Clear"
                        />
                        <div className="absolute bottom-10 w-full flex justify-center">
                            <div className="bg-black/70 px-8 py-4 rounded-full border border-yellow-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                                <p className="text-3xl text-yellow-100 font-black tracking-widest drop-shadow-md text-center italic">
                                    {STAGE_CLEAR_DIALOGUES[gameState.selectedInstructor?.id || 1]}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {gameState.phase === GamePhase.GAME_OVER && (
                    <div className="absolute inset-0 bg-black z-[300] flex flex-col items-center justify-center p-10 animate-fade-in">
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
        </div>
    </>
  );
};

export default App;
