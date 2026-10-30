import { hayPricePerKg, techCost } from './economy';
import { findCard } from './events';
import { isBreedingEligible } from './reproduction';
import type { Action, EventCard, EventChoice, PastureCell, RunState } from './types';

export interface ActionStatus { cost: number; reason: string | null }

export function actionLimit(state: Pick<RunState, 'labor'>): number {
  return 3 + Math.min(2, Math.max(0, Math.floor(state.labor) - 2));
}

/** Physical flags and known current-week decisions share one utilization rule. */
export function pastureUse(state: RunState, cell: PastureCell): 'grazed' | 'cut' | 'resting' {
  if (cell.grazing) return 'grazed';
  if (cell.harvested) return 'cut';
  for (const decision of state.tracking?.pending ?? []) {
    if (decision.kind !== 'action' || !('cellId' in decision.action) || decision.action.cellId !== cell.id) continue;
    if (decision.action.kind === 'graze') return 'grazed';
    if (decision.action.kind === 'cut-hay') return 'cut';
  }
  return 'resting';
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
      else if (pastureUse(state, cell) !== 'resting') reason = '这个小区本周已经使用过；每周只能放牧或割草一次。';
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
  const status = baseEventChoiceStatus(state, card, choice);
  if (!status.reason && choiceId === 'defer' && card?.choices.some(item => item.id !== 'defer' && !baseEventChoiceStatus(state, card, item).reason)) {
    return { ...status, reason: '仍有可执行的应对方案，请先选择事件中的常规选项。' };
  }
  return status;
}

/** Keep unavailable ordinary options visible with reasons; fallback is conditional. */
export function visibleEventChoices(state: RunState, card: EventCard): EventChoice[] {
  return card.choices.filter(choice => choice.id !== 'defer' || !eventChoiceStatus(state, card.id, choice.id).reason);
}

function baseEventChoiceStatus(state: RunState, card: EventCard | undefined, choice: EventChoice | undefined): ActionStatus {
  const cost = Math.max(0, -(choice?.effect.money ?? 0));
  let reason: string | null = null;
  if (!card || !choice || (card.season && card.season !== state.season)) reason = '当前无法处理这个事件。';
  else if (state.ended || state.usedEvents.includes(card.id)) reason = '这个事件已经处理完成。';
  else if (state.money < cost) reason = `现金不足，还差 ¥${(cost - state.money).toLocaleString('zh-CN')}。`;
  else if (state.hayKg + (choice.effect.hayKg ?? 0) < 0) reason = '干草不足，无法完成这次交付。';
  else if ((choice.effect.loseAnimals ?? 0) > state.animals.filter(a => a.alive).length) reason = '存栏不足，无法执行该选择。';
  return { cost, reason };
}
