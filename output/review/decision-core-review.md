# Core review package
Spec: docs/superpowers/specs/2026-10-30-muyun-decision-game-design.md
Evidence: decisionRules 7 + decisionSave 4 + save 6 + weekFlow 5 passed. tsc --noEmit exit 0. No commits in mixed workspace.

## Independent review verdict (2026-10-30)

- Spec compliance: PASS after the P2 fix below.
- Code quality: PASS. No outstanding P1/P2 findings within the reviewed core scope.
- Closed P2: finished legacy v2 saves without tracking previously exposed two zero-action policy rows as a completed strategy comparison. `comparePolicies` now requires a playable recorded origin and at least one settled record via `hasRecordedInterval`; an ended origin or empty interval returns unavailable with a truthful explanation while preserving saved progress.
- Export now labels such legacy results as `source.kind: 'snapshot'` and explains that the missing run cannot be replayed or compared. Snapshot restoration preserves observed metrics without inventing decisions or settled weeks.
- Boundary coverage inspected: the regression loads an actual legacy v2 envelope through `SaveSystem`, retains its finished metrics, refuses comparison, exports/restores a labelled snapshot, and checks source immutability. A separate case retains a valid week-13 continuation with its real settlement while refusing empty history.
- Verification evidence supplied by the implementing agent: 18 planner tests passed. This follow-up inspected the relevant source and regression changes only; no existing test suite was rerun and review scope was not expanded.
- Earlier core checks remain satisfied: correct settlement-week timing and final births, event source immutability, rejection without charging cash/AP, duplicate-service refusals, four challenge settlements, sale/death distinction, and deterministic pure forecasting.

## client/src/sim/types.ts diff
```diff
diff --git a/client/src/sim/types.ts b/client/src/sim/types.ts
index 4bd3d5f..00d3a68 100644
--- a/client/src/sim/types.ts
+++ b/client/src/sim/types.ts
@@ -21,16 +21,60 @@ export interface Animal {
   weightKg: number;
   /** Body condition score, 1 (emaciated) to 5 (obese). */
   bcs: number;
   health: Health;
   pregnant: boolean;
   lactating: boolean;
   collar: boolean;
   alive: boolean;
+  exitReason?: 'sold' | 'death';
+  exitWeek?: number;
+}
+
+export type ScenarioId = 'year' | 'winter-challenge-v1';
+export const SIM_VERSION = 'decision-v1';
+
+export interface RunMetrics {
+  week: number;
+  money: number;
+  hayKg: number;
+  herdValue: number;
+  netAssets: number;
+  aliveCount: number;
+  sheepUnits: number;
+  averageBcs: number;
+  healthyCount: number;
+  grassKg: number;
+  averageDegradation: number;
+  /** Cumulative known exits; assessment subtracts the baseline. */
+  deaths: number;
+  sold: number;
+  /** Total animal records, so change from baseline counts new births. */
+  population: number;
+  weeklyFeedKg: number;
+  weeklyCost: number;
+}
+
+export type Decision = { kind: 'action'; action: Action } | { kind: 'event'; cardId: string; choiceId: string };
+export interface WeekRecord {
+  week: number;
+  season: Season;
+  decisions: Decision[];
+  metrics: RunMetrics;
+  collars: Record<string, number>;
+}
+export type ReplayOrigin = Omit<RunState, 'tracking'>;
+export interface RunTracking {
+  version: string;
+  provenance: 'new-run' | 'continued';
+  origin: ReplayOrigin;
+  baseline: RunMetrics;
+  weeks: WeekRecord[];
+  pending: Decision[];
 }

 export interface PastureCell {
   id: string;
   areaHa: number;
   biomassKgPerHa: number;
   /** 0 = healthy, 1 = fully degraded. */
   degradation: number;
@@ -77,16 +121,18 @@ export type Action =

 export interface LogEntry {
   week: number;
   text: string;
   tone: 'good' | 'bad' | 'info';
 }

 export interface RunState {
+  scenario?: ScenarioId;
+  tracking?: RunTracking;
   seed: number;
   week: number;
   season: Season;
   money: number;
   hayKg: number;
   labor: number;
   reputation: number;
   animals: Animal[];

```

