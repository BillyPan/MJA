import React, { useState, useCallback, useEffect } from 'react';
import MahjongGame from './components/MahjongGame';
import MahjongTile from './components/MahjongTile';
import { 
  GameState, 
  GamePhase, 
  Tile, 
  Meld, 
  CallActions, 
  Instructor
} from './types';
import { 
  INSTRUCTORS, 
  createDeck 
} from './constants';
import { 
  sortHand, 
  calculateFinalScore, 
  getBestDiscard, 
  canPon, 
  canKan, 
  canChi, 
  getChiCombinations,
  checkWin
} from './services/mahjongEngine';
import { getInstructorDialogue } from './services/gemini';

const INITIAL_STATE: GameState = {
  playerHand: [],
  playerMelds: [],
  cpuHand: [],
  cpuMelds: [],
  deck: [],
  playerDiscards: [],
  cpuDiscards: [],
  currentTurn: 'player',
  playerEnergy: 0,
  playerScore: 25000,
  cpuScore: 25000,
  phase: GamePhase.INTRO,
  selectedInstructor: null,
  message: '',
  isPlayerReach: false,
  isCpuReach: false,
  lastDiscardTile: null,
  pendingCall: null,
  chiCombinations: null,
  doraIndicator: null,
  isPlayerFuriten: false,
  isWinAnimation: false,
  skillUsedCount: 0,
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);

  const startNewGame = (instructor: Instructor) => {
    const deck = createDeck();
    const doraIndicator = deck.pop() || null;
    
    // Deal 13 tiles
    const playerHand = sortHand(deck.splice(0, 13));
    const cpuHand = sortHand(deck.splice(0, 13));

    setGameState({
      ...INITIAL_STATE,
      phase: GamePhase.PLAYING,
      selectedInstructor: instructor,
      deck,
      playerHand,
      cpuHand,
      doraIndicator,
      cpuScore: 25000 + (instructor.id - 1) * 5000, 
      message: getInstructorDialogue(),
      currentTurn: 'player', 
    });
    
    // Initial draw
    setTimeout(() => playerDraw(), 500);
  };

  const playerDraw = useCallback(() => {
    setGameState(prev => {
      if (prev.deck.length === 0) {
        return { ...prev, phase: GamePhase.GAME_OVER, message: "流局" };
      }
      const newDeck = [...prev.deck];
      const tile = newDeck.pop()!;
      // Do not sort immediately to distinguish drawn tile
      const newHand = [...prev.playerHand, tile];
      
      return {
        ...prev,
        deck: newDeck,
        playerHand: newHand,
        currentTurn: 'player',
        message: "輪到你了",
        pendingCall: null,
        chiCombinations: null
      };
    });
  }, []);

  const cpuDiscard = useCallback(() => {
    setGameState(prev => {
      const difficulty = prev.selectedInstructor?.difficulty || 1;
      if (prev.cpuHand.length === 0) return prev;

      // Ensure CPU turn logic
      const discardIdx = getBestDiscard(prev.cpuHand, prev.cpuMelds, difficulty, prev.cpuDiscards, prev.isCpuReach);
      const newHand = [...prev.cpuHand];
      const discarded = newHand.splice(discardIdx, 1)[0];
      const newCpuDiscards = [...prev.cpuDiscards, discarded];
      const sortedCpuHand = sortHand(newHand);

      // Check if player can RON
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
  }, [playerDraw]);

  const cpuTurn = useCallback(() => {
     setGameState(prev => {
        if (prev.deck.length === 0) {
            return { ...prev, phase: GamePhase.GAME_OVER, message: "流局" };
        }
        const newDeck = [...prev.deck];
        const tile = newDeck.pop()!;
        const newHand = [...prev.cpuHand, tile];

        // Check CPU Tsumo
        if (checkWin(newHand, prev.cpuMelds)) {
             const winResult = calculateFinalScore(newHand, prev.cpuMelds, true, prev.isCpuReach, prev.doraIndicator);
             if (winResult) {
                 return {
                     ...prev,
                     cpuHand: newHand,
                     deck: newDeck,
                     phase: GamePhase.RESULT,
                     winningHand: { ...winResult, winner: 'cpu' },
                     message: "CPU 自摸!",
                     isWinAnimation: true
                 };
             }
        }
        
        return {
            ...prev,
            deck: newDeck,
            cpuHand: newHand, 
            currentTurn: 'cpu'
        };
    });

    setTimeout(cpuDiscard, 1000);
  }, [cpuDiscard]);

  const handleDiscard = (tileId: string) => {
      setGameState(prev => {
          const tileIndex = prev.playerHand.findIndex(t => t.id === tileId);
          if (tileIndex === -1) return prev;
          
          const newHand = [...prev.playerHand];
          const discarded = newHand.splice(tileIndex, 1)[0];
          const sortedHand = sortHand(newHand);
          
          setTimeout(cpuTurn, 1000);

          return {
              ...prev,
              playerHand: sortedHand,
              playerDiscards: [...prev.playerDiscards, discarded],
              lastDiscardTile: discarded,
              currentTurn: 'cpu',
              pendingCall: null,
              chiCombinations: null
          };
      });
  };

  const handleCall = (action: keyof CallActions | 'PASS', tiles?: Tile[]) => {
      if (action === 'PASS') {
          setGameState(prev => ({ ...prev, pendingCall: null, chiCombinations: null }));
          setTimeout(playerDraw, 500);
          return;
      }
      
      setGameState(prev => {
          if (action === 'ron') {
             const win = calculateFinalScore(
                 [...prev.playerHand, prev.lastDiscardTile!], 
                 prev.playerMelds, 
                 false, 
                 prev.isPlayerReach, 
                 prev.doraIndicator
             );
             return {
                 ...prev,
                 phase: GamePhase.RESULT,
                 winningHand: { ...win!, winner: 'player' },
                 message: "榮和!",
                 isWinAnimation: true
             };
          }
          
          const discard = prev.lastDiscardTile!;
          let newHand = [...prev.playerHand];
          let meldTiles: Tile[] = [];

          if (action === 'pon') {
              let count = 0;
              newHand = newHand.filter(t => {
                  if (count < 2 && t.type === discard.type && t.value === discard.value) {
                      count++;
                      meldTiles.push(t);
                      return false;
                  }
                  return true;
              });
              meldTiles.push(discard);
          } else if (action === 'chi' && tiles) {
              tiles.forEach(t => {
                  const idx = newHand.findIndex(h => h.id === t.id);
                  if (idx !== -1) newHand.splice(idx, 1);
                  meldTiles.push(t);
              });
              meldTiles.push(discard);
              meldTiles.sort((a,b) => a.value - b.value);
          } else if (action === 'kan') {
              let count = 0;
              newHand = newHand.filter(t => {
                  if (count < 3 && t.type === discard.type && t.value === discard.value) {
                      count++;
                      meldTiles.push(t);
                      return false;
                  }
                  return true;
              });
              meldTiles.push(discard);
          }

          const newMeld: Meld = { type: action, tiles: meldTiles, isClosed: false };
          
          return {
              ...prev,
              playerHand: newHand,
              playerMelds: [...prev.playerMelds, newMeld],
              currentTurn: 'player',
              pendingCall: null,
              chiCombinations: null
          };
      });
  };

  const handleTsumo = () => {
      setGameState(prev => {
           const win = calculateFinalScore(
               prev.playerHand, 
               prev.playerMelds, 
               true, 
               prev.isPlayerReach, 
               prev.doraIndicator
           );
           if (!win) return prev;
           return {
               ...prev,
               phase: GamePhase.RESULT,
               winningHand: { ...win, winner: 'player' },
               message: "自摸!",
               isWinAnimation: true
           };
      });
  };

  const handleUseSkill = (skill: string) => {
      // Basic skill handling or placeholder
      console.log('Skill:', skill);
  };

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden">
      {gameState.phase === GamePhase.INTRO ? (
        <div className="flex flex-col items-center justify-center h-full gap-8 bg-zinc-900">
          <h1 className="text-6xl font-black text-yellow-500 tracking-wider">麻將對決</h1>
          <p className="text-zinc-400 text-xl">請選擇對手</p>
          <div className="grid grid-cols-3 gap-6 max-w-4xl">
             {INSTRUCTORS.map(inst => (
                 <button 
                    key={inst.id} 
                    onClick={() => startNewGame(inst)} 
                    className="flex flex-col items-center p-6 border-2 border-zinc-700 rounded-xl hover:bg-zinc-800 hover:border-yellow-500 transition-all group"
                 >
                     <img src={inst.avatar} className="w-24 h-24 rounded-full mb-4 border-4 border-zinc-600 group-hover:border-yellow-400 shadow-xl object-cover" alt={inst.name} />
                     <span className="text-xl font-bold group-hover:text-yellow-400">{inst.name}</span>
                     <span className="text-sm text-zinc-500 mt-1">難度: {'★'.repeat(inst.difficulty)}</span>
                 </button>
             ))}
          </div>
        </div>
      ) : (
          <MahjongGame 
             state={gameState} 
             onDiscard={handleDiscard}
             onCall={handleCall}
             onTsumo={handleTsumo}
             onUseSkill={handleUseSkill}
          />
      )}
      
      {gameState.phase === GamePhase.RESULT && (
          <div className="absolute inset-0 z-[200] bg-black/90 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-zinc-900 p-10 rounded-2xl border-4 border-yellow-500 text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] max-w-2xl w-full">
                  <h2 className="text-6xl font-black mb-6 text-yellow-400 italic">{gameState.message}</h2>
                  {gameState.winningHand && (
                      <div className="mb-8 bg-black/50 p-6 rounded-xl border border-white/10">
                          <div className="flex justify-center gap-1 mb-6">
                              {gameState.winningHand.hand.map((t, i) => <MahjongTile key={i} tile={t} size="sm" />)}
                          </div>
                          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-left px-8 text-xl">
                              {gameState.winningHand.yaku.map((y, i) => (
                                  <React.Fragment key={i}>
                                      <div className="text-zinc-300">{y.name}</div>
                                      <div className="text-right text-yellow-500 font-bold">{y.fan}番</div>
                                  </React.Fragment>
                              ))}
                              <div className="col-span-2 border-t border-white/20 my-2"></div>
                              <div className="text-zinc-400">符數</div>
                              <div className="text-right text-zinc-400">{gameState.winningHand.fu}符</div>
                              <div className="text-2xl font-black text-white mt-2">總計</div>
                              <div className="text-right text-4xl font-black text-yellow-400 mt-1">{gameState.winningHand.points}</div>
                          </div>
                      </div>
                  )}
                  <button 
                      onClick={() => setGameState({...INITIAL_STATE})} 
                      className="px-12 py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-black text-2xl rounded-full shadow-lg hover:scale-105 transition-transform"
                  >
                      再次挑戰
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;