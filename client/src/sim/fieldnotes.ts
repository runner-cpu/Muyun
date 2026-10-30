import { feedRequirementKg } from './nutrition';
import { rest, sheepUnitEquivalent, totalBiomassKg } from './pasture';
import { pastureUse } from './rules';
import type { RunState, Season, Species } from './types';
import { snowRisk } from './weather';

export type FieldNoteDestination = 'pasture' | 'market' | 'herd';
export type FieldNoteId = 'winter-reserve' | 'rest-recovery' | 'herd-load';

export interface FieldNote {
  id: FieldNoteId;
  title: string;
  observation: string;
  mechanism: string;
  evidence: { label: string; value: string }[];
  destination: FieldNoteDestination;
  actionLabel: string;
  attention: boolean;
}

export interface SpeciesFieldMetrics {
  species: Species;
  count: number;
  sheepUnits: number;
  weeklyFeedKg: number;
}

export interface FieldNotesView {
  week: number;
  seasonLabel: string;
  notes: FieldNote[];
  metrics: {
    weeklyFeedKg: number;
    hayNeededKg: number;
    hayGapKg: number;
    /** Hay divided by current weekly demand, excluding future grazing and changes. */
    hayEquivalentWeeks: number | null;
    snowRisk: number;
    restingCount: number;
    grazedCount: number;
    cutCount: number;
    restGrowthKg: number;
    /** Sum of each resting cell's decrease in degradation, in percentage points. */
    restRecoveryPoints: number;
    winterGrowthKg: number;
    summerGrowthKg: number;
    species: SpeciesFieldMetrics[];
  };
}

const SEASON_LABEL: Record<Season, string> = {
  spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季',
};

const SPECIES_LABEL: Record<Species, string> = { yak: '牦牛', sheep: '藏羊' };

