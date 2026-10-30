import { weeklyCosts } from '../sim/economy';
import { findCard } from '../sim/events';
import { feedRequirementKg } from '../sim/nutrition';
import { averageDegradation } from '../sim/pasture';
import type { EventCard, RunState, Weather } from '../sim/types';

const WEATHER_LABELS: Record<Weather, string> = {
  clear: '晴朗', wind: '大风', snow: '降雪', blizzard: '暴雪',
};

/** Read-only UI projection. Feed quantities use the same units and formula as endWeek. */
export function ranchSnapshot(run: RunState) {
  const herd = run.animals.filter((animal) => animal.alive);
  const feedNeedKg = feedRequirementKg(herd);
  const feedRequiredHayKg = Math.max(0, feedNeedKg - run.grazedKg);
  const feedGapKg = Math.max(0, feedRequiredHayKg - run.hayKg);
  const hayAfterFeedingKg = Math.round(run.hayKg - Math.min(run.hayKg, feedRequiredHayKg));
  const sickCount = herd.filter((animal) => animal.health === 'sick').length;
  const averageBcs = herd.length ? herd.reduce((total, animal) => total + animal.bcs, 0) / herd.length : 0;
  const weeklyCost = weeklyCosts(run.labor, { ...run.tech, collared: herd.filter(animal => animal.collar).length });
  const cashAfterCosts = Math.max(0, run.money - weeklyCost);
  const cashAtRisk = run.money <= weeklyCost;
  const degradation = averageDegradation(run.pasture);

  let headline = '本周饲草已备齐';
  let hint = '先核对三周储备与持续费用，再安排轮牧或经营投入。';
  if (run.actionsLeft === 0) hint = '行动点已用完，可以结算本周。';
  if (sickCount > 0) {
    headline = `${sickCount} 头牲畜需要治疗`;
    hint = '打开畜群查看患病个体，安排兽医处理。';
  }
  if (cashAtRisk) {
    headline = '本周结算后现金将耗尽';
    hint = run.actionsLeft > 0
      ? '先到集市回笼现金，为人工和设备维护留下结余。'
      : run.week === 13 ? '行动点已用完，本次期末结算将触发资金耗尽结局。' : '行动点已用完，下周现金将为零，请留意后续补给与维护支出。';
  }
  if (feedGapKg > 0) {
    headline = `本周缺草 ${Math.ceil(feedGapKg).toLocaleString('zh-CN')} kg`;
    hint = run.actionsLeft > 0
      ? '先安排放牧、割草或去集市补草，再结束本周。'
      : '行动点已用完，结算时将按现有饲草喂养。';
  }
  if (herd.length === 0) {
    headline = '牧场暂无存栏';
    hint = '可以继续整理草场，并结算余下周次。';
  }
  if (run.ended) {
    headline = '十三周的牧场生活结束了';
    hint = '查看结算，回顾这次经营的得失。';
  }

  return {
    feedNeedKg, feedRequiredHayKg, feedGapKg, hayAfterFeedingKg,
    grazedKg: run.grazedKg, aliveCount: herd.length, sickCount, averageBcs,
    averageDegradation: degradation, weeklyCost, cashAfterCosts, cashAtRisk,
    weatherLabel: WEATHER_LABELS[run.weather] ?? '天气未知',
    headline, hint, feedTone: feedGapKg > 0 || sickCount > 0 || cashAtRisk ? 'bad' as const : 'good' as const,
  };
}

export function pendingEventFlag(week: number, cardId: string): string {
  return `pending-event:${week}:${cardId}`;
}

/** Compact HUD keeps the highest-priority decision visible on short screens. */
export function weeklyAlert(run: RunState): { text: string; tone: 'bad' | 'good' | 'info' } {
  const view = ranchSnapshot(run);
  if (run.ended) return { text: '本局已结束 · 查看经营回顾', tone: 'info' };
  if (!view.aliveCount) return { text: '牧场暂无存栏 · 查看本周安排', tone: 'info' };
  if (view.feedGapKg > 0) return { text: `缺草 ${Math.ceil(view.feedGapKg).toLocaleString('zh-CN')} kg · ${run.actionsLeft ? '优先放牧或补草' : '行动已用完'}`, tone: 'bad' };
  if (view.cashAtRisk) return { text: '结算后现金将耗尽 · 查看资金安排', tone: 'bad' };
  if (view.sickCount) return { text: `${view.sickCount} 头患病 · 查看照料安排`, tone: 'bad' };
  if (!run.actionsLeft) return { text: '饲草已备齐 · 行动已用完，可结算', tone: 'info' };
  return { text: `本周饲草已备齐 · 余 ${run.actionsLeft} 行动`, tone: 'good' };
}

/** Only events explicitly recorded as pending are restored; legacy saves keep their behavior. */
export function pendingEventForRun(run: RunState): EventCard | null {
  if (run.ended) return null;
  const prefix = `pending-event:${run.week}:`;
  for (const key of Object.keys(run.flags)) {
    if (!key.startsWith(prefix) || !run.flags[key]) continue;
    const card = findCard(key.slice(prefix.length));
    if (card && !run.usedEvents.includes(card.id)) return card;
  }
  return null;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (value) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[value]!);
}
