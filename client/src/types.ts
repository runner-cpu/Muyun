import type { RunState } from './sim/types';

export type Direction = 'down' | 'left' | 'right' | 'up';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface Settings {
  music: number;
  sfx: number;
  muted: boolean;
}

export interface PlayerPosition {
  x: number;
  y: number;
}

/** Everything that survives a reload. The run owns all game state. */
export interface GameStateData {
  run: RunState;
  settings: Settings;
  player: PlayerPosition;
  lastSaved: number;
}

export interface SaveFile {
  version: number;
  data: GameStateData;
}

export interface TriggerDef {
  id: string;
  kind: string;
  payload: string;
  label: string;
  radius: number;
  x: number;
  y: number;
}

export interface DialogueChoice {
  text: string;
  reply: string;
  flag?: string;
}

export interface DialogueLine {
  text: string;
  choices?: DialogueChoice[];
}

export interface DialogueScript {
  speaker: string;
  lines: DialogueLine[];
}

export interface GameEvents {
  'state:changed': void;
  'calendar:changed': { week: number; season: Season };
  'ui:modal': { open: boolean };
  'audio:settings': Settings;
  'input:interact': void;
}
