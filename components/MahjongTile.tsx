import React, { useState } from 'react';
import { Tile } from '../types';
import { getTileImageUrl } from '../constants';

interface MahjongTileProps {
  tile: Tile;
  onClick?: () => void;
  isLast?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const MahjongTile: React.FC<MahjongTileProps> = ({ tile, onClick, isLast, size = 'md', className = '' }) => {
  const [hasError, setHasError] = useState(false);
  const imageUrl = getTileImageUrl(tile.type, tile.value);
  
  // Sizes adjusted:
  // xs: ~44x63 (for 24 tiles per row in pond)
  // sm: ~50x72
  // md: ~72x101
  // lg: Reduced from ~86px to ~76px to fit 1280px width on mobile scaler
  const sizeClasses = {
    xs: 'w-[44px] h-[63px]',
    sm: 'w-[50px] h-[72px]',
    md: 'w-[72px] h-[101px]',
    lg: 'w-[76px] h-[108px]'
  };

  return (
    <div 
      onClick={onClick}
      className={`
        relative ${sizeClasses[size]} bg-white rounded-sm cursor-pointer 
        flex flex-col items-center justify-center
        transition-all transform mahjong-tile-3d
        hover:-translate-y-2 hover:brightness-110
        active:translate-y-0.5
        ${isLast ? 'ml-6 ring-2 ring-yellow-500 ring-offset-2 ring-offset-[#0a4d2e]' : ''}
        ${className}
      `}
    >
      <div className="w-full h-full p-0.5 bg-gradient-to-br from-[#ffffff] via-[#fcfcfc] to-[#e0e0e0] flex items-center justify-center rounded-sm border-[0.5px] border-black/10 overflow-hidden">
        {!hasError ? (
          <img 
            src={imageUrl} 
            alt={`${tile.type}${tile.value}`}
            className="w-full h-full object-contain select-none drop-shadow-[1px_1.5px_1px_rgba(0,0,0,0.3)]"
            draggable={false}
            onError={() => {
              console.error("Failed to load tile:", imageUrl);
              setHasError(true);
            }}
          />
        ) : (
          <div className="text-black font-black flex flex-col items-center justify-center leading-none opacity-60">
            <span className="text-[8px]">{tile.type === 'z' ? getHonorLabel(tile.value) : tile.type.toUpperCase()}</span>
            <span className="text-sm">{tile.value}</span>
          </div>
        )}
      </div>
      
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/30 to-white/50 opacity-40 rounded-sm"></div>

      {isLast && (
        <div className="absolute bottom-1 right-1 bg-red-600 text-white font-black text-[10px] px-1 py-0.5 rounded-sm shadow-xl animate-bounce-short z-20 serif-font italic border border-white/30 select-none">
          摸
        </div>
      )}
      
      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-short {
          animation: bounce-short 0.8s infinite;
        }
      `}</style>
    </div>
  );
};

const getHonorLabel = (val: number): string => {
  const labels: Record<number, string> = { 1: '東', 2: '南', 3: '西', 4: '北', 5: '白', 6: '發', 7: '中' };
  return labels[val] || '';
};

export default MahjongTile;