
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GamePhase, Instructor, Tile, CallActions, Meld, WinningResult } from './types';
import { INSTRUCTORS, createDeck } from './constants';
import { sortHand, checkWin, calculateFinalScore, checkTenpai, getWaitingTiles, isFuriten, canPon, canChi, canKan } from './services/mahjongEngine';
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

  const startNewGame = (instructor: Instructor) => {
    startNewRound(instructor, 25000, 25000, 100);
  };

  const startNewRound = (instructor: Instructor, pScore: number, cScore: number, pEnergy: number) => {
    const deck = createDeck();
    const playerHand = sortHand(deck.splice(0, 13));
    const cpuHand = sortHand(deck.splice(0, 13));
    const doraIndicator = deck.pop()!;
    setIsPendingReach(false);

    setGameState({
      ...gameState,
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
      playerEnergy: pEnergy,
      playerScore: pScore,
      cpuScore: cScore,
      isPlayerReach: false,
      isCpuReach: false,
      isPlayerFuriten: false,
      winningHand: undefined,
      message: `${instructor.name}：下一局開始！準備好了嗎？`,
    });
    setTimeout(() => playerDraw(), 800);
  };

  const playerDraw = () => {
    setGameState(prev => {
      if (prev.deck.length === 0) return { ...prev, phase: GamePhase.RESULT, message: "流局！" };
      playSound('draw');
      const newDeck = [...prev.deck];
      const drawn = newDeck.pop()!;
      return {
        ...prev,
        deck: newDeck,
        playerHand: [...prev.playerHand, drawn],
        currentTurn: 'player',
        pendingCall: null,
      };
    });
  };

  const handlePlayerDiscard = (tileId: string) => {
    setGameState(prev => {
      if (prev.currentTurn !== 'player' || prev.phase !== GamePhase.PLAYING) return prev;
      const tileIndex = prev.playerHand.findIndex(t => t.id === tileId);
      if (tileIndex === -1) return prev;

      playSound('discard');
      const newHand = [...prev.playerHand];
      const discarded = newHand.splice(tileIndex, 1)[0];
      const updatedDiscards = [...prev.playerDiscards, discarded];
      
      // 立直判定邏輯：宣告立直後打出牌，檢查剩下手牌是否聽牌
      let reachStatus = prev.isPlayerReach;
      let reachMsg = prev.message;
      if (isPendingReach) {
        const isTenpaiNow = checkTenpai(newHand, prev.playerMelds);
        if (isTenpaiNow) {
          reachStatus = true;
          reachMsg = "立直成功！進入聽牌狀態！";
        } else {
          reachStatus = false;
          reachMsg = "沒聽牌，立直取消！";
        }
        setIsPendingReach(false);
      }

      const waiting = getWaitingTiles(newHand, prev.playerMelds);
      const isNowFuriten = isFuriten(updatedDiscards, waiting);

      setTimeout(cpuTurn, 800);

      return {
        ...prev,
        playerHand: sortHand(newHand),
        playerDiscards: updatedDiscards,
        isPlayerFuriten: isNowFuriten,
        isPlayerReach: reachStatus,
        message: reachMsg,
        lastDiscardTile: discarded,
        currentTurn: 'cpu'
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

      playSound('discard');
      const discardIndex = Math.floor(Math.random() * fullHand.length);
      const newHand = [...fullHand];
      const discarded = newHand.splice(discardIndex, 1)[0];

      const waiting = getWaitingTiles(prev.playerHand, prev.playerMelds);
      const canRon = checkWin([...prev.playerHand, discarded], prev.playerMelds) && 
                     !prev.isPlayerFuriten && 
                     (calculateFinalScore([...prev.playerHand, discarded], prev.playerMelds, false, prev.isPlayerReach, prev.doraIndicator) !== null);

      const calls: CallActions = {
        ron: canRon,
        pon: canPon(prev.playerHand, discarded) && !prev.isPlayerReach,
        chi: canChi(prev.playerHand, discarded) && !prev.isPlayerReach,
        kan: canKan(prev.playerHand, discarded) && !prev.isPlayerReach
      };

      const hasAnyCall = Object.values(calls).some(v => v);
      if (!hasAnyCall) setTimeout(() => playerDraw(), 1000);

      return {
        ...prev,
        deck: newDeck,
        cpuHand: sortHand(newHand),
        cpuDiscards: [...prev.cpuDiscards, discarded],
        lastDiscardTile: discarded,
        pendingCall: hasAnyCall ? calls : null,
        currentTurn: hasAnyCall ? 'player' : 'cpu'
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
      const result = calculateFinalScore([...gameState.playerHand, tile], gameState.playerMelds, false, gameState.isPlayerReach, gameState.doraIndicator);
      if (result) {
        playSound('win');
        if (gameState.selectedInstructor && (gameState.cpuScore - result.points < 0)) {
           saveProgress(gameState.selectedInstructor.id);
        }
        setGameState(prev => ({
          ...prev,
          phase: GamePhase.RESULT,
          playerScore: prev.playerScore + result.points,
          cpuScore: prev.cpuScore - result.points,
          winningHand: { ...result, winner: 'player' },
          message: "榮和！"
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
        const matching = newHand.filter(t => t.type === tile.type && t.value === tile.value).slice(0, 3);
        newHand = newHand.filter(t => !matching.includes(t));
        meldTiles = [...matching, tile];
        newMelds.push({ type: 'kan', tiles: meldTiles });
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
    if (skillType === 'REACH') {
      if (gameState.playerEnergy < 20) return;
      playSound('skill');
      setIsPendingReach(true);
      setGameState(prev => ({ 
        ...prev, 
        playerEnergy: Math.max(0, prev.playerEnergy - 20), 
        message: "已宣告立直！請打出一張牌。" 
      }));
    }

    if (skillType === 'TSUMO') {
      if (gameState.playerEnergy < 90) return; 
      playSound('skill');
      const winningTileIndex = gameState.deck.findIndex(d => {
          const res = calculateFinalScore([...gameState.playerHand, d], gameState.playerMelds, true, gameState.isPlayerReach, gameState.doraIndicator);
          return res !== null;
      });
      if (winningTileIndex !== -1) {
        const newDeck = [...gameState.deck];
        const winningTile = newDeck.splice(winningTileIndex, 1)[0];
        const finalHand = sortHand([...gameState.playerHand, winningTile]);
        const result = calculateFinalScore(finalHand, gameState.playerMelds, true, gameState.isPlayerReach, gameState.doraIndicator)!;
        
        const nextCpuScore = gameState.cpuScore - result.points;
        if (gameState.selectedInstructor && nextCpuScore < 0) saveProgress(gameState.selectedInstructor.id);
        
        setGameState(prev => ({
          ...prev,
          playerEnergy: Math.max(0, prev.playerEnergy - 90),
          phase: GamePhase.RESULT,
          playerScore: prev.playerScore + result.points,
          cpuScore: nextCpuScore,
          winningHand: { ...result, winner: 'player' },
          message: "胡牌！"
        }));
      } else {
        setGameState(prev => ({ ...prev, message: "牌山已無勝機！", playerEnergy: Math.max(0, prev.playerEnergy - 50) }));
      }
    }
  };

  const handleContinue = () => {
    if (gameState.playerScore < 0 || gameState.cpuScore < 0) {
      setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }));
    } else {
      if (gameState.selectedInstructor) {
        startNewRound(gameState.selectedInstructor, gameState.playerScore, gameState.cpuScore, Math.min(100, gameState.playerEnergy + 20));
      } else {
        setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }));
      }
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-black overflow-hidden serif-font">
      {gameState.phase === GamePhase.INTRO && (
        <div className="text-center flex flex-col items-center">
          <h1 className="text-9xl font-black mb-4 text-yellow-500 italic drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">麻雀學園</h1>
          <h2 className="text-4xl text-white tracking-[1em] border-y-2 py-4">畢業篇 1998</h2>
          <button onClick={() => setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }))} className="mt-20 bg-red-700 text-white px-12 py-4 text-3xl font-black shadow-xl hover:bg-red-600 animate-pulse border-4 border-white/20">INSERT COIN</button>
        </div>
      )}

      {gameState.phase === GamePhase.SELECT_OPPONENT && (
        <div className="w-full h-full p-10 bg-[#1a1a1a] flex flex-col">
          <h2 className="text-4xl text-white font-black mb-8 border-b-4 border-yellow-600 pb-4">講師選擇 / INSTRUCTOR SELECT</h2>
          <div className="grid grid-cols-3 gap-10 max-w-6xl mx-auto flex-grow overflow-y-auto pr-4 custom-scrollbar">
            {INSTRUCTORS.map(inst => {
              const isGraduated = graduatedIds.includes(inst.id);
              return (
                <div key={inst.id} onClick={() => startNewGame(inst)} className={`relative bg-zinc-900 border-4 ${isGraduated ? 'border-yellow-500' : 'border-zinc-700'} p-6 flex flex-col items-center cursor-pointer hover:border-white transition-all transform hover:scale-105 group h-fit`}>
                  {isGraduated && <div className="absolute -top-4 -right-4 bg-yellow-500 text-black px-4 py-1 font-black text-sm z-50 border-2 border-white rotate-12">GRADUATED</div>}
                  <img src={inst.avatar} className="w-48 h-48 object-cover mb-4 rounded border-2 border-zinc-500" alt={inst.name} />
                  <h3 className="text-2xl text-white font-bold">{inst.name}</h3>
                  <p className="text-zinc-500 text-sm text-center">{inst.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {gameState.phase === GamePhase.PLAYING && (
        <MahjongGame state={gameState} onDiscard={handlePlayerDiscard} onUseSkill={useSkill} onTsumo={() => handleCall('ron')} onCall={handleCall} />
      )}

      {gameState.phase === GamePhase.RESULT && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-10 backdrop-blur-sm">
          <h2 className={`text-9xl font-black italic mb-6 ${gameState.winningHand?.winner === 'player' ? 'text-yellow-500' : 'text-red-600'}`}>
            {gameState.winningHand ? (gameState.winningHand.winner === 'player' ? '和了' : '被胡牌') : '流局'}
          </h2>
          <div className="flex gap-2 mb-10 bg-black/40 p-8 border-y-2 border-white/20 overflow-x-auto max-w-full">
            {gameState.winningHand?.hand.map(t => <MahjongTile key={t.id} tile={t} size="md" />) || <div className="text-white text-3xl">流局 - 牌山耗盡</div>}
          </div>
          <div className="text-center mb-10">
            {gameState.winningHand?.yaku.map(y => <div key={y.name} className="text-yellow-400 text-3xl font-bold">{y.name} ({y.fan}番)</div>)}
            {gameState.winningHand?.doraCount! > 0 && <div className="text-red-500 text-2xl font-bold">懸賞牌 +{gameState.winningHand?.doraCount}</div>}
            {gameState.winningHand && (
              <div className="text-white text-6xl font-black mt-6">{gameState.winningHand.fu} 符 {gameState.winningHand.fan} 番：{gameState.winningHand.points} 點</div>
            )}
            <div className="text-zinc-400 text-2xl mt-4">
              目前分數：玩家 {gameState.playerScore} / 老師 {gameState.cpuScore}
            </div>
          </div>
          <button onClick={handleContinue} className="bg-yellow-600 text-black px-20 py-4 text-3xl font-black border-4 border-yellow-400 hover:bg-yellow-500">
            {(gameState.playerScore < 0 || gameState.cpuScore < 0) ? 'GAME OVER / RETRY' : 'NEXT ROUND'}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