## client/src/sim/run.ts diff
```diff
diff --git a/client/src/sim/run.ts b/client/src/sim/run.ts
index 7760757..605a0cf 100644
--- a/client/src/sim/run.ts
+++ b/client/src/sim/run.ts
@@ -1,22 +1,23 @@
-import { applyWeeklyGrowth, createAnimal } from './animal';
+import { createAnimal } from './animal';
 import { WEEKS_PER_RUN, seasonForWeek } from './calendar';
 import { outbreakChance, progressWeek } from './disease';
 import {
   buyHay,
-  evaluateEnding,
   hayPricePerKg,
   sellAnimals,
   techCost,
-  weeklyCosts,
 } from './economy';
 import { drawEvent, findCard } from './events';
-import { feedRatio, feedRequirementKg } from './nutrition';
-import { averageDegradation, createPastureCells, graze, rest, totalBiomassKg } from './pasture';
+import { averageDegradation, createPastureCells, graze, totalBiomassKg } from './pasture';
+import { actionLimit, actionStatus, eventChoiceStatus } from './rules';
+import { ensureTracking, recordDecision, recordWeek } from './history';
+import { settleDeterministic } from './settlement';
+import { assessRun } from './assessment';
 import { breedHerd, settleBirths } from './reproduction';
 import { chance, mulberry32 } from './rng';
 import type { Rng } from './rng';
 import { drawWeather, isDisaster } from './weather';
 import type {
   Action,
   Animal,
   Effect,
@@ -36,17 +37,18 @@ const VET_BASE_COST = 200;
 const VET_PER_HEAD = 50;

 export interface RunOptions {
   /** Multiplies the starting herd so experiments can vary stocking rate. */
   herdScale?: number;
 }

 export function createRun(seed: number, options: RunOptions = {}): RunState {
-  return {
+  return ensureTracking({
+    scenario: 'year',
     seed,
     week: 1,
     season: 'spring',
     money: STARTING_MONEY,
     hayKg: STARTING_HAY_KG,
     labor: STARTING_LABOUR,
     reputation: STARTING_REPUTATION,
     animals: startingHerd(options.herdScale ?? 1),
@@ -55,31 +57,31 @@ export function createRun(seed: number, options: RunOptions = {}): RunState {
     grazedKg: 0,
     weather: 'clear',
     tech: { collared: 0, vaccinated: false, scanned: false },
     usedEvents: [],
     flags: {},
     log: [{ week: 1, text: '开春。草场刚返青，先看看畜群。', tone: 'info' }],
     ended: false,
     ending: null,
-  };
+  }, 'new-run');
 }

 export function availableActions(state: RunState): Action['kind'][] {
   if (state.ended || state.actionsLeft <= 0) return [];
   return ['graze', 'cut-hay', 'breed', 'vet', 'sell', 'buy-hay', 'tech', 'hire'];
 }

 export function weekEvent(state: RunState): EventCard | null {
   if (state.ended) return null;
   return drawEvent(state.season, state.usedEvents, rngFor(state, 1));
 }

 export function applyAction(state: RunState, action: Action): RunState {
-  if (state.ended || state.actionsLeft <= 0) return state;
+  if (actionStatus(state, action).reason) return state;
   const next: RunState = { ...state, actionsLeft: state.actionsLeft - 1, log: [...state.log] };

   switch (action.kind) {
     case 'graze': {
       const cell = next.pasture.find((item) => item.id === action.cellId);
       if (!cell) return state;
       const result = graze(cell, alive(next.animals));
       next.pasture = next.pasture.map((item) => (item.id === cell.id ? result.cell : item));
@@ -115,46 +117,47 @@ export function applyAction(state: RunState, action: Action): RunState {
       next.animals = next.animals.map((a) => (a.alive && a.health === 'sick' ? { ...a, health: 'healthy' } : a));
       note(next, `兽医处理 ${sick} 头，花费 ${cost} 元`, 'good');
       break;
     }
     case 'sell': {
       const result = sellAnimals(next.animals, action.animalIds, state.season);
       if (result.sold === 0) return state;
       next.animals = result.animals;
+      next.animals = next.animals.map(a => a.exitReason === 'sold' && a.exitWeek === undefined ? { ...a, exitWeek: state.week } : a);
       next.money += result.revenue;
       next.reputation = clamp(next.reputation + 1, 0, 100);
       note(next, `卖出 ${result.sold} 头，收入 ${result.revenue} 元`, 'good');
       break;
     }
     case 'buy-hay': {
       const price = hayPricePerKg(state.season, state.weather === 'blizzard');
       const result = buyHay(next.money, next.hayKg, action.kg, price);
       if (!result.ok) return state;
       next.money = result.money;
       next.hayKg = result.hayKg;
       note(next, `买入 ${action.kg} kg 干草，花费 ${result.cost} 元`, 'info');
       break;
     }
     case 'tech': {
       if (action.tech === 'collar') {
-        const capacity = Math.min(10, alive(next.animals).length - next.tech.collared);
+        const capacity = Math.min(10, alive(next.animals).filter(a => !a.collar).length);
         if (capacity <= 0) return state;
         const cost = techCost('collar', capacity);
         if (next.money < cost) return state;
         next.money -= cost;
         let remaining = capacity;
         next.animals = next.animals.map((a) => {
           if (a.alive && !a.collar && remaining > 0) {
             remaining -= 1;
             return { ...a, collar: true };
           }
           return a;
         });
-        next.tech = { ...next.tech, collared: next.tech.collared + capacity };
+        next.tech = { ...next.tech, collared: alive(next.animals).filter(a => a.collar).length };
         note(next, `给 ${capacity} 头戴上项圈，花费 ${cost} 元`, 'good');
       } else if (action.tech === 'vaccine') {
         const cost = techCost('vaccine', alive(next.animals).length);
         if (next.money < cost) return state;
         next.money -= cost;
         next.tech = { ...next.tech, vaccinated: true };
         note(next, `全群免疫，花费 ${cost} 元`, 'good');
       } else {
@@ -165,68 +168,63 @@ export function applyAction(state: RunState, action: Action): RunState {
         note(next, `购买草场监测，花费 ${cost} 元`, 'good');
       }
       break;
     }
     case 'hire': {
       if (next.money < HIRE_COST) return state;
       next.money -= HIRE_COST;
       next.labor += 1;
-      note(next, '雇了一名帮工', 'info');
+      note(next, `雇了一名帮工，下周行动上限 ${actionLimit(next)} 点；每周增加 260 元人工费`, 'info');
       break;
     }
   }

-  return next;
+  next.tech = { ...next.tech, collared: alive(next.animals).filter(a => a.collar).length };
+  return recordDecision(state, next, { kind: 'action', action: JSON.parse(JSON.stringify(action)) as Action });
 }

 export function resolveEvent(state: RunState, cardId: string, choiceId: string): RunState {
+  if (eventChoiceStatus(state, cardId, choiceId).reason) return state;
   const card = findCard(cardId);
   if (!card || state.ended) return state;
   const choice = card.choices.find((item) => item.id === choiceId);
   if (!choice) return state;
-  const next: RunState = { ...state, log: [...state.log], usedEvents: [...state.usedEvents, cardId] };
+  const next: RunState = { ...state, flags: { ...state.flags }, log: [...state.log], usedEvents: [...state.usedEvents, cardId] };
   applyEffect(next, choice.effect);
   note(next, `${card.title}：${choice.label}`, 'info');
-  return next;
+  next.tech = { ...next.tech, collared: alive(next.animals).filter(a => a.collar).length };
+  return recordDecision(state, next, { kind: 'event', cardId, choiceId });
 }

 export function endWeek(state: RunState): RunState {
   if (state.ended) return state;
-  const next: RunState = { ...state, log: [...state.log] };
-  const season = state.season;
-
-  const ratio = feedHerd(next);
-  next.animals = next.animals.map((animal) => ({
-    ...applyWeeklyGrowth(animal, ratio),
-    ageWeeks: animal.ageWeeks + 1,
-  }));
-
-  next.pasture = next.pasture.map((cell) => (cell.grazing ? { ...cell, grazing: false } : rest(cell, season)));
+  let next = settleDeterministic(state);
   progressDisease(next);
   applyWeather(next);
-  next.money = Math.max(0, next.money - weeklyCosts(next.labor, next.tech));
+  next.tech = { ...next.tech, collared: alive(next.animals).filter(a => a.collar).length };
   next.grazedKg = 0;
-  next.actionsLeft = ACTIONS_PER_WEEK;
-  next.week = Math.min(WEEKS_PER_RUN, next.week + 1);
-  next.season = seasonForWeek(next.week);
+  next.actionsLeft = actionLimit(next);

   if (state.week >= WEEKS_PER_RUN) {
     const births = settleBirths(next.animals, rngFor(next, 10));
     next.animals = births.animals;
     if (births.born > 0) note(next, `接羔 ${births.born} 头`, 'good');
     next.ended = true;
-    next.ending = evaluateEnding({
-      money: next.money,
-      reputation: next.reputation,
-      averageDegradation: averageDegradation(next.pasture),
-    });
+    const assessment = assessRun(next);
+    next.ending = next.money <= 0 ? 'bankrupt'
+      : averageDegradation(next.pasture) >= .7 ? 'collapse'
+      : assessment.eligible ? 'cooperative'
+      : assessment.economy >= 50 && assessment.health >= 50 && assessment.ecology >= 40 && assessment.retainedShare >= .25 ? 'well-off'
+      : 'subsistence';
     note(next, `一局结束：${next.ending}`, 'info');
   }
-
+  next = recordWeek(state, next);
+  next.week = Math.min(WEEKS_PER_RUN, state.week + 1);
+  next.season = seasonForWeek(next.week);
   return next;
 }

 export function summarize(state: RunState): RunSummary {
   const herd = alive(state.animals);
   return {
     week: state.week,
     season: state.season,
@@ -235,57 +233,48 @@ export function summarize(state: RunState): RunSummary {
     averageBcs: herd.length ? herd.reduce((sum, a) => sum + a.bcs, 0) / herd.length : 0,
     totalBiomassKg: totalBiomassKg(state.pasture),
     averageDegradation: averageDegradation(state.pasture),
     reputation: state.reputation,
     ending: state.ending,
   };
 }

-function feedHerd(state: RunState): number {
-  const requirement = feedRequirementKg(alive(state.animals));
-  const available = state.grazedKg + state.hayKg;
-  const ratio = feedRatio(available, requirement);
-  const hayNeeded = Math.max(0, requirement - state.grazedKg);
-  const hayUsed = Math.min(state.hayKg, hayNeeded);
-  state.hayKg = Math.round(state.hayKg - hayUsed);
-  if (ratio < 0.85) note(state, `草料不足，采食率 ${Math.round(ratio * 100)}%`, 'bad');
-  return ratio;
-}
-
 function progressDisease(state: RunState): void {
   const herd = alive(state.animals).length;
   if (chance(rngFor(state, 5), outbreakChance(herd, state.season, state.tech.vaccinated))) {
     const rng = rngFor(state, 6);
     let sickened = 0;
     state.animals = state.animals.map((animal) => {
       if (sickened < 2 && animal.alive && animal.health === 'healthy' && chance(rng, 0.3)) {
         sickened += 1;
         return { ...animal, health: 'sick' as const };
       }
       return animal;
     });
     if (sickened > 0) note(state, `周边疫情传入，${sickened} 头出现症状`, 'bad');
   }

   const progress = progressWeek(state.animals, rngFor(state, 7), false);
-  state.animals = progress.animals;
+  const livingIds = new Set(state.animals.filter(a => a.alive).map(a => a.id));
+  state.animals = progress.animals.map(a => !a.alive && livingIds.has(a.id) ? { ...a, exitReason: 'death', exitWeek: state.week } : a);
   if (progress.deaths > 0) note(state, `疫病死亡 ${progress.deaths} 头`, 'bad');
 }

 function applyWeather(state: RunState): void {
   const weather = drawWeather(state.week, rngFor(state, 8));
   state.weather = weather;
   if (!isDisaster(weather)) return;
   const lost = Math.round(state.hayKg * 0.1);
   state.hayKg = Math.max(0, state.hayKg - lost);
   note(state, `暴雪，草料损失 ${lost} kg`, 'bad');
-  const victim = alive(state.animals).find(() => chance(rngFor(state, 9), 0.05));
+  const disasterRng = rngFor(state, 9);
+  const victim = alive(state.animals).find(() => chance(disasterRng, 0.05));
   if (victim) {
-    state.animals = state.animals.map((a) => (a.id === victim.id ? { ...a, alive: false } : a));
+    state.animals = state.animals.map((a) => (a.id === victim.id ? { ...a, alive: false, exitReason: 'death', exitWeek: state.week } : a));
     note(state, `暴雪中损失 1 头`, 'bad');
   }
 }

 function applyEffect(state: RunState, effect: Effect): void {
   if (effect.money) state.money = Math.max(0, state.money + effect.money);
   if (effect.hayKg) state.hayKg = Math.max(0, state.hayKg + effect.hayKg);
   if (effect.reputation) state.reputation = clamp(state.reputation + effect.reputation, 0, 100);
@@ -293,17 +282,17 @@ function applyEffect(state: RunState, effect: Effect): void {
   if (effect.bcsDelta) {
     state.animals = state.animals.map((animal) =>
       animal.alive
         ? { ...animal, bcs: clamp(Math.round((animal.bcs + effect.bcsDelta!) * 100) / 100, 1, 5) }
         : animal,
     );
   }
   if (effect.infect) state.animals = infect(state.animals, effect.infect);
-  if (effect.loseAnimals) state.animals = kill(state.animals, effect.loseAnimals);
+  if (effect.loseAnimals) state.animals = kill(state.animals, effect.loseAnimals, state.week, (effect.money ?? 0) > 0 ? 'sold' : 'death');
   if (effect.degradationDelta) {
     state.pasture = state.pasture.map((cell) => ({
       ...cell,
       degradation: clamp(cell.degradation + effect.degradationDelta!, 0, 1),
     }));
   }
   if (effect.flag) state.flags[effect.flag] = true;
 }
@@ -314,22 +303,22 @@ function infect(animals: Animal[], count: number): Animal[] {
     if (remaining > 0 && animal.alive && animal.health === 'healthy') {
       remaining -= 1;
       return { ...animal, health: 'sick' as const };
     }
     return animal;
   });
 }

-function kill(animals: Animal[], count: number): Animal[] {
+function kill(animals: Animal[], count: number, week: number, reason: 'sold' | 'death'): Animal[] {
   let remaining = count;
   return animals.map((animal) => {
     if (remaining > 0 && animal.alive) {
       remaining -= 1;
-      return { ...animal, alive: false };
+      return { ...animal, alive: false, exitReason: reason, exitWeek: week };
     }
     return animal;
   });
 }

 function alive(animals: Animal[]): Animal[] {
   return animals.filter((animal) => animal.alive);
 }

```

