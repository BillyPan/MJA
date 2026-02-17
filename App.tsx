
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GamePhase, Instructor, Tile, CallActions, Meld, WinningResult } from './types';
import { INSTRUCTORS, createDeck } from './constants';
// Removed checkTenpai as it is not exported from mahjongEngine and not used in this file. 
// Hand readiness is determined using getWaitingTiles elsewhere.
import { sortHand, checkWin, calculateFinalScore, getWaitingTiles, isFuriten, canPon, canChi, canKan, checkOwnTurnKan, getBestDiscard } from './services/mahjongEngine';
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
      const newHand = [...prev.playerHand, drawn];
      
      const kanTile = checkOwnTurnKan(newHand, prev.playerMelds);
      const canTsumo = checkWin(newHand, prev.playerMelds);
      
      const calls: CallActions = { 
        ron: false, 
        pon: false, 
        chi: false, 
        kan: !!kanTile 
      };

      return {
        ...prev,
        deck: newDeck,
        playerHand: newHand,
        playerEnergy: Math.min(100, prev.playerEnergy + 5), // 摸牌回充 5 EP
        currentTurn: 'player',
        pendingCall: calls.kan ? calls : null,
        lastDiscardTile: kanTile,
        message: canTsumo ? "可以自摸囉！" : prev.message
      };
    });
  };

  const handlePlayerDiscard = (tileId: string) => {
    setGameState(prev => {
      const totalTiles = prev.playerHand.length + prev.playerMelds.length * 3;
      if (prev.currentTurn !== 'player' || prev.phase !== GamePhase.PLAYING || prev.pendingCall || totalTiles !== 14) {
        return prev;
      }

      const tileIndex = prev.playerHand.findIndex(t => t.id === tileId);
      if (tileIndex === -1) return prev;

      playSound('discard');
      const newHand = [...prev.playerHand];
      const discarded = newHand.splice(tileIndex, 1)[0];
      const updatedDiscards = [...prev.playerDiscards, discarded];
      
      let reachStatus = prev.isPlayerReach;
      if (isPendingReach && getWaitingTiles(newHand, prev.playerMelds).length > 0) {
        reachStatus = true;
      }
      setIsPendingReach(false);

      const waiting = getWaitingTiles(newHand, prev.playerMelds);
      const isNowFuriten = isFuriten(updatedDiscards, waiting);

      if (checkWin([...prev.cpuHand, discarded], prev.cpuMelds)) {
        const win = calculateFinalScore([...prev.cpuHand, discarded], prev.cpuMelds, false, prev.isCpuReach, prev.doraIndicator, true);
        if (win) {
          playSound('win');
          return {
            ...prev,
            cpuHand: [...prev.cpuHand, discarded],
            phase: GamePhase.RESULT,
            cpuScore: prev.cpuScore + win.points,
            playerScore: prev.playerScore - win.points,
            winningHand: { ...win, winner: 'cpu' },
            message: "老師榮和！"
          };
        }
      }

      setTimeout(cpuTurn, 800);
      return {
        ...prev,
        playerHand: sortHand(newHand),
        playerDiscards: updatedDiscards,
        isPlayerFuriten: isNowFuriten,
        isPlayerReach: reachStatus,
        lastDiscardTile: discarded,
        currentTurn: 'cpu',
        pendingCall: null
      };
    });
  };

  const cpuTurn = () => {
    setGameState(prev => {
      if (prev.deck.length === 0) return { ...prev, phase: GamePhase.RESULT, message: "流局！" };
      
      const newDeck = [...prev.deck];
      const drawn = newDeck.pop()!;
      const fullHand = sortHand([...prev.cpuHand, drawn]);

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
          message: `老師自摸了！`
        };
      }

      const discardIdx = getBestDiscard(fullHand, prev.cpuMelds, prev.selectedInstructor?.difficulty || 1);
      playSound('discard');
      const newHand = [...fullHand];
      const discarded = newHand.splice(discardIdx, 1)[0];

      const canRon = checkWin([...prev.playerHand, discarded], prev.playerMelds) && !prev.isPlayerFuriten;
      const calls: CallActions = {
        ron: canRon,
        pon: canPon(prev.playerHand, discarded) && !prev.isPlayerReach,
        chi: canChi(prev.playerHand, discarded) && !prev.isPlayerReach,
        kan: canKan(prev.playerHand, discarded) && !prev.isPlayerReach
      };

      const hasAnyCall = Object.values(calls).some(v => v);
      if (!hasAnyCall) {
        setTimeout(() => playerDraw(), 1000);
      }

      return {
        ...prev,
        deck: newDeck,
        cpuHand: sortHand(newHand),
        cpuDiscards: [...prev.cpuDiscards, discarded],
        lastDiscardTile: discarded,
        pendingCall: hasAnyCall ? calls : null,
        currentTurn: 'cpu',
      };
    });
  };

  const handleCall = (action: keyof CallActions | 'PASS') => {
    if (action === 'PASS') {
      setGameState(prev => ({ ...prev, pendingCall: null }));
      if (gameState.currentTurn === 'cpu') {
        playerDraw();
      }
      return;
    }

    const tile = gameState.lastDiscardTile!;
    
    if (action === 'ron') {
      let finalHand: Tile[] = [];
      let isTsumo = false;

      if (gameState.playerHand.length + gameState.playerMelds.length * 3 === 14) {
        finalHand = [...gameState.playerHand];
        isTsumo = true;
      } else {
        finalHand = [...gameState.playerHand, tile];
        isTsumo = false;
      }

      const result = calculateFinalScore(finalHand, gameState.playerMelds, isTsumo, gameState.isPlayerReach, gameState.doraIndicator);
      
      if (result) {
        playSound('win');
        const cpuNewScore = gameState.cpuScore - result.points;
        if (gameState.selectedInstructor && cpuNewScore <= 0) {
          saveProgress(gameState.selectedInstructor.id);
        }
        setGameState(prev => ({
          ...prev,
          phase: GamePhase.RESULT,
          playerScore: prev.playerScore + result.points,
          cpuScore: cpuNewScore,
          winningHand: { ...result, winner: 'player' },
          message: isTsumo ? "自摸！和牌！" : "榮和！和牌！"
        }));
      }
      return;
    }

    playSound('call');
    setGameState(prev => {
      let newHand = [...prev.playerHand];
      let newMelds = [...prev.playerMelds];
      let meldTiles: Tile[] = [];

      if (action === 'pon') {
        const matching = newHand.filter(t => t.type === tile.type && t.value === tile.value).slice(0, 2);
        newHand = newHand.filter(t => !matching.includes(t));
        meldTiles = [...matching, tile];
        newMelds.push({ type: 'pon', tiles: meldTiles });
      } else if (action === 'chi') {
        const v = tile.value, t = tile.type;
        const find = (val: number) => newHand.find(x => x.type === t && x.value === val);
        let pair: Tile[] = [];
        if (find(v-1) && find(v+1)) pair = [find(v-1)!, find(v+1)!];
        else if (find(v-2) && find(v-1)) pair = [find(v-2)!, find(v-1)!];
        else if (find(v+1) && find(v+2)) pair = [find(v+1)!, find(v+2)!];
        newHand = newHand.filter(t => !pair.includes(t));
        meldTiles = [...pair, tile];
        newMelds.push({ type: 'chi', tiles: meldTiles });
      } else if (action === 'kan') {
        const matchingInHand = newHand.filter(t => t.type === tile.type && t.value === tile.value);
        if (matchingInHand.length === 4) { // 暗槓
          newHand = newHand.filter(t => !matchingInHand.includes(t));
          meldTiles = matchingInHand;
          newMelds.push({ type: 'kan', tiles: meldTiles });
        } else if (matchingInHand.length === 3) { // 大明槓
          newHand = newHand.filter(t => !matchingInHand.includes(t));
          meldTiles = [...matchingInHand, tile];
          newMelds.push({ type: 'kan', tiles: meldTiles });
        } else { // 加槓
          const ponMeldIdx = newMelds.findIndex(m => m.type === 'pon' && m.tiles[0].type === tile.type && m.tiles[0].value === tile.value);
          if (ponMeldIdx !== -1) {
            newMelds[ponMeldIdx] = { type: 'kan', tiles: [...newMelds[ponMeldIdx].tiles, tile] };
            newHand = newHand.filter(t => t.id !== tile.id);
          }
        }
        setTimeout(() => playerDraw(), 500);
        return {
          ...prev,
          playerHand: sortHand(newHand),
          playerMelds: newMelds,
          pendingCall: null,
          currentTurn: 'player',
          message: "槓！嶺上補牌！"
        };
      }

      return {
        ...prev,
        playerHand: sortHand(newHand),
        playerMelds: newMelds,
        pendingCall: null,
        currentTurn: 'player',
        message: action.toUpperCase() + "!"
      };
    });
  };

  const useSkill = (skillType: string) => {
    if (skillType === 'REACH' && gameState.playerEnergy >= 20) {
      playSound('skill');
      setIsPendingReach(true);
      setGameState(prev => ({ ...prev, playerEnergy: prev.playerEnergy - 20, message: "宣告立直！" }));
    } else if (skillType === 'TSUMO' && gameState.playerEnergy >= 90) {
      playSound('skill');
      let finalHand: Tile[] = [];
      const currentHandSize = gameState.playerHand.length + gameState.playerMelds.length * 3;
      
      if (currentHandSize === 14) {
        if (checkWin(gameState.playerHand, gameState.playerMelds)) {
          finalHand = [...gameState.playerHand];
        } else {
          const winTile = gameState.deck.find(d => checkWin([...gameState.playerHand.slice(0, -1), d], gameState.playerMelds));
          if (winTile) finalHand = sortHand([...gameState.playerHand.slice(0, -1), winTile]);
        }
      } else if (currentHandSize === 13) {
        const winTile = gameState.deck.find(d => checkWin([...gameState.playerHand, d], gameState.playerMelds));
        if (winTile) finalHand = sortHand([...gameState.playerHand, winTile]);
      }

      if (finalHand.length === 14) {
        const res = calculateFinalScore(finalHand, gameState.playerMelds, true, gameState.isPlayerReach, gameState.doraIndicator)!;
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
      playSound('skill');
      setGameState(prev => {
        const lastTile = prev.playerHand[prev.playerHand.length - 1];
        let newDeck = [lastTile, ...prev.deck];
        let drawn: Tile | undefined;
        let skillMessage = "換牌術發動！";

        // 立直後的特殊換牌邏輯 (70% 成功率)
        if (prev.isPlayerReach && Math.random() < 0.7) {
          const hand13 = prev.playerHand.slice(0, -1);
          const waiters = getWaitingTiles(hand13, prev.playerMelds);
          
          if (waiters.length > 0) {
            // 在牌庫中尋找可以胡的牌
            const waiterIndex = newDeck.findIndex(d => waiters.includes(`${d.type}${d.value}`));
            if (waiterIndex !== -1) {
              drawn = newDeck.splice(waiterIndex, 1)[0];
              // 重新打亂剩下的牌庫
              newDeck = newDeck.sort(() => Math.random() - 0.5);
              skillMessage = "必殺換牌！聽牌機率上升！";
            }
          }
        }

        // 如果不是立直或機率沒中，或牌庫沒牌了，則正常隨機抽
        if (!drawn) {
          newDeck = newDeck.sort(() => Math.random() - 0.5);
          drawn = newDeck.pop()!;
        }

        return {
          ...prev,
          playerHand: [...prev.playerHand.slice(0, -1), drawn],
          deck: newDeck,
          playerEnergy: prev.playerEnergy - 30,
          message: skillMessage
        };
      });
    }
  };

  const handleNextRound = () => {
    if (!gameState.selectedInstructor) {
      setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }));
      return;
    }

    if (gameState.cpuScore <= 0) {
      setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }));
    } else if (gameState.playerScore <= 0) {
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
            <h2 className="text-6xl text-white tracking-[0.5em] border-y-2 py-4 w-full text-center">卒業篇</h2>
          </div>
          <div className="flex flex-col items-center mt-20">
            <button onClick={() => setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }))} className="bg-red-700 text-white px-12 py-4 text-3xl font-black animate-pulse">INSERT COIN</button>
            <p className="mt-20 text-zinc-500 text-xl font-bold tracking-wider">【bILLYpAN Gemini Vibe Coding 複刻試作 Ver 0.96】</p>
          </div>
        </div>
      )}

      {gameState.phase === GamePhase.SELECT_OPPONENT && (
        <div className="w-full h-full p-10 bg-[#1a1a1a]">
          <h2 className="text-4xl text-white font-black mb-8 border-b-4 border-yellow-600 pb-4">講師選擇</h2>
          <div className="grid grid-cols-3 gap-10 max-w-6xl mx-auto overflow-y-auto max-h-[80vh] pr-4 custom-scrollbar">
            {INSTRUCTORS.map(inst => (
              <div key={inst.id} onClick={() => startNewRound(inst, 25000, 25000, 100)} className="bg-zinc-900 border-4 border-zinc-700 p-6 flex flex-col items-center cursor-pointer hover:border-white transform hover:scale-105 transition-all">
                {graduatedIds.includes(inst.id) && <div className="text-yellow-500 font-black mb-2 bg-yellow-900/50 px-4 py-1 rounded-full border border-yellow-500 animate-pulse">GRADUATED</div>}
                <img src={inst.avatar} className="w-48 h-48 object-cover mb-4 rounded" />
                <h3 className="text-2xl text-white font-bold">{inst.name}</h3>
                <p className="text-zinc-500 text-sm text-center">{inst.description}</p>
              </div>
            ))}
          </div>
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
            {gameState.winningHand?.hand.map(t => <MahjongTile key={t.id} tile={t} size="md" className="pointer-events-none" />)}
            {gameState.winningHand?.melds.map(m => m.tiles.map(t => <MahjongTile key={t.id} tile={t} size="sm" className="pointer-events-none opacity-80" />))}
          </div>

          <div className="text-center mb-10 min-h-[120px]">
            {gameState.winningHand?.yaku.map(y => (
              <div key={y.name} className={`text-4xl font-black italic mb-2 ${y.name.includes('懸賞') ? 'text-orange-400' : 'text-yellow-400'}`}>
                {y.name} {y.fan}番
              </div>
            ))}
            {gameState.winningHand && (
              <div className="text-white text-6xl font-black mt-6 border-t-2 border-white/20 pt-4">
                {gameState.winningHand.fu}符 {gameState.winningHand.fan}番：{gameState.winningHand.points}點
              </div>
            )}
          </div>

          <button 
            onClick={handleNextRound} 
            className="bg-red-700 hover:bg-red-600 text-white px-20 py-6 text-4xl font-black rounded-lg border-b-8 border-red-900 active:border-b-0 active:translate-y-2 transition-all"
          >
            {gameState.cpuScore <= 0 ? '挑戰成功：下一位老師' : 'NEXT ROUND'}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
