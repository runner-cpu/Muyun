export type Direction = 'down' | 'left' | 'right' | 'up';
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type PetType = 'orange' | 'black' | 'white';

export interface Settings {
  music: number;
  sfx: number;
  muted: boolean;
}

export interface PlayerPosition {
  x: number;
  y: number;
}

export interface GameStateData {
  day: number;
  timeMinutes: number;
  credits: number;
  mood: number;
  flags: Record<string, boolean>;
  cats: string[];
  achievements: string[];
  settings: Settings;
  player: PlayerPosition;
  lastSigninDay: number;
  signinStreak: number;
  hideAttempts: number;
  hideDay: number;
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

export interface SkillDef {
  id: string;
  name: string;
  type: PetType;
  power: number;
  description: string;
}

export interface PetDef {
  id: string;
  name: string;
  type: PetType;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  skills: [string, string];
  description: string;
}

export interface CatDef {
  id: string;
  name: string;
  variant: number;
  type: PetType | null;
  petId: string | null;
  description: string;
}

export interface BuildingDef {
  id: string;
  name: string;
  type: 'gate' | 'lab' | 'dorm' | 'canteen' | 'activity' | 'sports' | 'library' | 'academic';
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floors: number;
  variant: number;
}

export interface HideSpot {
  id: string;
  name: string;
  tx: number;
  ty: number;
}

export interface BattleResult {
  win: boolean;
  rewards: { credit: number; mood: number };
}

export interface GameEvents {
  'state:changed': void;
  'time:changed': { day: number; minutes: number; phase: DayPhase };
  'ui:modal': { open: boolean };
  'audio:settings': Settings;
}
