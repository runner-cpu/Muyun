export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Species = 'yak' | 'sheep';
export type Sex = 'male' | 'female';
export type Health = 'healthy' | 'subclinical' | 'sick';
export type Weather = 'clear' | 'wind' | 'snow' | 'blizzard';
export type TechKind = 'collar' | 'vaccine' | 'scan';

export type Ending =
  | 'bankrupt'
  | 'subsistence'
  | 'well-off'
  | 'cooperative'
  | 'collapse';

export interface Animal {
  id: string;
  tag: string;
  species: Species;
  sex: Sex;
  ageWeeks: number;
  weightKg: number;
  /** Body condition score, 1 (emaciated) to 5 (obese). */
  bcs: number;
  health: Health;
  pregnant: boolean;
  lactating: boolean;
  collar: boolean;
  alive: boolean;
}

export interface PastureCell {
  id: string;
  areaHa: number;
  biomassKgPerHa: number;
  /** 0 = healthy, 1 = fully degraded. */
  degradation: number;
  restedWeeks: number;
  grazing: boolean;
}

export interface Effect {
  money?: number;
  hayKg?: number;
  reputation?: number;
  labor?: number;
  bcsDelta?: number;
  infect?: number;
  loseAnimals?: number;
  degradationDelta?: number;
  flag?: string;
}

export interface EventChoice {
  id: string;
  label: string;
  hint: string;
  effect: Effect;
}

export interface EventCard {
  id: string;
  title: string;
  body: string;
  season?: Season;
  choices: EventChoice[];
}

export type Action =
  | { kind: 'graze'; cellId: string }
  | { kind: 'cut-hay'; cellId: string }
  | { kind: 'breed' }
  | { kind: 'vet' }
  | { kind: 'sell'; animalIds: string[] }
  | { kind: 'buy-hay'; kg: number }
  | { kind: 'tech'; tech: TechKind }
  | { kind: 'hire' };

export interface LogEntry {
  week: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}

export interface RunState {
  seed: number;
  week: number;
  season: Season;
  money: number;
  hayKg: number;
  labor: number;
  reputation: number;
  animals: Animal[];
  pasture: PastureCell[];
  actionsLeft: number;
  /** Biomass eaten off pasture this week, in kg of dry matter. */
  grazedKg: number;
  weather: Weather;
  tech: { collared: number; vaccinated: boolean; scanned: boolean };
  usedEvents: string[];
  flags: Record<string, boolean>;
  log: LogEntry[];
  ended: boolean;
  ending: Ending | null;
}

export interface RunSummary {
  week: number;
  season: Season;
  money: number;
  herdSize: number;
  averageBcs: number;
  totalBiomassKg: number;
  averageDegradation: number;
  reputation: number;
  ending: Ending | null;
}
