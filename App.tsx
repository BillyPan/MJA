
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GamePhase, Instructor, Tile, CallActions, Meld, WinningResult } from './types';
import { INSTRUCTORS, createDeck } from './constants';
import { sortHand, checkWin, calculateFinalScore, getWaitingTiles, isFuriten, canPon, canChi, canKan, checkOwnTurnKan, getBestDiscard, shouldCPUCall, calculateShanten } from './services/mahjongEngine';
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
  });

  useEffect(() => {
    const savedProgress = localStorage.getItem('mahjong_gakuen_progress');
    if (savedProgress) setGraduatedIds(JSON.parse(savedProgress));
  }, []);

  const saveProgress = (id: number) => {
    const newProgress = [...new Set([...graduatedIds, id])];
    setGraduatedIds(newProgress);
    localStorage.setItem('mahjong_gakuen_progress', JSON.stringify(newProgress));
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

  const updateMessage = async (event: string) => {
    if (!gameState.selectedInstructor) return;
    const dialogue = await getInstructorDialogue(gameState.selectedInstructor.name, event);
    setGameState(prev => ({ ...prev, message: dialogue }));
  };

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
    if (isPendingReach && getWaitingTiles(newHand, gameState.playerMelds).length > 0) reachStatus = true;
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
      pendingCall: null
    }));

    const cpuDifficulty = gameState.selectedInstructor?.difficulty || 1;
    
    // CPU 決策：先看能不能胡玩家棄的那張 (榮和)
    const cpuWin = calculateFinalScore([...gameState.cpuHand, discarded], gameState.cpuMelds, false, gameState.isCpuReach, gameState.doraIndicator, true);
    if (cpuWin) {
      setTimeout(() => {
        playSound('win');
        setGameState(prev => ({
          ...prev,
          phase: GamePhase.RESULT,
          cpuScore: prev.cpuScore + cpuWin.points,
          playerScore: prev.playerScore - cpuWin.points,
          winningHand: { ...cpuWin, winner: 'cpu' },
          message: `${prev.selectedInstructor?.name}：胡牌！畢業了！`
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

    // 都沒發生則輪到 CPU 摸牌
    setTimeout(cpuTurn, 1000);
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
    // CPU 鳴牌後必須進行棄牌
    setTimeout(cpuDiscard, 1000);
  };

  const cpuTurn = () => {
    setGameState(prev => {
      if (prev.deck.length === 0) return { ...prev, phase: GamePhase.RESULT, message: "流局！" };
      playSound('draw');
      const newDeck = [...prev.deck];
      const drawn = newDeck.pop()!;
      // CPU 手牌包含剛摸到的第14張
      const fullHand = [...prev.cpuHand, drawn];
      
      // 檢查 CPU 是否自摸
      const winResult = calculateFinalScore(fullHand, prev.cpuMelds, true, prev.isCpuReach, prev.doraIndicator, true);
      if (winResult) {
        playSound('win');
        return {
          ...prev,
          cpuHand: fullHand,
          phase: GamePhase.RESULT,
          cpuScore: prev.cpuScore + winResult.points,
          playerScore: prev.playerScore - winResult.points,
          winningHand: { ...winResult, winner: 'cpu' },
          message: `${prev.selectedInstructor?.name}：自摸！感謝招待！`
        };
      }

      // 檢查 CPU 是否可以立直
      if (!prev.isCpuReach && prev.cpuMelds.length === 0 && calculateShanten(fullHand, []) === 0) {
        if (Math.random() > 0.4) {
          return { ...prev, isCpuReach: true, cpuHand: fullHand, deck: newDeck };
        }
      }

      return { ...prev, cpuHand: fullHand, deck: newDeck };
    });

    setTimeout(cpuDiscard, 1000);
  };

  const cpuDiscard = () => {
    setGameState(prev => {
      let discardIdx = 0;
      if (prev.isCpuReach) {
        discardIdx = prev.cpuHand.length - 1; // 立直後固定摸打
      } else {
        discardIdx = getBestDiscard(prev.cpuHand, prev.cpuMelds, prev.selectedInstructor?.difficulty || 1, prev.playerDiscards, prev.isPlayerReach);
      }

      playSound('discard');
      const newHand = [...prev.cpuHand];
      const discarded = newHand.splice(discardIdx, 1)[0];
      const updatedDiscards = [...prev.cpuDiscards, discarded];

      // 判定玩家是否可以鳴牌或榮和
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
      };
    });
  };

  const handleCall = (action: keyof CallActions | 'PASS') => {
    if (action === 'PASS') {
      setGameState(prev => ({ ...prev, pendingCall: null }));
      playerDraw();
      return;
    }
    const tile = gameState.lastDiscardTile!;
    if (action === 'ron') {
      const isTsumoAction = gameState.playerHand.length === 14;
      const finalHand = isTsumoAction ? [...gameState.playerHand] : [...gameState.playerHand, tile];
      const result = calculateFinalScore(finalHand, gameState.playerMelds, isTsumoAction, gameState.isPlayerReach, gameState.doraIndicator);
      if (result) {
        playSound('win');
        const cpuNewScore = gameState.cpuScore - result.points;
        if (gameState.selectedInstructor && cpuNewScore <= 0) saveProgress(gameState.selectedInstructor.id);
        setGameState(prev => ({
          ...prev,
          phase: GamePhase.RESULT,
          playerScore: prev.playerScore + result.points,
          cpuScore: cpuNewScore,
          winningHand: { ...result, winner: 'player' },
          message: isTsumoAction ? "自摸！胡牌！" : "榮和！胡牌！"
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
    if (skillType === 'REACH' && gameState.playerEnergy >= 20) {
      playSound('skill');
      setIsPendingReach(true);
      setGameState(prev => ({ ...prev, playerEnergy: prev.playerEnergy - 20, message: "宣告立直！" }));
    } else if (skillType === 'TSUMO' && gameState.playerEnergy >= 90) {
      playSound('skill');
      const waiters = getWaitingTiles(gameState.playerHand.length === 14 ? gameState.playerHand.slice(0, 13) : gameState.playerHand, gameState.playerMelds);
      const t = waiters.length > 0 ? waiters[0] : "m1"; 
      const winTile = { id: 'skill-hu', type: t[0] as any, value: parseInt(t.slice(1)) };
      const res = calculateFinalScore([...(gameState.playerHand.length === 14 ? gameState.playerHand.slice(0, 13) : gameState.playerHand), winTile], gameState.playerMelds, true, gameState.isPlayerReach, gameState.doraIndicator, false, true);
      if (res) {
        setGameState(prev => ({
          ...prev,
          playerEnergy: prev.playerEnergy - 90,
          phase: GamePhase.RESULT,
          playerScore: prev.playerScore + res.points,
          cpuScore: prev.cpuScore - res.points,
          winningHand: { ...res, winner: 'player' },
          message: "必殺自摸！"
        }));
      }
    } else if (skillType === 'EXCHANGE' && gameState.playerEnergy >= 30) {
      if (gameState.playerHand.length < 14) return;
      playSound('skill');
      setGameState(prev => {
        let newDeck = [...prev.deck];
        let drawn: Tile;
        let msg = "換牌術發動！";

        // 前 13 張
        const handWithoutLast = prev.playerHand.slice(0, 13);
        const waiters = getWaitingTiles(handWithoutLast, prev.playerMelds);
        
        // 如果立直，高機率換到聽牌
        if (prev.isPlayerReach && waiters.length > 0 && Math.random() < 0.70) {
          const waiterIdx = newDeck.findIndex(t => waiters.includes(`${t.type}${t.value}`));
          if (waiterIdx !== -1) {
            drawn = newDeck.splice(waiterIdx, 1)[0];
            msg = "必殺換牌！一發入魂！";
          } else {
            newDeck = newDeck.sort(() => Math.random() - 0.5);
            drawn = newDeck.pop()!;
          }
        } else {
          newDeck = newDeck.sort(() => Math.random() - 0.5);
          drawn = newDeck.pop()!;
        }

        // 拿回剛摸到的最後一張牌 (第 14 張) 放回牌庫
        const lastTile = prev.playerHand[13];
        newDeck.push(lastTile);
        
        // 構造新手牌：前 13 張重新排序，第 14 張替換為新換到的牌
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
    if (!gameState.selectedInstructor) {
      setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }));
      return;
    }
    if (gameState.cpuScore <= 0 || gameState.playerScore <= 0) {
      setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT, playerScore: 25000, cpuScore: 25000 }));
    } else {
      startNewRound(gameState.selectedInstructor, gameState.playerScore, gameState.cpuScore, gameState.playerEnergy);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-black overflow-hidden serif-font">
      {gameState.phase === GamePhase.INTRO && (
        <div className="text-center flex flex-col items-center">
          <div className="flex flex-col items-center">
            <h1 className="text-9xl font-black mb-4 text-yellow-500 italic drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">麻雀學園</h1>
            <h2 className="text-6xl text-white tracking-[0.5em] border-y-2 py-4 w-full text-center">畢業篇</h2>
          </div>
          <div className="flex flex-col items-center mt-20">
            <button onClick={() => setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }))} className="bg-red-700 text-white px-12 py-4 text-3xl font-black animate-pulse shadow-[0_0_20px_rgba(185,28,28,0.5)]">INSERT COIN</button>
            <p className="mt-20 text-zinc-500 text-xl font-bold tracking-wider opacity-50">【bILLYpAN Gemini Vibe Coding 複刻試作 Ver 1.30】</p>
          </div>
        </div>
      )}

      {gameState.phase === GamePhase.SELECT_OPPONENT && (
        <div className="w-full h-full p-10 bg-[#1a1a1a] overflow-hidden relative">
          <h2 className="text-4xl text-white font-black mb-8 border-b-4 border-yellow-600 pb-4 flex justify-between items-center">
            講師選擇
            <span className="text-xl text-zinc-500 font-normal">請選擇畢業考對象</span>
          </h2>
          <div className="grid grid-cols-3 gap-10 max-w-6xl mx-auto overflow-y-auto max-h-[80vh] pr-4 custom-scrollbar p-4">
            {INSTRUCTORS.map(inst => (
              <div key={inst.id} onClick={() => startNewRound(inst, 25000, 25000, 100)} className="group bg-zinc-900 border-4 border-zinc-700 p-6 flex flex-col items-center cursor-pointer hover:border-yellow-500 transform hover:scale-105 transition-all relative">
                {graduatedIds.includes(inst.id) && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none select-none">
                    <div className="relative rotate-[-15deg] flex flex-col items-center animate-stamp">
                       {/* 強化版紅色印章效果 */}
                       <div className="border-[12px] border-red-600 text-red-600 font-black text-7xl px-12 py-4 rounded-3xl bg-red-600/10 backdrop-blur-[2px] shadow-[0_0_40px_rgba(220,38,38,0.8)] mix-blend-multiply opacity-90 border-double">
                          CLEAR
                       </div>
                    </div>
                  </div>
                )}
                <img src={inst.avatar} className={`w-48 h-48 object-cover mb-4 rounded border-2 border-zinc-500 group-hover:border-yellow-500 shadow-lg ${graduatedIds.includes(inst.id) ? 'grayscale opacity-40' : ''}`} />
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
              0% { transform: scale(3); opacity: 0; }
              50% { transform: scale(1); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            .animate-stamp {
              animation: stamp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
          `}</style>
        </div>
      )}

      {gameState.phase === GamePhase.PLAYING && (
        <MahjongGame state={gameState} onDiscard={handlePlayerDiscard} onUseSkill={useSkill} onTsumo={() => handleCall('ron')} onCall={handleCall} />
      )}

      {gameState.phase === GamePhase.RESULT && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-10">
          <div className="absolute top-10 left-10 flex gap-10">
             <div className="text-white text-3xl font-black">PLAYER: <span className="text-yellow-500">{gameState.playerScore}</span></div>
             <div className="text-white text-3xl font-black italic">VS</div>
             <div className="text-white text-3xl font-black">CPU: <span className="text-red-500">{gameState.cpuScore}</span></div>
          </div>
          
          <h2 className={`text-9xl font-black mb-6 drop-shadow-lg ${gameState.winningHand?.winner === 'player' ? 'text-yellow-500 animate-bounce' : 'text-red-600'}`}>
            {gameState.winningHand ? (gameState.winningHand.winner === 'player' ? '和了' : '被胡牌') : '流局'}
          </h2>

          <div className="flex gap-2 mb-10 overflow-x-auto max-w-full bg-white/5 p-6 rounded-xl border border-white/10">
            {gameState.winningHand?.hand.map(t => <MahjongTile key={t.id} tile={t} size="md" className="pointer-events-none" />) || "流局"}
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
            {gameState.cpuScore <= 0 ? '挑戰成功：返回導師選擇' : 'NEXT ROUND'}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
