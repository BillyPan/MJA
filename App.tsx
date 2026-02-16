
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GamePhase, Instructor, Tile, CallActions, Meld } from './types';
import { INSTRUCTORS, createDeck } from './constants';
import { sortHand, checkWin, evaluateHand, checkTenpai, canPon, canChi, canKan } from './services/mahjongEngine';
import MahjongGame from './components/MahjongGame';
import MahjongTile from './components/MahjongTile';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [graduatedIds, setGraduatedIds] = useState<number[]>([]);
  const [instructorImages, setInstructorImages] = useState<Record<number, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const isGeneratingRef = useRef(false);

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
    phase: GamePhase.INTRO,
    selectedInstructor: null,
    message: "歡迎來到麻雀學園！",
    isPlayerReach: false,
    lastDiscardTile: null,
    pendingCall: null,
  });

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    };
    checkKey();

    const savedProgress = localStorage.getItem('mahjong_gakuen_progress');
    if (savedProgress) setGraduatedIds(JSON.parse(savedProgress));

    const savedImages = localStorage.getItem('mahjong_gakuen_images');
    if (savedImages) {
      try {
        const parsed = JSON.parse(savedImages);
        if (Object.keys(parsed).length > 0) {
          setInstructorImages(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved images", e);
      }
    }
  }, []);

  const clearImageCache = () => {
    localStorage.removeItem('mahjong_gakuen_images');
    setInstructorImages({});
    window.location.reload();
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateInstructorImages = useCallback(async () => {
    if (isGeneratingRef.current) return;
    
    // @ts-ignore
    const selected = await window.aistudio.hasSelectedApiKey();
    if (!selected) return;

    const missingIds = INSTRUCTORS.filter(inst => !instructorImages[inst.id]).map(inst => inst.id);
    if (missingIds.length === 0) return;

    isGeneratingRef.current = true;
    setIsGeneratingImages(true);
    
    let currentImages = { ...instructorImages };
    let updated = false;

    for (const instId of missingIds) {
      const inst = INSTRUCTORS.find(i => i.id === instId)!;
      let retries = 0;
      const maxRetries = 2;

      while (retries <= maxRetries) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ text: inst.prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K"
                }
            }
          });
          
          const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
          if (part?.inlineData?.data) {
            currentImages[inst.id] = `data:image/png;base64,${part.inlineData.data}`;
            updated = true;
            setInstructorImages({ ...currentImages });
            await delay(3000); 
            break;
          }
        } catch (e: any) {
          console.error(`Attempt ${retries + 1} failed for ${inst.name}`, e);
          if (e.message?.includes("RESOURCE_EXHAUSTED") || e.status === 429) {
            await delay(10000);
            retries++;
          } else if (e.message?.includes("Requested entity was not found")) {
            setHasApiKey(false);
            setIsGeneratingImages(false);
            isGeneratingRef.current = false;
            return;
          } else {
            break;
          }
        }
      }
    }

    if (updated) {
      localStorage.setItem('mahjong_gakuen_images', JSON.stringify(currentImages));
    }
    setIsGeneratingImages(false);
    isGeneratingRef.current = false;
  }, [instructorImages]);

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
    const deck = createDeck();
    const playerHand = sortHand(deck.splice(0, 13));
    const cpuHand = sortHand(deck.splice(0, 13));
    
    // Prioritize previously generated images if they exist, otherwise use the constant (now GitHub URLs)
    const avatar = instructorImages[instructor.id] || instructor.avatar;

    setGameState({
      ...gameState,
      phase: GamePhase.PLAYING,
      selectedInstructor: { ...instructor, avatar },
      deck,
      playerHand,
      cpuHand,
      playerMelds: [],
      cpuMelds: [],
      playerDiscards: [],
      cpuDiscards: [],
      currentTurn: 'player',
      playerEnergy: 100,
      isPlayerReach: false,
      lastDiscardTile: null,
      pendingCall: null,
      message: `${instructor.name}：來決勝負吧！`,
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
    if (gameState.currentTurn !== 'player' || gameState.phase !== GamePhase.PLAYING || (gameState.playerHand.length + gameState.playerMelds.length * 3) !== 14) return;
    const tileIndex = gameState.playerHand.findIndex(t => t.id === tileId);
    if (tileIndex === -1) return;

    playSound('discard');
    const newHand = [...gameState.playerHand];
    const discarded = newHand.splice(tileIndex, 1)[0];
    
    setGameState(prev => ({
      ...prev,
      playerHand: sortHand(newHand),
      playerDiscards: [...prev.playerDiscards, discarded],
      lastDiscardTile: discarded,
      currentTurn: 'cpu'
    }));
    setTimeout(cpuTurn, 800);
  };

  const cpuTurn = () => {
    setGameState(prev => {
      if (prev.deck.length === 0) return { ...prev, phase: GamePhase.RESULT, message: "流局！" };
      const newDeck = [...prev.deck];
      const drawn = newDeck.pop()!;
      const fullHand = sortHand([...prev.cpuHand, drawn]);

      if (checkWin(fullHand, prev.cpuMelds)) {
        playSound('win');
        return {
          ...prev,
          cpuHand: fullHand,
          phase: GamePhase.RESULT,
          winningHand: { winner: 'cpu', yaku: evaluateHand(fullHand, prev.cpuMelds), points: 8000, hand: fullHand, melds: prev.cpuMelds },
          message: "糟糕！老師自摸了！"
        };
      }

      playSound('discard');
      const discardIndex = Math.floor(Math.random() * fullHand.length);
      const newHand = [...fullHand];
      const discarded = newHand.splice(discardIndex, 1)[0];

      const calls: CallActions = {
        ron: checkWin([...prev.playerHand, discarded], prev.playerMelds),
        pon: canPon(prev.playerHand, discarded),
        chi: canChi(prev.playerHand, discarded),
        kan: canKan(prev.playerHand, discarded)
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

    playSound('call');
    const tile = gameState.lastDiscardTile!;
    
    if (action === 'ron') {
      const finalHand = sortHand([...gameState.playerHand, tile]);
      if (gameState.selectedInstructor) saveProgress(gameState.selectedInstructor.id);
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.RESULT,
        winningHand: { winner: 'player', yaku: evaluateHand(finalHand, prev.playerMelds, prev.isPlayerReach), points: 12000, hand: finalHand, melds: prev.playerMelds },
        message: "胡！畢業確定！"
      }));
      return;
    }

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
        const v = tile.value;
        const t = tile.type;
        const find = (val: number) => newHand.find(x => x.type === t && x.value === val);
        let pair: Tile[] = [];
        if (find(v-1) && find(v+1)) pair = [find(v-1)!, find(v+1)!];
        else if (find(v-2) && find(v-1)) pair = [find(v-2)!, find(v-1)!];
        else pair = [find(v+1)!, find(v+2)!];
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
      if (gameState.playerEnergy < 10) return;
      playSound('skill');
      setGameState(prev => ({ 
        ...prev, 
        isPlayerReach: true, 
        playerEnergy: Math.max(0, prev.playerEnergy - 10), 
        message: "立直！聽牌覺醒！" 
      }));
      return;
    }

    if (skillType === 'TSUMO') {
      if (gameState.playerEnergy < 80) return; 
      playSound('skill');
      
      setGameState(prev => {
        const winningTileIndex = prev.deck.findIndex(d => checkWin([...prev.playerHand.slice(0, 13), d], prev.playerMelds));
        
        if (winningTileIndex !== -1) {
          const newDeck = [...prev.deck];
          const winningTile = newDeck.splice(winningTileIndex, 1)[0];
          const finalHand = sortHand([...prev.playerHand.slice(0, 13), winningTile]);
          
          if (prev.selectedInstructor) saveProgress(prev.selectedInstructor.id);
          
          return {
            ...prev,
            playerEnergy: Math.max(0, prev.playerEnergy - 80),
            phase: GamePhase.RESULT,
            winningHand: { 
              winner: 'player', 
              yaku: ["究極奧義：燕返自摸", "役滿確定"], 
              points: 32000, 
              hand: finalHand, 
              melds: prev.playerMelds 
            },
            message: "奧義發動！究極畢業自摸！"
          };
        } else {
          return { 
            ...prev, 
            message: "奧義失靈！氣力耗盡！", 
            playerEnergy: Math.max(0, prev.playerEnergy - 40) 
          };
        }
      });
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-black overflow-hidden serif-font">
      {gameState.phase === GamePhase.INTRO && (
        <div className="text-center flex flex-col items-center">
          <h1 className="text-9xl font-black mb-4 text-yellow-500 italic drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">麻雀學園</h1>
          <h2 className="text-4xl text-white tracking-[1em] border-y-2 py-4">畢業篇 1998</h2>
          <button onClick={() => setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }))} className="mt-20 bg-red-700 text-white px-12 py-4 text-3xl font-black shadow-xl hover:bg-red-600 animate-pulse border-4 border-white/20">INSERT COIN</button>
          <div className="mt-8 text-zinc-500 text-lg font-bold tracking-widest uppercase">
            【bILLYpAN Vibe Coding Ver. 1.5】
          </div>
        </div>
      )}

      {gameState.phase === GamePhase.SELECT_OPPONENT && (
        <div className="w-full h-full p-10 bg-[#1a1a1a] flex flex-col">
          <div className="flex justify-between items-center mb-6 border-b-4 border-yellow-600 pb-4">
            <h2 className="text-4xl text-white font-black flex items-center gap-4">
              講師選擇 / INSTRUCTOR SELECT
              {isGeneratingImages && <span className="text-sm font-normal text-yellow-400 animate-pulse">(校務會議中，老師圖片生成中...)</span>}
            </h2>
            <div className="flex items-center gap-4">
              {hasApiKey && (
                 <div className="text-xs text-zinc-500 max-w-xs text-right">
                   已連結 API Key。您可以視需要清除緩存以更新 AI 老師版本。
                   <br/><a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline hover:text-yellow-500">查看計費文件</a>
                 </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-10 max-w-6xl mx-auto flex-grow overflow-y-auto pr-4 custom-scrollbar">
            {INSTRUCTORS.map(inst => {
              const isGraduated = graduatedIds.includes(inst.id);
              const isGenerated = !!instructorImages[inst.id];
              const avatar = instructorImages[inst.id] || inst.avatar;

              return (
                <div key={inst.id} onClick={() => startNewGame(inst)} className={`relative bg-zinc-900 border-4 ${isGraduated ? 'border-yellow-500' : 'border-zinc-700'} p-6 flex flex-col items-center cursor-pointer hover:border-white transition-all transform hover:scale-105 group h-fit`}>
                  {isGraduated && (
                    <div className="absolute -top-4 -right-4 bg-yellow-500 text-black px-4 py-1 font-black text-sm z-50 shadow-lg border-2 border-white rotate-12">GRADUATED</div>
                  )}
                  <div className="relative mb-4 w-48 h-48 overflow-hidden rounded-lg border-2 border-zinc-500 group-hover:border-yellow-400 bg-zinc-800 flex items-center justify-center">
                    <img 
                      src={avatar} 
                      className="w-full h-full object-cover" 
                      alt={inst.name} 
                      onError={(e) => {
                        // Fallback logic in case image fails to load
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes('placeholder')) {
                          console.warn(`Failed to load: ${target.src}, using placeholder`);
                          target.src = 'https://via.placeholder.com/200?text=Instructor';
                        }
                      }}
                    />
                    {isGeneratingImages && !isGenerated && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-yellow-400 font-bold text-center p-4 bg-black/40 backdrop-blur-sm">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-yellow-400 mb-2"></div>
                        <span className="text-xs">高清重繪中...</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-yellow-500/10 opacity-0 group-hover:opacity-100"></div>
                  </div>
                  <h3 className="text-2xl text-white font-bold mb-2">{inst.name}</h3>
                  <p className="text-zinc-500 text-sm text-center line-clamp-2">{inst.description}</p>
                  <div className="mt-4 flex gap-1">
                    {Array.from({length: inst.difficulty}).map((_, i) => <span key={i} className="text-red-600">★</span>)}
                  </div>
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
          <div className="text-center space-y-4 mb-10">
            <h2 className={`text-9xl font-black italic drop-shadow-[0_0_30px_rgba(234,179,8,0.8)] ${gameState.winningHand?.winner === 'player' ? 'text-yellow-500' : 'text-red-600'}`}>
              {gameState.winningHand?.winner === 'player' ? '畢業成功' : '補考確定'}
            </h2>
          </div>
          <div className="flex gap-2 mb-10 bg-black/40 p-8 border-y-2 border-white/20 overflow-x-auto max-w-full">
            {gameState.winningHand?.hand.map(t => <MahjongTile key={t.id} tile={t} size="md" />)}
            {gameState.winningHand?.melds.map((m, i) => (
               <div key={i} className="flex gap-1 ml-4 border-l-2 border-white/20 pl-4">
                 {m.tiles.map(t => <MahjongTile key={t.id} tile={t} size="md" />)}
               </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-2 mb-10">
             {gameState.winningHand?.yaku.map((y, i) => <span key={i} className="text-yellow-400 text-3xl font-black">{y}</span>)}
             <div className="text-white text-5xl font-black mt-4">得分：{gameState.winningHand?.points}</div>
          </div>
          <button onClick={() => setGameState(prev => ({ ...prev, phase: GamePhase.SELECT_OPPONENT }))} className="bg-yellow-600 text-black px-20 py-4 text-3xl font-black border-4 border-yellow-400 hover:bg-yellow-500 active:scale-95 transition-all">CONTINUE</button>
        </div>
      )}
    </div>
  );
};

export default App;