## client/src/sim/economy.ts diff
```diff
diff --git a/client/src/sim/economy.ts b/client/src/sim/economy.ts
index c3da2a4..99ffbdd 100644
--- a/client/src/sim/economy.ts
+++ b/client/src/sim/economy.ts
@@ -50,17 +50,17 @@ export function sellAnimals(
 ): { animals: Animal[]; revenue: number; sold: number } {
   const wanted = new Set(ids);
   let revenue = 0;
   let sold = 0;
   const next = animals.map((animal) => {
     if (!wanted.has(animal.id) || !animal.alive) return animal;
     revenue += animalPrice(animal, season);
     sold += 1;
-    return { ...animal, alive: false };
+    return { ...animal, alive: false, exitReason: 'sold' as const };
   });
   return { animals: next, revenue, sold };
 }

 export function buyHay(
   money: number,
   hayKg: number,
   kg: number,

```

## client/src/sim/reproduction.ts diff
```diff
diff --git a/client/src/sim/reproduction.ts b/client/src/sim/reproduction.ts
index 3427244..a65ab5a 100644
--- a/client/src/sim/reproduction.ts
+++ b/client/src/sim/reproduction.ts
@@ -39,23 +39,23 @@ export function breedHerd(
  * The D version compresses a year into 13 weeks, so gestation is abstracted:
  * every female that conceived during the run gives birth at settlement.
  */
 export function settleBirths(
   animals: Animal[],
   rng: Rng,
 ): { animals: Animal[]; born: number } {
   const next = animals.map((animal) =>
-    animal.pregnant ? { ...animal, pregnant: false, lactating: true } : animal,
+    animal.alive && animal.pregnant ? { ...animal, pregnant: false, lactating: true } : animal,
   );
   const newborns: Animal[] = [];
   let born = 0;

   for (const animal of animals) {
-    if (!animal.pregnant) continue;
+    if (!animal.alive || !animal.pregnant) continue;
     born += 1;
     newborns.push(
       createAnimal({
         id: `${animal.id}-c${born}`,
         tag: `${animal.tag}-C${born}`,
         species: animal.species,
         sex: chance(rng, 0.5) ? 'male' : 'female',
         ageWeeks: 0,

```