/** A read-only explanation of the same known rules used by weekly settlement. */
export function buildFieldNotes(state: RunState): FieldNotesView {
  const herd = state.animals.filter(animal => animal.alive);
  const weeklyFeedKg = feedRequirementKg(herd);
  const hayNeededKg = Math.max(0, weeklyFeedKg - state.grazedKg);
  const hayGapKg = Math.max(0, hayNeededKg - state.hayKg);
  const hayEquivalentWeeks = weeklyFeedKg > 0 ? state.hayKg / weeklyFeedKg : null;
  const uses = state.pasture.map(cell => ({ cell, use: pastureUse(state, cell) }));
  const resting = uses.filter(item => item.use === 'resting').map(item => item.cell);
  const grazedCount = uses.filter(item => item.use === 'grazed').length;
  const cutCount = uses.filter(item => item.use === 'cut').length;
  const afterRest = resting.map(cell => rest(cell, state.season));
  const growthIn = (season: Season): number => Math.max(0,
    totalBiomassKg(resting.map(cell => rest(cell, season))) - totalBiomassKg(resting));
  const restGrowthKg = growthIn(state.season);
  const restRecoveryPoints = resting.reduce((sum, cell, index) =>
    sum + Math.max(0, cell.degradation - afterRest[index].degradation) * 100, 0);
  const winterGrowthKg = growthIn('winter');
  const summerGrowthKg = growthIn('summer');
  const species = (['yak', 'sheep'] as const).map(speciesName => {
    const animals = herd.filter(animal => animal.species === speciesName);
    return {
      species: speciesName,
      count: animals.length,
      sheepUnits: animals.reduce((sum, animal) => sum + sheepUnitEquivalent(animal), 0),
      weeklyFeedKg: feedRequirementKg(animals),
    };
  });
  const risk = snowRisk(state.week);
  const seasonLabel = SEASON_LABEL[state.season];
  const usedCount = grazedCount + cutCount;
  const winterObservation = weeklyFeedKg <= 0
    ? '当前没有在栏牲畜，本周没有畜群需草量；干草等量周数暂不计算。'
    : hayGapKg > 0
      ? `现有干草与本周已放牧采食量仍不足以覆盖需草量，尚缺 ${kg(hayGapKg)} kg。`
      : `现有饲草可覆盖本周需草量。干草库存相当于当前畜群 ${number(hayEquivalentWeeks!, 2)} 周的需草量。`;
  const winterNote: FieldNote = {
    id: 'winter-reserve', title: '冬草储备与季节窗口',
    observation: `${seasonLabel}，第 ${state.week} 周。${winterObservation}`,
    mechanism: '本游戏按当周体重计算需草量，先计入已放牧采食量，再消耗干草。草场再生随季节变化，冬季储草可缓冲供草不足；库存不会改变暴雪抽签概率。',
    evidence: [
      { label: '本周全群需草', value: `${kg(weeklyFeedKg)} kg` },
      { label: '已放牧 / 现存干草', value: `${kg(state.grazedKg)} / ${kg(state.hayKg)} kg` },
      { label: '本周需由干草补足', value: `${kg(hayNeededKg)} kg` },
      { label: '本周尚缺饲草', value: `${kg(hayGapKg)} kg` },
      { label: '同批休牧地 · 冬季增草', value: `${kg(winterGrowthKg)} kg` },
      { label: '同批休牧地 · 夏季增草', value: `${kg(summerGrowthKg)} kg` },
      { label: '本周暴雪抽签参数', value: `${number(risk * 100)}%` },
    ],
    destination: 'market', actionLabel: '查看市场与储草', attention: hayGapKg > 0,
  };
  const restNote: FieldNote = {
    id: 'rest-recovery', title: '给草场留出连续休牧',
    observation: state.pasture.length === 0
      ? '当前没有草场小区，暂无休牧恢复可观察。'
      : `${state.pasture.length} 个小区中，${resting.length} 个本周保持休牧，${grazedCount} 个已放牧，${cutCount} 个已割草。`
        + (usedCount > 0 ? '已使用小区的连续休牧会被中断。' : '继续保留未使用小区，可观察连续休牧的变化。'),
    mechanism: '本游戏仅对本周未放牧、未割草的小区计算当季再生。连续休牧满足恢复条件后，退化度逐步降低；放牧或割草会清零连续休牧记录，已使用小区本周不再获得休牧恢复。',
    evidence: [
      { label: '保持休牧', value: `${resting.length} 个小区` },
      { label: '已使用，打断休牧', value: `${usedCount} 个小区` },
      { label: `${seasonLabel}休牧预计增草`, value: `${kg(restGrowthKg)} kg` },
      { label: '最长连续休牧记录', value: `${Math.max(0, ...resting.map(cell => cell.restedWeeks))} 周` },
      { label: '本周预计退化度下降', value: restRecoveryPoints > 0 ? `各休牧小区合计 ${number(restRecoveryPoints, 2)} 个百分点` : '本周暂无下降' },
    ],
    destination: 'pasture', actionLabel: '查看草场轮牧',
    attention: state.pasture.length > 0 && resting.length === 0,
  };
  const totalSheepUnits = species.reduce((sum, item) => sum + item.sheepUnits, 0);
  const herdNote: FieldNote = {
    id: 'herd-load', title: '牦牛与藏羊，两种负担尺度',
    observation: herd.length === 0
      ? '当前没有在栏牲畜，羊单位与畜群需草量均为 0。'
      : `当前在栏 ${herd.length} 头，共 ${number(totalSheepUnits)} 羊单位；按当前体重计算，全群每周需草 ${kg(weeklyFeedKg)} kg。`,
    mechanism: '本游戏用羊单位比较畜群放牧负载，牦牛与藏羊的折算不同；每周饲草需求另按物种、当前体重和饲草损耗计算。羊单位和实际需草量用途不同，不能直接互换。场景中的站位不代表已分配到草场小区。',
    evidence: species.flatMap(item => [
      { label: `${SPECIES_LABEL[item.species]}在栏`, value: `${item.count} 头 · ${number(item.sheepUnits)} 羊单位` },
      { label: `${SPECIES_LABEL[item.species]}每周需草`, value: `${kg(item.weeklyFeedKg)} kg` },
    ]),
    destination: 'herd', actionLabel: '查看畜群与体况', attention: false,
  };
  const priority = (note: FieldNote): number => note.attention ? 0
    : note.id === 'winter-reserve' && (state.season === 'autumn' || state.season === 'winter') ? 1
      : note.id === 'rest-recovery' && usedCount > 0 ? 1 : 2;
  const notes = [winterNote, restNote, herdNote].sort((a, b) => priority(a) - priority(b));
  return {
    week: state.week, seasonLabel, notes,
    metrics: {
      weeklyFeedKg, hayNeededKg, hayGapKg, hayEquivalentWeeks, snowRisk: risk,
      restingCount: resting.length, grazedCount, cutCount, restGrowthKg, restRecoveryPoints,
      winterGrowthKg, summerGrowthKg, species,
    },
  };
}

function number(value: number, maximumFractionDigits = 1): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits });
}

function kg(value: number): string {
  return number(value);
}
