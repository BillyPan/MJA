
import React, { useMemo, useEffect, useRef } from 'react';
import { GameState, Tile, CallActions, Meld } from '../types';
import MahjongTile from './MahjongTile';
import { calculateFinalScore } from '../services/mahjongEngine';

interface MahjongGameProps {
  state: GameState;
  onDiscard: (id: string) => void;
  onUseSkill: (skill: string) => void;
  onTsumo: () => void;
  onCall: (action: keyof CallActions | 'PASS') => void;
}

const MahjongGame: React.FC<MahjongGameProps> = ({ state, onDiscard, onUseSkill, onTsumo, onCall }) => {
  const cpuRiverRef = useRef<HTMLDivElement>(null);
  const playerRiverRef = useRef<HTMLDivElement>(null);

  const canPlayerTsumo = useMemo(() => {
    return calculateFinalScore(state.playerHand, state.playerMelds, true, state.isPlayerReach, state.doraIndicator) !== null;
  }, [state.playerHand, state.playerMelds, state.isPlayerReach, state.doraIndicator]);

  // 當棄牌增加時，自動捲動到底部
  useEffect(() => {
    if (cpuRiverRef.current) {
      cpuRiverRef.current.scrollTop = cpuRiverRef.current.scrollHeight;
    }
  }, [state.cpuDiscards.length]);

  useEffect(() => {
    if (playerRiverRef.current) {
      playerRiverRef.current.scrollTop = playerRiverRef.current.scrollHeight;
    }
  }, [state.playerDiscards.length]);

  return (
    <div className="w-full h-full flex flex-col bg-[#064e3b] border-[12px] border-[#2c1a10] relative shadow-inner overflow-hidden">
      {/* Top UI */}
      <div className="h-40 flex-shrink-0 flex justify-between items-center px-10 bg-black/60 border-b-2 border-black/40 z-[100] relative">
        <div className="flex items-center gap-6">
          <div className="relative">
            <img src={state.selectedInstructor?.avatar} className="w-24 h-24 rounded-full border-4 border-yellow-500 bg-white object-cover shadow-[0_0_20px_rgba(234,179,8,0.5)]" alt="CPU" />
            <div className="absolute -bottom-2 -right-2 bg-red-600 text-white px-2 py-0.5 text-xs font-bold rounded border border-white">CPU</div>
          </div>
          <div className="flex flex-col">
            <div className="text-yellow-400 font-black text-2xl italic tracking-wider">{state.selectedInstructor?.name}</div>
            <div className="text-white text-xl font-bold font-mono">PTS: {state.cpuScore}</div>
          </div>
        </div>

        {/* Central Info: Message & Dora */}
        <div className="flex items-center gap-6">
          <div className="bg-black/80 px-8 py-3 rounded-lg border-2 border-yellow-500/60 shadow-lg min-w-[300px] text-center">
            <p className="text-yellow-400 text-lg font-black italic tracking-wide animate-pulse">「 {state.message} 」</p>
          </div>
          <div className="flex items-center gap-4 bg-red-950/40 px-6 py-2 rounded border border-red-500/30 h-full">
            <div className="flex flex-col items-start leading-none">
              <span className="text-red-500 font-black text-xs italic uppercase opacity-70">Bonus</span>
              <span className="text-red-500 font-black text-sm italic">DORA</span>
            </div>
            {state.doraIndicator && <MahjongTile tile={state.doraIndicator} size="xs" />}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 min-w-[300px]">
           <div className="text-white text-2xl font-black text-right italic">PLAYER PTS: {state.playerScore}</div>
           <div className="flex gap-1">
             {state.cpuHand.map((_, i) => <div key={i} className="w-7 h-11 bg-zinc-200 rounded-sm shadow-md border-b-4 border-zinc-400" />)}
           </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-grow flex items-center justify-around px-10 py-4 relative overflow-hidden">
        {/* CPU River */}
        <div className="flex flex-col items-center gap-2 h-full max-h-[320px]">
          <span className="text-white/40 font-bold text-xs tracking-widest uppercase text-shadow">CPU River</span>
          <div ref={cpuRiverRef} className="flex-grow overflow-y-auto custom-scrollbar pr-1 w-fit scroll-smooth">
            <div className="grid grid-cols-6 gap-1 p-2 bg-black/30 rounded border border-white/10 h-fit">
              {state.cpuDiscards.map((t, i) => <MahjongTile key={i} tile={t} size="xs" />)}
              {Array.from({ length: Math.max(0, 18 - state.cpuDiscards.length) }).map((_, i) => (
                <div key={`empty-cpu-${i}`} className="w-[44px] h-[63px] bg-black/10 border border-white/5 rounded-sm" />
              ))}
            </div>
          </div>
        </div>

        {/* Player River */}
        <div className="flex flex-col items-center gap-2 h-full max-h-[320px]">
          <span className="text-white/40 font-bold text-xs tracking-widest uppercase text-shadow">
            Player River {state.isPlayerFuriten && <span className="text-red-500 ml-2 font-black">[ 振聽 ]</span>}
          </span>
          <div ref={playerRiverRef} className="flex-grow overflow-y-auto custom-scrollbar pr-1 w-fit scroll-smooth">
            <div className="grid grid-cols-6 gap-1 p-2 bg-black/30 rounded border border-white/10 h-fit">
              {state.playerDiscards.map((t, i) => <MahjongTile key={i} tile={t} size="xs" />)}
              {Array.from({ length: Math.max(0, 18 - state.playerDiscards.length) }).map((_, i) => (
                <div key={`empty-player-${i}`} className="w-[44px] h-[63px] bg-black/10 border border-white/5 rounded-sm" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="h-[280px] flex-shrink-0 flex flex-col items-center justify-end pb-6 bg-gradient-to-t from-black/95 to-transparent border-t border-white/5">
        
        {/* Arcade Actions - Now right-aligned for easier mouse access */}
        <div className="w-full flex justify-end px-16 gap-4 mb-4">
          {state.pendingCall?.ron && <button onClick={() => onCall('ron')} className="bg-red-700 text-white px-10 py-2 font-black text-2xl border-b-6 border-red-900 animate-bounce shadow-2xl">榮和 RON</button>}
          {canPlayerTsumo && state.currentTurn === 'player' && <button onClick={onTsumo} className="bg-yellow-500 text-black px-10 py-2 font-black text-2xl border-b-6 border-yellow-800 animate-bounce shadow-2xl">自摸 TSUMO</button>}
          {state.pendingCall?.pon && !state.isPlayerReach && <button onClick={() => onCall('pon')} className="bg-blue-600 text-white px-6 py-1.5 font-black text-xl border-b-4 border-blue-800">碰 PON</button>}
          {state.pendingCall?.chi && !state.isPlayerReach && <button onClick={() => onCall('chi')} className="bg-green-600 text-white px-6 py-1.5 font-black text-xl border-b-4 border-green-800">吃 CHI</button>}
          
          {/* Arcade Energy Skills */}
          {!state.isPlayerReach && state.currentTurn === 'player' && (
            <button 
              onClick={() => onUseSkill('REACH')} 
              disabled={state.playerEnergy < 20}
              className={`px-8 py-1.5 font-black text-xl border-b-4 ${state.playerEnergy >= 20 ? 'bg-orange-600 text-white border-orange-800 shadow-[0_0_10px_rgba(234,88,12,0.5)]' : 'bg-zinc-800 text-zinc-600 border-zinc-950 opacity-50'}`}
            >
              立直 (20 EP)
            </button>
          )}
          {state.currentTurn === 'player' && (
            <button 
              onClick={() => onUseSkill('TSUMO')} 
              disabled={state.playerEnergy < 90}
              className={`px-8 py-1.5 font-black text-xl border-b-4 ${state.playerEnergy >= 90 ? 'bg-purple-600 text-white border-purple-800 animate-pulse shadow-[0_0_15px_rgba(147,51,234,0.6)]' : 'bg-zinc-800 text-zinc-600 border-zinc-950 opacity-50'}`}
            >
              胡牌 (90 EP)
            </button>
          )}

          {/* PASS is now on the far right of the group */}
          {state.pendingCall && <button onClick={() => onCall('PASS')} className="bg-zinc-700 text-white px-6 py-1.5 font-black text-xl border-b-4 border-zinc-900">過 PASS</button>}
        </div>

        {/* Energy Bar */}
        <div className="w-[70%] max-w-3xl h-5 bg-zinc-900 rounded-full border-2 border-white/20 mb-4 overflow-hidden relative shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          <div 
            className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-green-500 transition-all duration-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
            style={{ width: `${state.playerEnergy}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white mix-blend-difference tracking-widest uppercase">
            Energy Power: {state.playerEnergy} / 100
          </div>
        </div>

        {/* Player Hand */}
        <div className="flex items-end gap-2 px-10">
          {state.playerHand.map((tile, index) => {
            const isDrawnTile = index === state.playerHand.length - 1 && (state.playerHand.length + state.playerMelds.length * 3) === 14;
            const lockTile = state.isPlayerReach && !isDrawnTile;
            
            return (
              <MahjongTile 
                key={tile.id} 
                tile={tile} 
                onClick={() => onDiscard(tile.id)}
                isLast={isDrawnTile}
                size="lg"
                className={lockTile ? "pointer-events-none opacity-50 brightness-50 grayscale" : ""}
              />
            );
          })}
          {state.playerMelds.length > 0 && (
            <div className="flex gap-2 ml-4">
              {state.playerMelds.map((meld, i) => (
                <div key={i} className="flex gap-0.5 bg-black/40 p-1.5 rounded-t border-x border-t border-white/10">
                  {meld.tiles.map(t => <MahjongTile key={t.id} tile={t} size="sm" />)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MahjongGame;