## client/src/sim/events.ts diff
```diff
diff --git a/client/src/sim/events.ts b/client/src/sim/events.ts
index ada9120..6b0dae5 100644
--- a/client/src/sim/events.ts
+++ b/client/src/sim/events.ts
@@ -21,17 +21,17 @@ export const EVENTS: EventCard[] = [
   {
     id: 'drought',
     title: '极端干旱',
     body: '连续三周没下雨，草场返青停滞，土面开始起灰。',
     season: 'summer',
     choices: [
       { id: 'cut-early', label: '提前割草', hint: '保住一部分干草', effect: { money: -400, hayKg: 300 } },
       { id: 'reduce', label: '减少放牧', hint: '让草场喘口气，畜群掉膘', effect: { bcsDelta: -0.1 } },
-      { id: 'well', label: '出钱打井', hint: '长期受益，短期肉疼', effect: { money: -2000, reputation: 2 } },
+      { id: 'well', label: '资助应急供水', hint: '花费 2000 元，口碑 +2；不增加草场恢复', effect: { money: -2000, reputation: 2 } },
     ],
   },
   {
     id: 'rodents',
     title: '草场鼠害',
     body: '鼠洞越来越多，草根被啃，踩上去发空。',
     choices: [
       { id: 'poison', label: '组织投药', hint: '有效，但要花钱', effect: { money: -300, reputation: 2 } },
@@ -40,18 +40,18 @@ export const EVENTS: EventCard[] = [
     ],
   },
   {
     id: 'buyer',
     title: '收购商压价',
     body: '收购商说今年行情不好，只肯给二十八一斤。',
     season: 'autumn',
     choices: [
-      { id: 'accept', label: '接受', hint: '落袋为安', effect: { money: 6000 } },
-      { id: 'haggle', label: '还价', hint: '多卖一点，得罪人', effect: { money: 8000, reputation: -2 } },
+      { id: 'accept', label: '接受', hint: '转出 1 头存栏，固定收入 6000 元', effect: { money: 6000, loseAnimals: 1 } },
+      { id: 'haggle', label: '还价', hint: '转出 1 头存栏，固定收入 8000 元，口碑 -2', effect: { money: 8000, loseAnimals: 1, reputation: -2 } },
       { id: 'refuse', label: '不卖', hint: '再等等行情', effect: {} },
     ],
   },
   {
     id: 'price-surge',
     title: '活畜涨价',
     body: '邻县办赛马会，活畜价格突然涨了一截。',
     choices: [
@@ -89,28 +89,28 @@ export const EVENTS: EventCard[] = [
     ],
   },
   {
     id: 'coop-invite',
     title: '合作社邀请',
     body: '乡里的合作社想拉你入伙，统一采购、统一销售。',
     season: 'autumn',
     choices: [
-      { id: 'join', label: '加入', hint: '交会费，换来长期渠道', effect: { money: -1500, reputation: 8, flag: 'coop' } },
+      { id: 'join', label: '加入', hint: '会费 1500 元，口碑 +8；本局不另加销售收益', effect: { money: -1500, reputation: 8, flag: 'coop' } },
       { id: 'decline', label: '再等等', hint: '保持独立', effect: {} },
     ],
   },
   {
     id: 'vet-visit',
     title: '兽医下乡',
     body: '畜牧站的技术员来了，可以顺便做一次全面检查。',
     season: 'spring',
     choices: [
-      { id: 'full', label: '全面检查', hint: '花钱，但早发现早处理', effect: { money: -600, flag: 'checked' } },
-      { id: 'partial', label: '只看有问题的', hint: '省钱，可能漏掉潜伏病例', effect: { money: -200, infect: 1 } },
+      { id: 'full', label: '建档检查', hint: '花费 600 元建立检查记录；不替代治疗', effect: { money: -600, flag: 'checked' } },
+      { id: 'partial', label: '简略排查', hint: '花费 200 元，模拟中仍有 1 头出现症状', effect: { money: -200, infect: 1 } },
     ],
   },
   {
     id: 'blizzard',
     title: '暴雪封山',
     body: '一夜之间雪没过了小腿，牛群缩在暖棚里不肯出来。',
     season: 'winter',
     choices: [
@@ -125,16 +125,21 @@ export const EVENTS: EventCard[] = [
     body: '清点时少了两头牛，可能是昨天转场时走散了。',
     choices: [
       { id: 'search', label: '组织寻找', hint: '费人费钱，大概率找回', effect: { labor: -1, money: -300, flag: 'found' } },
       { id: 'give-up', label: '放弃', hint: '止损', effect: { loseAnimals: 1 } },
     ],
   },
 ];

+// Every event remains resolvable when cash, hay or herd are exhausted.
+for (const card of EVENTS) {
+  card.choices.push({ id: 'defer', label: '暂缓应对', hint: '不获得本次帮助，口碑 -2', effect: { reputation: -2 } });
+}
+
 export function eligibleCards(season: Season, used: string[]): EventCard[] {
   const usedSet = new Set(used);
   return EVENTS.filter(
     (card) => !usedSet.has(card.id) && (!card.season || card.season === season),
   );
 }

 /** Roughly half the weeks bring a card; the rest pass quietly. */

```

