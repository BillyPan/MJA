
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { GameState, Tile, CallActions, Meld } from '../types';
import MahjongTile from './MahjongTile';
import { calculateFinalScore, sortHand } from '../services/mahjongEngine';

interface MahjongGameProps {
  state: GameState;
  onDiscard: (id: string) => void;
  onUseSkill: (skill: string) => void;
  onTsumo: () => void;
  onCall: (action: keyof CallActions | 'PASS') => void;
  isPendingReach?: boolean;
}

// 名字簡化映射表
const simplifyName = (name: string) => {
  const map: Record<string, string> = {
    "美雪老師": "美雪",
    "麗奈老師": "麗奈",
    "靜香主任": "靜香",
    "優子老師": "優子",
    "小藍老師": "小藍",
    "佐和子老師": "佐和子",
    "惠美院長": "惠美",
    "神秘客": "神秘客",
    "傳說中的畢業生": "畢業生"
  };
  return map[name] || name;
};

const MahjongGame: React.FC<MahjongGameProps> = ({ state, onDiscard, onUseSkill, onTsumo, onCall, isPendingReach }) => {
  const cpuRiverRef = useRef<HTMLDivElement>(null);
  const playerRiverRef = useRef<HTMLDivElement>(null);
  const [cheatCount, setCheatCount] = useState(0);

  // 強化自摸判定：必須是玩家回合且手牌為14張（含副露的邏輯為 mod 3 === 2）
  const canPlayerTsumo = useMemo(() => {
    if (state.currentTurn !== 'player' || state.playerHand.length % 3 !== 2) return false;
    return calculateFinalScore(state.playerHand, state.playerMelds, true, state.isPlayerReach, state.doraIndicator) !== null;
  }, [state.playerHand, state.playerMelds, state.isPlayerReach, state.doraIndicator, state.currentTurn]);

  useEffect(() => {
    if (cpuRiverRef.current) cpuRiverRef.current.scrollTop = cpuRiverRef.current.scrollHeight;
  }, [state.cpuDiscards.length]);

  useEffect(() => {
    if (playerRiverRef.current) playerRiverRef.current.scrollTop = playerRiverRef.current.scrollHeight;
  }, [state.playerDiscards.length]);

  // 重置作弊計數器當新局開始時 (依據牌局階段或分數變動來簡單判斷重置與否，或手動不重置讓玩家一直爽)
  // 這裡選擇不主動重置，讓玩家這局開啟後一直有效，直到刷新頁面。
  
  // 判定是否允許點擊手牌棄牌 (手牌數量模 3 餘 2 代表已摸牌)
  const canInteractWithHand = state.currentTurn === 'player' && !state.pendingCall && (state.playerHand.length % 3 === 2);

  // 取得當前顯示用的名字與訊息
  const instructorName = state.selectedInstructor?.name || '';
  const simplifiedName = simplifyName(instructorName);
  const displayMessage = state.message.replace(instructorName, simplifiedName);

  // 判斷是否顯示 CPU 胡牌手牌 (胡牌動畫 OR 作弊開啟)
  const isCheatEnabled = cheatCount >= 5;
  const isCpuWinReveal = state.isWinAnimation && state.winningHand?.winner === 'cpu';
  const shouldRevealCpuHand = isCpuWinReveal || isCheatEnabled;

  const handleAvatarClick = () => {
    if (cheatCount < 5) {
      setCheatCount(prev => prev + 1);
    }
  };

  // 判斷是否顯示立直棒：正式立直 或 宣告立直中(等待棄牌)
  const showReachStick = state.isPlayerReach || isPendingReach;

  return (
    <div className="w-full h-full flex flex-col bg-[#064e3b] border-[12px] border-[#2c1a10] relative shadow-inner overflow-hidden">
      {/* Top UI */}
      <div className="h-40 flex-shrink-0 flex justify-between items-center px-6 bg-black/60 border-b-2 border-black/40 z-[100]">
        
        {/* Left: CPU Info & Hand */}
        <div className="flex items-center gap-6 flex-shrink-0">
          <div 
            className="relative flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
            onClick={handleAvatarClick}
            title="點擊5次開啟透視眼"
          >
            {/* 調整頭像大小至 w-28 h-28 */}
            <img src={state.selectedInstructor?.avatar} className="w-28 h-28 rounded-full border-4 border-yellow-500 bg-white object-cover shadow-2xl" alt="Teacher" />
            <div className="absolute -bottom-2 -right-2 bg-red-600 text-white px-3 py-1 text-sm font-bold rounded border border-white">老師</div>
          </div>
          <div className="flex flex-col flex-shrink-0 mr-2 min-w-[80px]">
            <div className="text-yellow-400 font-black text-2xl italic tracking-wider">{simplifiedName}</div>
            <div className="text-white text-lg font-bold font-mono tracking-tighter">點數: {state.cpuScore}</div>
          </div>
          {/* CPU Hand */}
          {/* 使用 w-[540px] 並配合 scale-[0.8] 讓牌面清晰且填滿空間 */}
          <div className={`flex gap-0.5 ml-2 self-center origin-left transition-all duration-500 ${shouldRevealCpuHand ? 'scale-[0.8] w-[540px]' : 'scale-90'}`}>
             {shouldRevealCpuHand ? (
                // Reveal winning hand tiles OR Cheat enabled tiles
                // 注意：這裡如果不是胡牌展示，直接使用 state.cpuHand 而不排序，以保留摸牌時的「未整理」狀態
                (isCpuWinReveal && state.winningHand ? sortHand(state.winningHand.hand) : state.cpuHand).map((t, i, arr) => {
                  // 如果是最後一張且手牌是14張(模3餘2)，加上左邊距模擬剛摸牌
                  const isLastDrawn = !isCpuWinReveal && i === arr.length - 1 && arr.length % 3 === 2;
                  return <MahjongTile key={i} tile={t} size="xs" className={isLastDrawn ? "ml-4" : ""} />;
                })
             ) : (
                // Hidden hand
                state.cpuHand.map((_, i) => {
                  // 如果是 CPU 手牌，且當前手牌張數為 14 (3n+2)，最後一張牌(剛剛摸到的)加入左側間距以模擬"思考/摸牌"狀態
                  const isLastDrawn = i === state.cpuHand.length - 1 && state.cpuHand.length % 3 === 2;
                  return (
                    <div 
                      key={i} 
                      className={`w-6 h-9 bg-zinc-200 rounded-sm shadow-md border-b-4 border-zinc-400 ${isLastDrawn ? 'ml-4' : ''}`} 
                    />
                  );
                })
             )}
          </div>
        </div>

        {/* Center: Message ONLY - Flex grow to take available space */}
        <div className="flex items-center justify-center flex-grow px-8 min-w-0 z-10">
          <div className="bg-black/80 px-8 py-3 rounded-lg border-2 border-yellow-500/60 shadow-lg w-full overflow-hidden text-center relative mx-4 transition-all">
            <p className="text-yellow-400 text-xl font-black italic animate-pulse whitespace-nowrap overflow-hidden text-ellipsis px-2">「 {displayMessage} 」</p>
          </div>
        </div>

        {/* Right: Dora & Player Score */}
        <div className="flex items-center gap-6 flex-shrink-0">
          {/* Compact Dora - Moved here for better layout balance */}
          <div className="flex flex-col items-center justify-center bg-red-950/40 px-3 py-1 rounded border border-red-500/30 flex-shrink-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-red-500 font-black text-[10px] italic uppercase opacity-80">懸賞</span>
              <span className="text-red-500 font-black text-xs italic">DORA</span>
            </div>
            {state.doraIndicator && <MahjongTile tile={state.doraIndicator} size="xs" className="scale-90 origin-top" />}
          </div>

          <div className="flex flex-col items-end min-w-[140px] flex-shrink-0">
             <div className="text-yellow-500 text-2xl font-black tracking-widest mb-1 opacity-80">玩家點數</div>
             <div className="text-white text-4xl font-black font-mono tracking-tighter leading-none shadow-black drop-shadow-md">
               {state.playerScore}
             </div>
          </div>
        </div>
      </div>

      {/* Rivers */}
      <div className="flex-grow flex items-center justify-around px-10 py-4 relative overflow-hidden">
        <div className="flex flex-col items-center gap-2 h-full max-h-[320px]">
          <span className="text-white/40 font-bold text-2xl uppercase tracking-widest">{simplifiedName}河牌 {state.isCpuReach && <span className="text-orange-500 ml-2">[ 立直 ]</span>}</span>
          <div ref={cpuRiverRef} className="flex-grow overflow-y-auto custom-scrollbar pr-1 max-w-[560px] scroll-smooth">
            <div className="grid grid-cols-12 gap-1 p-2 bg-black/30 rounded border border-white/10 h-fit">
              {state.cpuDiscards.map((t, i) => <MahjongTile key={i} tile={t} size="xs" />)}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 h-full max-h-[320px]">
          <span className="text-white/40 font-bold text-2xl uppercase tracking-widest">玩家河牌 {state.isPlayerFuriten && <span className="text-red-500 ml-2">[ 振聽 ]</span>}</span>
          <div ref={playerRiverRef} className="flex-grow overflow-y-auto custom-scrollbar pr-1 max-w-[560px] scroll-smooth">
            <div className="grid grid-cols-12 gap-1 p-2 bg-black/30 rounded border border-white/10 h-fit">
              {state.playerDiscards.map((t, i) => <MahjongTile key={i} tile={t} size="xs" />)}
            </div>
          </div>
        </div>
      </div>

      {/* Control Area */}
      <div className="h-[320px] flex-shrink-0 flex flex-col items-center justify-end pb-6 bg-gradient-to-t from-black/95 to-transparent">
        <div className="w-full flex justify-end px-16 gap-3 mb-4">
          <div className="flex gap-3">
            {state.pendingCall?.ron && <button onClick={() => onCall('ron')} className="bg-red-700 text-white px-10 py-2 font-black text-2xl border-b-6 border-red-900 animate-bounce shadow-xl">榮和 RON</button>}
            
            {/* 自摸按鈕 */}
            {canPlayerTsumo && <button onClick={onTsumo} className="bg-yellow-500 text-black px-10 py-2 font-black text-2xl border-b-6 border-yellow-800 animate-bounce shadow-xl">自摸 TSUMO</button>}
            
            {state.pendingCall?.pon && <button onClick={() => onCall('pon')} className="bg-blue-600 text-white px-6 py-1.5 font-black text-xl border-b-4 border-blue-800">碰 PON</button>}
            {state.pendingCall?.chi && <button onClick={() => onCall('chi')} className="bg-green-600 text-white px-6 py-1.5 font-black text-xl border-b-4 border-green-800">吃 CHI</button>}
            {state.pendingCall?.kan && <button onClick={() => onCall('kan')} className="bg-amber-600 text-white px-6 py-1.5 font-black text-xl border-b-4 border-amber-800">槓 KAN</button>}
            
            {state.currentTurn === 'player' && state.playerHand.length % 3 === 2 && (
              <>
                {!state.isPlayerReach && <button onClick={() => onUseSkill('REACH')} className="bg-orange-600 text-white border-orange-800 px-6 py-1.5 font-black text-xl border-b-4">立直</button>}
                <button onClick={() => onUseSkill('EXCHANGE')} disabled={state.playerEnergy < 30} className={`px-6 py-1.5 font-black text-xl border-b-4 ${state.playerEnergy >= 30 ? 'bg-cyan-600 text-white border-cyan-800' : 'bg-zinc-800 text-zinc-600 opacity-50'}`}>換牌 (30 EP)</button>
                <button onClick={() => onUseSkill('TSUMO')} disabled={state.playerEnergy < 90} className={`px-6 py-1.5 font-black text-xl border-b-4 ${state.playerEnergy >= 90 ? 'bg-purple-600 text-white border-purple-800' : 'bg-zinc-800 text-zinc-600 opacity-50'}`}>絕技胡牌 (90 EP)</button>
              </>
            )}

            {state.pendingCall && <button onClick={() => onCall('PASS')} className="bg-zinc-700 text-white px-6 py-1.5 font-black text-xl border-b-4 border-zinc-900">過 PASS</button>}
          </div>
        </div>

        <div className="w-[80%] max-w-3xl mb-4 relative flex items-end">
          {showReachStick && (
             <img 
               src="https://raw.githubusercontent.com/BillyPan/MJA2/main/1000.png"
               alt="Riichi"
               className="absolute right-[100%] bottom-0 mr-4 h-6 w-auto object-contain drop-shadow-[0_0_5px_rgba(0,0,0,0.8)]"
             />
          )}
          <div className="w-full h-6 bg-zinc-900 rounded-full border-2 border-white/20 overflow-hidden relative shadow-inner">
             <div className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-green-500 transition-all duration-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" style={{ width: `${state.playerEnergy}%` }} />
             <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white mix-blend-difference tracking-widest uppercase">技能能量 EP: {state.playerEnergy} / 100</div>
          </div>
        </div>

        <div className="flex items-end gap-2 px-10">
          {state.playerHand.map((tile, index) => {
            const isDrawnTile = index === state.playerHand.length - 1 && state.playerHand.length % 3 === 2;
            const lockTile = (state.isPlayerReach && !isDrawnTile) || !canInteractWithHand;
            return (
              <MahjongTile key={tile.id} tile={tile} onClick={() => canInteractWithHand && onDiscard(tile.id)} isLast={isDrawnTile} size="lg" className={lockTile ? "pointer-events-none opacity-50 grayscale scale-95 origin-bottom transition-all" : ""} />
            );
          })}
          {state.playerMelds.length > 0 && (
            <div className="flex gap-2 ml-6">
              {state.playerMelds.map((meld, i) => (
                <div key={i} className="flex gap-0.5 bg-black/40 p-2 rounded-t-lg border-x border-t border-white/10 shadow-lg">
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
