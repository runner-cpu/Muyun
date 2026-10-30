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
  exitReason?: 'sold' | 'death';
  exitWeek?: number;
}

export type ScenarioId = 'year' | 'winter-challenge-v1';
export const SIM_VERSION = 'decision-v2';

export interface RunMetrics {
  week: number;
  money: number;
  hayKg: number;
  herdValue: number;
  netAssets: number;
  aliveCount: number;
  sheepUnits: number;
  averageBcs: number;
  healthyCount: number;
  grassKg: number;
  averageDegradation: number;
  /** Cumulative known exits; assessment subtracts the baseline. */
  deaths: number;
  sold: number;
  /** Total animal records, so change from baseline counts new births. */
  population: number;
  weeklyFeedKg: number;
  weeklyCost: number;
}

export type Decision = { kind: 'action'; action: Action } | { kind: 'event'; cardId: string; choiceId: string };
export interface WeekRecord {
  week: number;
  season: Season;
  decisions: Decision[];
  metrics: RunMetrics;
  collars: Record<string, number>;
}
export type ReplayOrigin = Omit<RunState, 'tracking'>;
export interface RunTracking {
  version: string;
  provenance: 'new-run' | 'continued';
  origin: ReplayOrigin;
  baseline: RunMetrics;
  weeks: WeekRecord[];
  pending: Decision[];
}

export interface PastureCell {
  id: string;
  areaHa: number;
  biomassKgPerHa: number;
  /** 0 = healthy, 1 = fully degraded. */
  degradation: number;
  restedWeeks: number;
  grazing: boolean;
  /** Cut for hay during the current week; resets after settlement. */
  harvested?: boolean;
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
  scenario?: ScenarioId;
  tracking?: RunTracking;
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