## client/src/sim/rules.ts new
```ts
import { hayPricePerKg, techCost } from './economy';
import { findCard } from './events';
import { isBreedingEligible } from './reproduction';
import type { Action, RunState } from './types';

export interface ActionStatus { cost: number; reason: string | null }

export function actionLimit(state: Pick<RunState, 'labor'>): number {
  return 3 + Math.min(2, Math.max(0, Math.floor(state.labor) - 2));
}

/** UI and simulation share the same refusals and prices. */
export function actionStatus(state: RunState, action: Action): ActionStatus {
  const herd = state.animals.filter(a => a.alive);
  let cost = 0;
  let reason: string | null = null;
  switch (action.kind) {
    case 'graze':
    case 'cut-hay': {
      const cell = state.pasture.find(item => item.id === action.cellId);
      if (!cell) reason = '找不到这个草场小区。';
      else if (cell.biomassKgPerHa <= 0) reason = '草量不足，先让这个小区休牧恢复。';
      else if (action.kind === 'graze' && herd.length === 0) reason = '没有可放牧的牲畜。';
      break;
    }
    case 'breed':
      if (!herd.some(isBreedingEligible)) reason = '没有适龄、体况合格且未妊娠的母畜。';
      break;
    case 'vet': {
      const sick = herd.filter(a => a.health === 'sick').length;
      cost = 200 + 50 * sick;
      if (!sick) reason = '目前没有需要治疗的患病牲畜。';
      break;
    }
    case 'sell':
      if (!herd.some(a => action.animalIds.includes(a.id))) reason = '这些牲畜已不在存栏中。';
      break;
    case 'buy-hay':
      cost = Math.round(action.kg * hayPricePerKg(state.season, state.weather === 'blizzard'));
      if (!Number.isFinite(action.kg) || action.kg <= 0) reason = '请选择有效的购草数量。';
      break;
    case 'hire':
      cost = 3000;
      if (state.labor >= 4) reason = '行动上限已达到每周 5 点，无需继续雇工。';
      break;
    case 'tech':
      if (action.tech === 'collar') {
        const batch = Math.min(10, herd.filter(a => !a.collar).length);
        cost = techCost('collar', batch);
        if (!batch) reason = '当前没有可新增佩戴项圈的牲畜。';
      } else if (action.tech === 'vaccine') {
        cost = techCost('vaccine', herd.length);
        if (state.tech.vaccinated) reason = '本局已完成全群免疫，无需重复接种。';
        else if (!herd.length) reason = '没有需要接种的牲畜。';
      } else {
        cost = techCost('scan', herd.length);
        if (state.tech.scanned) reason = '草场监测已开通，无需重复购买。';
      }
      break;
  }
  if (state.ended) reason = '本局已经结束，可以查看经营结算。';
  else if (state.actionsLeft <= 0) reason = '本周行动点已用完，请结束本周。';
  else if (!reason && state.money < cost) reason = `现金不足，还差 ¥${(cost - state.money).toLocaleString('zh-CN')}。`;
  return { cost, reason };
}

export function eventChoiceStatus(state: RunState, cardId: string, choiceId: string): ActionStatus {
  const card = findCard(cardId);
  const choice = card?.choices.find(item => item.id === choiceId);
  const cost = Math.max(0, -(choice?.effect.money ?? 0));
  let reason: string | null = null;
  if (!card || !choice || (card.season && card.season !== state.season)) reason = '当前无法处理这个事件。';
  else if (state.ended || state.usedEvents.includes(cardId)) reason = '这个事件已经处理完成。';
  else if (state.money < cost) reason = `现金不足，还差 ¥${(cost - state.money).toLocaleString('zh-CN')}。`;
  else if (state.hayKg + (choice.effect.hayKg ?? 0) < 0) reason = '干草不足，无法完成这次交付。';
  else if ((choice.effect.loseAnimals ?? 0) > state.animals.filter(a => a.alive).length) reason = '存栏不足，无法执行该选择。';
  return { cost, reason };
}

```

