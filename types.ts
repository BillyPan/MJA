
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
  playerEnergy: number;
  phase: GamePhase;
  selectedInstructor: Instructor | null;
  message: string;
  winningHand?: WinningResult;
  isPlayerReach: boolean;
  lastDiscardTile: Tile | null;
  pendingCall: CallActions | null;
}

export interface WinningResult {
  winner: 'player' | 'cpu';
  yaku: string[];
  points: number;
  hand: Tile[];
  melds: Meld[];
}
