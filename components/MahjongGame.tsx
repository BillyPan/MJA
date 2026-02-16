
import React, { useMemo } from 'react';
import { GameState, Tile, CallActions, Meld } from '../types';
import MahjongTile from './MahjongTile';
import { checkTenpai, checkWin } from '../services/mahjongEngine';

interface MahjongGameProps {
  state: GameState;
  onDiscard: (id: string) => void;
  onUseSkill: (skill: string) => void;
  onTsumo: () => void;
  onCall: (action: keyof CallActions | 'PASS') => void;
}

const MahjongGame: React.FC<MahjongGameProps> = ({ state, onDiscard, onUseSkill, onTsumo, onCall }) => {
  const isTenpai = useMemo(() => {
    const totalCount = state.playerHand.length + state.playerMelds.length * 3;
    if (totalCount === 13) {
      return checkTenpai(state.playerHand, state.playerMelds);
    }
    return false;
  }, [state.playerHand.length, state.playerMelds.length]);

  const canPlayerWin = useMemo(() => {
    return checkWin(state.playerHand, state.playerMelds);
  }, [state.playerHand, state.playerMelds]);
  
  const canShowReach = !state.isPlayerReach && (state.playerHand.length + state.playerMelds.length * 3 === 14) && state.currentTurn === 'player';

  // Pond grid adjusted to 24 columns for compact discard view
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
    gap: '0.2rem'
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#064e3b] border-[12px] border-[#2c1a10] relative shadow-inner overflow-hidden">
      {/* Top Header Section with Dialogue and CPU Info */}
      <div className="h-32 flex justify-between items-center px-10 bg-black/60 border-b-2 border-black/40 z-[100] relative">
        <div className="flex items-center gap-4 min-w-[300px]">
          <div className="relative">
            <img 
              src={state.selectedInstructor?.avatar} 
              className="w-20 h-20 rounded-lg border-2 border-yellow-500 bg-white object-cover" 
              alt="CPU Avatar"
            />
            <div className="absolute -bottom-2 -right-2 bg-red-600 text-white text-[10px] px-1 font-bold">CPU</div>
          </div>
          <div className="flex flex-col">
            <div className="text-yellow-400 font-black text-xl italic tracking-wider">{state.selectedInstructor?.name}</div>
            <div className="text-white/40 text-[10px]">INSTRUCTOR LV.{state.selectedInstructor?.difficulty}</div>
          </div>
        </div>

        {/* Dialogue Box */}
        <div className="flex-grow flex justify-center px-4">
          <div className="bg-black/80 px-10 py-4 rounded-full border-2 border-yellow-500/40 backdrop-blur-md shadow-lg max-w-2xl">
            <p className="text-yellow-400 text-xl font-black italic tracking-widest text-center truncate">
              {state.isPlayerReach && <span className="text-red-500 mr-2">[立直中]</span>}
              「 {state.message} 」
            </p>
          </div>
        </div>

        <div className="flex gap-1 items-end min-w-[300px] justify-end">
          {state.cpuHand.map((_, i) => (
            <div key={i} className="w-6 h-10 bg-zinc-200 rounded-sm shadow-md border-b-4 border-zinc-400" />
          ))}
          {state.cpuMelds.map((m, i) => (
            <div key={i} className="flex gap-0.5 ml-2 p-1 bg-black/20 rounded">
              {m.tiles.map(t => <MahjongTile key={t.id} tile={t} size="sm" />)}
            </div>
          ))}
        </div>
      </div>

      {/* Main Board Section - Discard Pond */}
      <div className="flex-grow flex flex-col items-center justify-center p-4 relative overflow-y-auto">
        {/* CPU Discards */}
        <div style={gridStyle} className="opacity-80 rotate-180 mb-2 w-full max-w-[1200px] justify-items-center">
          {state.cpuDiscards.map(t => <MahjongTile key={t.id} tile={t} size="xs" />)}
        </div>

        {/* Thinner separator to keep ponds close */}
        <div className="w-full h-[1px] bg-white/5 my-2 shadow-[0_0_5px_white/5]"></div>

        {/* Player Discards */}
        <div style={gridStyle} className="opacity-80 mt-2 w-full max-w-[1200px] justify-items-center">
          {state.playerDiscards.map(t => <MahjongTile key={t.id} tile={t} size="xs" />)}
        </div>
      </div>

      {/* Player Controls Section */}
      <div className="h-[360px] flex flex-col items-center justify-end pb-8 bg-gradient-to-t from-black/90 to-transparent relative">
        
        {/* Interaction Row (Gauge - Call Actions (Center) - Skill Buttons) */}
        <div className="w-full px-12 grid grid-cols-3 items-center mb-4">
          {/* Column 1: Energy Gauge */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-black text-red-500 italic tracking-tighter w-[300px]">
              <span>SPECIAL POWER GAUGE</span>
              <span className="text-lg">{state.playerEnergy}%</span>
            </div>
            <div className="w-[300px] h-5 bg-zinc-900 border-2 border-zinc-600 rounded-sm overflow-hidden p-0.5 shadow-inner">
              <div 
                className={`h-full transition-all duration-700 ${state.playerEnergy >= 80 ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 animate-pulse' : 'bg-gradient-to-r from-red-600 to-orange-400'}`} 
                style={{ width: `${state.playerEnergy}%`, boxShadow: state.playerEnergy >= 80 ? '0 0 20px rgba(234,179,8,0.8)' : '0 0 10px rgba(255,0,0,0.4)' }}
              ></div>
            </div>
          </div>

          {/* Column 2: Call Actions (Overall Middle) */}
          <div className="flex justify-center h-12">
            {state.pendingCall && (
              <div className="flex gap-2 p-1 bg-black/80 border border-yellow-500/50 rounded-lg shadow-[0_0_30px_rgba(234,179,8,0.3)] animate-in zoom-in-95 duration-200 z-[200]">
                {state.pendingCall.ron && <button onClick={() => onCall('ron')} className="bg-red-700 text-white px-6 py-1 font-black text-xl hover:bg-red-600 border-b-2 border-red-900 active:translate-y-0.5 transition-colors shadow-lg">胡 / RON</button>}
                {state.pendingCall.pon && <button onClick={() => onCall('pon')} className="bg-blue-700 text-white px-6 py-1 font-black text-xl hover:bg-blue-600 border-b-2 border-blue-900 active:translate-y-0.5 transition-colors shadow-lg">碰 / PON</button>}
                {state.pendingCall.chi && <button onClick={() => onCall('chi')} className="bg-green-700 text-white px-6 py-1 font-black text-xl hover:bg-green-600 border-b-2 border-green-900 active:translate-y-0.5 transition-colors shadow-lg">吃 / CHI</button>}
                {state.pendingCall.kan && <button onClick={() => onCall('kan')} className="bg-orange-700 text-white px-6 py-1 font-black text-xl hover:bg-orange-600 border-b-2 border-orange-900 active:translate-y-0.5 transition-colors shadow-lg">槓 / KAN</button>}
                <button onClick={() => onCall('PASS')} className="bg-zinc-700 text-white px-6 py-1 font-black text-xl border-b-2 border-zinc-900 active:translate-y-0.5 transition-colors shadow-lg">過 / PASS</button>
              </div>
            )}
          </div>

          {/* Column 3: Skill Buttons */}
          <div className="flex gap-3 justify-end">
            {canShowReach && (
              <button 
                onClick={() => onUseSkill('REACH')} 
                className="bg-green-800 text-white px-6 py-2 font-black border-2 border-green-400 animate-pulse text-lg shadow-2xl transition-all"
              >
                立直 / REACH
              </button>
            )}
            <button 
              onClick={() => onUseSkill('TSUMO')} 
              disabled={state.playerEnergy < 80}
              className={`px-6 py-2 font-black border-2 text-lg shadow-2xl transition-all ${state.playerEnergy >= 80 ? 'bg-red-800 text-white border-red-500 animate-bounce cursor-pointer hover:bg-red-700' : 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed opacity-50'}`}
            >
              奧義 / TSUMO
            </button>
            {canPlayerWin && state.currentTurn === 'player' && (
              <button onClick={onTsumo} className="bg-yellow-500 text-black px-10 py-2 font-black text-2xl border-2 border-white animate-pulse shadow-[0_0_40px_white]">自摸 / TSUMO</button>
            )}
          </div>
        </div>

        {/* Player Hand (Shifted down further by 24px) */}
        <div className="flex items-end gap-3 px-12 relative overflow-x-auto max-w-full pb-8 translate-y-[24px]">
          <div className="flex gap-1.5">
            {state.playerHand.map((tile, index) => {
              const isDrawn = index === state.playerHand.length - 1 && (state.playerHand.length + state.playerMelds.length * 3) === 14;
              return (
                <MahjongTile 
                  key={tile.id} 
                  tile={tile} 
                  onClick={() => onDiscard(tile.id)}
                  isLast={isDrawn}
                  size="lg"
                  className={state.isPlayerReach && !isDrawn ? 'pointer-events-none opacity-80' : ''}
                />
              );
            })}
          </div>
          {state.playerMelds.length > 0 && (
            <div className="flex gap-4 ml-6 border-l-2 border-white/20 pl-6 items-end pb-2">
              {state.playerMelds.map((meld, i) => (
                <div key={i} className="flex gap-1 bg-black/40 p-2 rounded shadow-xl border border-white/10">
                  {meld.tiles.map(t => <MahjongTile key={t.id} tile={t} size="md" />)}
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