## client/src/sim/history.ts new
```ts
import { animalPrice, hayPricePerKg, weeklyCosts } from './economy';
import { feedRequirementKg } from './nutrition';
import { averageDegradation, sheepUnitEquivalent, totalBiomassKg } from './pasture';
import { SIM_VERSION } from './types';
import type { Decision, ReplayOrigin, RunMetrics, RunState } from './types';

export function captureMetrics(state: RunState): RunMetrics {
  const herd = state.animals.filter(a => a.alive);
  const herdValue = herd.reduce((sum, a) => sum + animalPrice(a, 'winter'), 0);
  return {
    week: state.week, money: state.money, hayKg: state.hayKg, herdValue,
    netAssets: state.money + herdValue + Math.round(state.hayKg * hayPricePerKg('winter', false)),
    aliveCount: herd.length, sheepUnits: herd.reduce((sum, a) => sum + sheepUnitEquivalent(a), 0),
    averageBcs: herd.length ? herd.reduce((sum, a) => sum + a.bcs, 0) / herd.length : 0,
    healthyCount: herd.filter(a => a.health === 'healthy').length,
    grassKg: totalBiomassKg(state.pasture), averageDegradation: averageDegradation(state.pasture),
    deaths: state.animals.filter(a => a.exitReason === 'death').length,
    sold: state.animals.filter(a => a.exitReason === 'sold').length,
    population: state.animals.length,
    weeklyFeedKg: feedRequirementKg(herd),
    weeklyCost: weeklyCosts(state.labor, { ...state.tech, collared: herd.filter(a => a.collar).length }),
  };
}

export function replayOrigin(state: RunState): ReplayOrigin {
  const { tracking: _tracking, ...origin } = state;
  return JSON.parse(JSON.stringify(origin)) as ReplayOrigin;
}

export function ensureTracking(state: RunState, provenance: 'new-run' | 'continued' = 'continued'): RunState {
  if (state.tracking) return state;
  return { ...state, tracking: {
    version: SIM_VERSION, provenance, origin: replayOrigin(state), baseline: captureMetrics(state), weeks: [], pending: [],
  } };
}

export function recordDecision(before: RunState, after: RunState, decision: Decision): RunState {
  if (before === after) return before;
  const tracked = ensureTracking(before);
  return { ...after, tracking: { ...tracked.tracking!, pending: [...tracked.tracking!.pending, decision] } };
}

/** Called before advancing the calendar; opening events belong to the next record. */
export function recordWeek(before: RunState, after: RunState): RunState {
  const tracking = ensureTracking(before).tracking!;
  const collars = Object.fromEntries(after.animals.filter(a => a.alive && a.collar).map(a => [a.id, a.bcs]));
  return { ...after, tracking: { ...tracking, pending: [], weeks: [...tracking.weeks, {
    week: before.week, season: before.season, decisions: tracking.pending,
    metrics: { ...captureMetrics(after), week: before.week }, collars,
  }].slice(-13) } };
}

```

## client/src/sim/settlement.ts new
```ts
import { applyWeeklyGrowth } from './animal';
import { weeklyCosts } from './economy';
import { feedRatio, feedRequirementKg } from './nutrition';
import { rest } from './pasture';
import type { RunState } from './types';

/** Visible deterministic phases only. Calendar, weather and disease are excluded. */
export function settleDeterministic(state: RunState): RunState {
  const herd = state.animals.filter(a => a.alive);
  const need = feedRequirementKg(herd);
  const ratio = feedRatio(state.grazedKg + state.hayKg, need);
  const hayUsed = Math.min(state.hayKg, Math.max(0, need - state.grazedKg));
  const tech = { ...state.tech, collared: herd.filter(a => a.collar).length };
  const log = [...state.log];
  if (ratio < .85) log.push({ week: state.week, text: `草料不足，采食率 ${Math.round(ratio * 100)}%`, tone: 'bad' });
  return { ...state,
    hayKg: Math.round(state.hayKg - hayUsed),
    animals: state.animals.map(a => ({ ...applyWeeklyGrowth(a, ratio), ageWeeks: a.ageWeeks + 1 })),
    pasture: state.pasture.map(cell => cell.grazing ? { ...cell, grazing: false } : rest(cell, state.season)),
    money: Math.max(0, state.money - weeklyCosts(state.labor, tech)),
    tech, log,
  };
}

```

