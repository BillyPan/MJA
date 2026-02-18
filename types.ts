
export type TileType = 'm' | 'p' | 's' | 'z';
export type TileValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Tile {
  id: string;
  type: TileType;
  value: number;
}

export interface Meld {
  type: 'chi' | 'pon' | 'kan';
  tiles: Tile[];
}

export enum GamePhase {
  INTRO = 'INTRO',
  SELECT_OPPONENT = 'SELECT_OPPONENT',
  PLAYING = 'PLAYING',
  RESULT = 'RESULT',
  GAME_OVER = 'GAME_OVER'
}

export interface Instructor {
  id: number;
  name: string;
  avatar: string;
  prompt: string;
  description: string;
  difficulty: number;
  specialSkillChance?: number; // 0.0 to 1.0
  maxSkillUses?: number; // Maximum times skill can be used per round
}

export interface CallActions {
  ron: boolean;
  pon: boolean;
  chi: boolean;
  kan: boolean;
}

export interface GameState {
  playerHand: Tile[];
  playerMelds: Meld[];
  cpuHand: Tile[];
  cpuMelds: Meld[];
  deck: Tile[];
  playerDiscards: Tile[];
  cpuDiscards: Tile[];
  currentTurn: 'player' | 'cpu';
  playerEnergy: number; // For arcade skills
  playerScore: number; // Actual Mahjong points
  cpuScore: number;
  phase: GamePhase;
  selectedInstructor: Instructor | null;
  message: string;
  winningHand?: WinningResult;
  isPlayerReach: boolean;
  isCpuReach: boolean;
  lastDiscardTile: Tile | null;
  pendingCall: CallActions | null;
  doraIndicator: Tile | null;
  isPlayerFuriten: boolean;
  isWinAnimation: boolean;
  skillUsedCount: number; // New: Tracks CPU skill usage in current round
}

export interface YakuResult {
  name: string;
  fan: number;
}

export interface WinningResult {
  winner: 'player' | 'cpu';
  yaku: YakuResult[];
  doraCount: number;
  fan: number;
  fu: number;
  points: number;
  hand: Tile[];
  melds: Meld[];
  isTsumo: boolean;
}