## client/src/systems/SaveSystem.ts diff
```diff
diff --git a/client/src/systems/SaveSystem.ts b/client/src/systems/SaveSystem.ts
index 812223e..e7de0ea 100644
--- a/client/src/systems/SaveSystem.ts
+++ b/client/src/systems/SaveSystem.ts
@@ -1,59 +1,69 @@
 import { SAVE_KEY, SAVE_VERSION } from '../config';
 import { createDefaultState } from '../core/defaultState';
 import { createRun } from '../sim/run';
 import { clampWeek, seasonForWeek } from '../sim/calendar';
-import type { Animal, PastureCell, RunState, Weather } from '../sim/types';
+import { actionLimit } from '../sim/rules';
+import { ensureTracking } from '../sim/history';
+import { sanitizeTracking } from './trackingSave';
+import type { Animal, PastureCell, RunState, ScenarioId, Weather } from '../sim/types';
 import type { GameStateData, SaveFile } from '../types';

 function numberOr(value: unknown, fallback: number, min: number, max?: number): number {
   const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
   return Math.max(min, max === undefined ? n : Math.min(max, n));
 }

 function stringArray(value: unknown): string[] {
   return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
 }

 /** Rebuilds a run from disk, keeping the seed so the season stays replayable. */
-function sanitizeRun(raw: unknown): RunState | null {
+function sanitizeRun(raw: unknown, includeTracking = true): RunState | null {
   if (!raw || typeof raw !== 'object') return null;
   const source = raw as Record<string, unknown>;
-  if (typeof source.seed !== 'number' || typeof source.week !== 'number') return null;
+  if (typeof source.seed !== 'number' || !Number.isFinite(source.seed) || typeof source.week !== 'number' || !Number.isFinite(source.week)) return null;
   if (!Array.isArray(source.animals) || !Array.isArray(source.pasture)) return null;

   const seed = source.seed;
   const base = createRun(seed);
   const week = clampWeek(Math.round(source.week));

-  return {
+  const labor = Math.round(numberOr(source.labor, base.labor, 0, 20));
+  const animals = (source.animals as Animal[]).slice(0, 1000);
+  if (!animals.every(a => a && typeof a.id === 'string' && typeof a.tag === 'string' && ['yak', 'sheep'].includes(a.species) && ['male', 'female'].includes(a.sex) && [a.bcs, a.weightKg, a.ageWeeks].every(Number.isFinite) && typeof a.alive === 'boolean')) return null;
+  const pasture = (source.pasture as PastureCell[]).slice(0, 4);
+  if (!pasture.length || !pasture.every(p => p && typeof p.id === 'string' && [p.areaHa, p.biomassKgPerHa, p.degradation, p.restedWeeks].every(Number.isFinite))) return null;
+  const rawTech = source.tech && typeof source.tech === 'object' ? source.tech as Record<string, unknown> : {};
+  const result: RunState = {
+    scenario: source.scenario === 'winter-challenge-v1' ? 'winter-challenge-v1' : 'year',
     seed,
     week,
     season: seasonForWeek(week),
     money: Math.round(numberOr(source.money, base.money, 0)),
     hayKg: Math.round(numberOr(source.hayKg, base.hayKg, 0)),
-    labor: Math.round(numberOr(source.labor, base.labor, 0, 20)),
+    labor,
     reputation: Math.round(numberOr(source.reputation, base.reputation, 0, 100)),
-    animals: source.animals as Animal[],
-    pasture: source.pasture as PastureCell[],
-    actionsLeft: Math.round(numberOr(source.actionsLeft, 3, 0, 3)),
+    animals,
+    pasture,
+    actionsLeft: Math.round(numberOr(source.actionsLeft, 3, 0, actionLimit({ labor }))),
     grazedKg: numberOr(source.grazedKg, 0, 0),
-    weather: (source.weather as Weather) ?? 'clear',
-    tech: source.tech && typeof source.tech === 'object'
-      ? (source.tech as RunState['tech'])
-      : base.tech,
+    weather: ['clear', 'wind', 'snow', 'blizzard'].includes(String(source.weather)) ? source.weather as Weather : 'clear',
+    tech: { collared: animals.filter(a => a.alive && a.collar).length, vaccinated: Boolean(rawTech.vaccinated), scanned: Boolean(rawTech.scanned) },
     usedEvents: stringArray(source.usedEvents),
     flags: source.flags && typeof source.flags === 'object'
-      ? (source.flags as Record<string, boolean>)
-      : {},
+      ? Object.fromEntries(Object.entries(source.flags).filter(([key, value]) => key.length < 160 && typeof value === 'boolean').slice(0, 200)) : {},
     log: Array.isArray(source.log) ? (source.log as RunState['log']).slice(-80) : [],
     ended: Boolean(source.ended),
-    ending: (source.ending as RunState['ending']) ?? null,
+    ending: ['bankrupt', 'collapse', 'subsistence', 'well-off', 'cooperative'].includes(String(source.ending)) ? source.ending as RunState['ending'] : null,
   };
+  if (!includeTracking) return result;
+  result.tracking = sanitizeTracking(source.tracking, result, value => sanitizeRun(value, false));
+  return ensureTracking(result);
 }

 export function migrateSave(raw: unknown): SaveFile | null {
   if (!raw || typeof raw !== 'object') return null;
   const envelope = raw as Record<string, unknown>;
   const candidate = envelope.data && typeof envelope.data === 'object'
     ? (envelope.data as Record<string, unknown>)
     : envelope;
@@ -83,46 +93,52 @@ export function migrateSave(raw: unknown): SaveFile | null {
     lastSaved: Math.round(numberOr(candidate.lastSaved, 0, 0)),
   };
   // Older saves came from a different world; reset the position.
   if (version < SAVE_VERSION) data.player = { ...defaults.player };
   return { version: SAVE_VERSION, data };
 }

 export class SaveSystem {
-  exists(): boolean {
+  private active: ScenarioId = 'year';
+  setMode(scenario: ScenarioId): void { this.active = scenario; }
+  private key(scenario = this.active): string { return scenario === 'winter-challenge-v1' ? `${SAVE_KEY}-winter` : SAVE_KEY; }
+
+  exists(scenario?: ScenarioId): boolean {
     try {
-      return Boolean(localStorage.getItem(SAVE_KEY));
+      return Boolean(localStorage.getItem(this.key(scenario)));
     } catch {
       return false;
     }
   }

-  load(): GameStateData | null {
+  load(scenario?: ScenarioId): GameStateData | null {
     try {
-      const raw = localStorage.getItem(SAVE_KEY);
+      const raw = localStorage.getItem(this.key(scenario));
       if (!raw) return null;
       return migrateSave(JSON.parse(raw))?.data ?? null;
     } catch {
       return null;
     }
   }

   save(data: GameStateData): boolean {
     try {
       const payload: SaveFile = { version: SAVE_VERSION, data: { ...data, lastSaved: Date.now() } };
-      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
+      const mode = data.run.scenario ?? 'year';
+      localStorage.setItem(this.key(mode), JSON.stringify(payload));
+      this.active = mode;
       return true;
     } catch {
       return false;
     }
   }

-  clear(): void {
+  clear(scenario?: ScenarioId): void {
     try {
-      localStorage.removeItem(SAVE_KEY);
+      localStorage.removeItem(this.key(scenario));
     } catch {
       /* storage may be disabled */
     }
   }
 }

 export const saveSystem = new SaveSystem();

```

## client/src/systems/trackingSave.ts new
```ts
import type { Action, Decision, RunMetrics, RunState, RunTracking, WeekRecord } from '../sim/types';

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const metricKeys: (keyof RunMetrics)[] = ['week', 'money', 'hayKg', 'herdValue', 'netAssets', 'aliveCount', 'sheepUnits', 'averageBcs', 'healthyCount', 'grassKg', 'averageDegradation', 'deaths', 'sold', 'population', 'weeklyFeedKg', 'weeklyCost'];

function metrics(raw: unknown): RunMetrics | null {
  const value = object(raw);
  if (!value || metricKeys.some(key => typeof value[key] !== 'number' || !Number.isFinite(value[key]) || (value[key] as number) < 0)) return null;
  return Object.fromEntries(metricKeys.map(key => [key, value[key]])) as unknown as RunMetrics;
}

function decision(raw: unknown): Decision | null {
  const d = object(raw);
  if (d?.kind === 'event' && typeof d.cardId === 'string' && typeof d.choiceId === 'string') {
    return { kind: 'event', cardId: d.cardId.slice(0, 80), choiceId: d.choiceId.slice(0, 80) };
  }
  const a = object(d?.action);
  if (d?.kind !== 'action' || !a) return null;
  let action: Action;
  switch (a.kind) {
    case 'graze': case 'cut-hay':
      if (typeof a.cellId !== 'string') return null;
      action = { kind: a.kind, cellId: a.cellId.slice(0, 80) }; break;
    case 'breed': case 'vet': case 'hire': action = { kind: a.kind }; break;
    case 'sell':
      if (!Array.isArray(a.animalIds) || a.animalIds.some(id => typeof id !== 'string')) return null;
      action = { kind: 'sell', animalIds: a.animalIds.slice(0, 1000).map(id => id.slice(0, 80)) }; break;
    case 'buy-hay':
      if (typeof a.kg !== 'number' || !Number.isFinite(a.kg) || a.kg <= 0) return null;
      action = { kind: 'buy-hay', kg: a.kg }; break;
    case 'tech':
      if (!['collar', 'scan', 'vaccine'].includes(String(a.tech))) return null;
      action = { kind: 'tech', tech: a.tech as 'collar' | 'scan' | 'vaccine' }; break;
    default: return null;
  }
  return { kind: 'action', action };
}

function decisions(raw: unknown): Decision[] | null {
  if (!Array.isArray(raw) || raw.length > 20) return null;
  const values = raw.map(decision);
  return values.some(v => v === null) ? null : values as Decision[];
}

export function sanitizeTracking(raw: unknown, state: RunState, parseOrigin: (value: unknown) => RunState | null): RunTracking | undefined {
  const data = object(raw);
  if (!data || typeof data.version !== 'string' || !['new-run', 'continued'].includes(String(data.provenance))) return;
  const origin = parseOrigin(data.origin);
  const baseline = metrics(data.baseline);
  const pending = decisions(data.pending);
  if (!origin || origin.ended || origin.seed !== state.seed || origin.week > state.week || !baseline || !pending || !Array.isArray(data.weeks) || data.weeks.length > 13) return;
  const weeks: WeekRecord[] = [];
  for (const rawWeek of data.weeks) {
    const w = object(rawWeek);
    const m = metrics(w?.metrics);
    const d = decisions(w?.decisions);
    const collars = object(w?.collars);
    if (!w || typeof w.week !== 'number' || !Number.isInteger(w.week) || w.week < origin.week || w.week > state.week || !['spring', 'summer', 'autumn', 'winter'].includes(String(w.season)) || !m || !d || !collars || (weeks.length && w.week !== weeks.at(-1)!.week + 1)) return;
    const validCollars = Object.fromEntries(Object.entries(collars).filter(([id, value]) => id.length < 81 && typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5).slice(0, 1000));
    weeks.push({ week: w.week, season: w.season as WeekRecord['season'], decisions: d, metrics: m, collars: validCollars as Record<string, number> });
  }
  return { version: data.version.slice(0, 80), provenance: data.provenance as RunTracking['provenance'], origin, baseline, weeks, pending };
}

```

## client/src/core/GameState.ts diff
```diff
diff --git a/client/src/core/GameState.ts b/client/src/core/GameState.ts
index bc7974d..674090a 100644
--- a/client/src/core/GameState.ts
+++ b/client/src/core/GameState.ts
@@ -1,24 +1,26 @@
 import { bus } from './emitter';
 import { clone, createDefaultState, SPAWN } from './defaultState';
+import { ensureTracking } from '../sim/history';
 import {
   applyAction as applyRunAction,
   endWeek as endRunWeek,
   resolveEvent as resolveRunEvent,
   summarize,
   weekEvent as currentWeekEvent,
 } from '../sim/run';
 import type {
   Action,
   Animal,
   EventCard,
   PastureCell,
   RunState,
   RunSummary,
+  ScenarioId,
 } from '../sim/types';
 import type { GameStateData, Season } from '../types';

 export class GameState {
   private data: GameStateData = createDefaultState();

   get run(): RunState { return this.data.run; }
   get week(): number { return this.data.run.week; }
@@ -31,27 +33,28 @@ export class GameState {
   get animals(): Animal[] { return this.data.run.animals; }
   get pasture(): PastureCell[] { return this.data.run.pasture; }
   get ended(): boolean { return this.data.run.ended; }
   get ending(): RunState['ending'] { return this.data.run.ending; }
   get log(): RunState['log'] { return this.data.run.log; }
   get weather(): RunState['weather'] { return this.data.run.weather; }
   get settings() { return this.data.settings; }

-  newGame(seed?: number): void {
-    this.data = createDefaultState(seed);
+  newGame(seed?: number, scenario: ScenarioId = 'year'): void {
+    this.data = createDefaultState(seed, scenario);
     this.changed();
+    bus.emit('calendar:changed', { week: this.week, season: this.season });
   }

   load(save: Partial<GameStateData>): void {
     const defaults = createDefaultState();
     this.data = {
       ...defaults,
       ...save,
-      run: save.run ?? defaults.run,
+      run: save.run ? ensureTracking(save.run) : defaults.run,
       settings: { ...defaults.settings, ...(save.settings ?? {}) },
       player: { ...defaults.player, ...(save.player ?? {}) },
     };
     this.changed();
   }

   setPlayer(x: number, y: number): void {
     this.data.player.x = Math.round(x);

```

## client/src/core/defaultState.ts diff
```diff
diff --git a/client/src/core/defaultState.ts b/client/src/core/defaultState.ts
index 5f81321..7bc8d98 100644
--- a/client/src/core/defaultState.ts
+++ b/client/src/core/defaultState.ts
@@ -1,18 +1,20 @@
 import { createRun } from '../sim/run';
+import { createWinterChallenge } from '../sim/scenarios';
+import type { ScenarioId } from '../sim/types';
 import type { GameStateData, Settings } from '../types';

 /** Spawn point for the placeholder ranch, in world pixels. */
 export const SPAWN = { x: 20 * 16, y: 17 * 16 };

-export function createDefaultState(seed = Date.now()): GameStateData {
+export function createDefaultState(seed = Date.now(), scenario: ScenarioId = 'year'): GameStateData {
   const settings: Settings = { music: 0.28, sfx: 0.45, muted: false };
   return {
-    run: createRun(seed),
+    run: scenario === 'winter-challenge-v1' ? createWinterChallenge() : createRun(seed),
     settings,
     player: { ...SPAWN },
     lastSaved: 0,
   };
 }

 export function clone<T>(value: T): T {
   return JSON.parse(JSON.stringify(value)) as T;

```
