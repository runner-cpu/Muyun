import { chance, pick } from './rng';
import type { Rng } from './rng';
import type { EventCard, Season } from './types';

/**
 * Twelve decisions a plateau herder actually faces. No option is free:
 * every choice trades money, feed, condition or reputation against another.
 */
export const EVENTS: EventCard[] = [
  {
    id: 'snow-warning',
    title: '雪灾预警',
    body: '气象站说，十天后有强降雪。草料贩子已经开始涨价。',
    season: 'winter',
    choices: [
      { id: 'prep', label: '提前备草', hint: '增加储备，不改变暴雪发生概率', effect: { money: -800, hayKg: 400, flag: 'prepared' } },
      { id: 'wait', label: '再等等', hint: '维持当前储备，承担天气风险', effect: {} },
      { id: 'destock', label: '先卖两头减载', hint: '减轻冬季压力，但少了牲畜', effect: { money: 4000, loseAnimals: 2 } },
    ],
  },
  {
    id: 'drought',
    title: '极端干旱',
    body: '连续三周没下雨，草场返青停滞，土面开始起灰。',
    season: 'summer',
    choices: [
      { id: 'cut-early', label: '提前割草', hint: '保住一部分干草', effect: { money: -400, hayKg: 300 } },
      { id: 'reduce', label: '减少放牧', hint: '让草场喘口气，畜群掉膘', effect: { bcsDelta: -0.1 } },
      { id: 'well', label: '资助应急供水', hint: '花费 2000 元，口碑 +2；不增加草场恢复', effect: { money: -2000, reputation: 2 } },
    ],
  },
  {
    id: 'rodents',
    title: '草场鼠害',
    body: '鼠洞越来越多，草根被啃，踩上去发空。',
    choices: [
      { id: 'poison', label: '组织投药', hint: '支付费用并提升口碑；本次不恢复草场', effect: { money: -300, reputation: 2 } },
      { id: 'ignore', label: '先不管', hint: '省事，草场继续退化', effect: { degradationDelta: 0.04 } },
      { id: 'trap', label: '人工捕鼠', hint: '减少可用人手并提升口碑；本次不恢复草场', effect: { labor: -1, money: -100, reputation: 1 } },
    ],
  },
  {
    id: 'buyer',
    title: '收购商压价',
    body: '收购商说今年行情不好，只肯给二十八一斤。',
    season: 'autumn',
    choices: [
      { id: 'accept', label: '接受', hint: '转出 1 头存栏，固定收入 6000 元', effect: { money: 6000, loseAnimals: 1 } },
      { id: 'haggle', label: '还价', hint: '转出 1 头存栏，固定收入 8000 元，口碑 -2', effect: { money: 8000, loseAnimals: 1, reputation: -2 } },
      { id: 'refuse', label: '不卖', hint: '再等等行情', effect: {} },
    ],
  },
  {
    id: 'price-surge',
    title: '活畜涨价',
    body: '邻县办赛马会，活畜价格突然涨了一截。',
    choices: [
      { id: 'sell', label: '趁机出栏', hint: '高价卖掉一头', effect: { money: 4000, loseAnimals: 1 } },
      { id: 'hold', label: '再养养', hint: '赌价格还能涨', effect: {} },
    ],
  },
  {
    id: 'hay-shortage',
    title: '草料断供',
    body: '通往县城的路被雪封了，草料车进不来。',
    season: 'winter',
    choices: [
      { id: 'buy', label: '高价买草', hint: '贵，但能撑过去', effect: { money: -2400, hayKg: 600 } },
      { id: 'borrow', label: '向邻居借', hint: '欠人情', effect: { hayKg: 400, reputation: -4 } },
      { id: 'ration', label: '减料', hint: '省钱，畜群掉膘', effect: { bcsDelta: -0.3 } },
    ],
  },
  {
    id: 'balance-check',
    title: '草畜平衡核查',
    body: '县里来核查载畜量，你的草场已经有点吃紧。',
    choices: [
      { id: 'comply', label: '配合减载', hint: '拿补贴，少养两头', effect: { loseAnimals: 2, reputation: 5, money: 1000 } },
      { id: 'hide', label: '隐瞒', hint: '保留牲畜，本次支付罚款并降低口碑', effect: { reputation: -6, money: -1000, flag: 'fined' } },
    ],
  },
  {
    id: 'neighbour',
    title: '邻居借草',
    body: '隔壁家的草料不够了，想借两百公斤。',
    choices: [
      { id: 'lend', label: '借给他', hint: '攒口碑', effect: { hayKg: -200, reputation: 6 } },
      { id: 'refuse', label: '婉拒', hint: '保住草料，伤和气', effect: { reputation: -2 } },
    ],
  },
  {
    id: 'coop-invite',
    title: '合作社邀请',
    body: '乡里的合作社想拉你入伙，统一采购、统一销售。',
    season: 'autumn',
    choices: [
      { id: 'join', label: '加入', hint: '会费 1500 元，口碑 +8；本局不另加销售收益', effect: { money: -1500, reputation: 8, flag: 'coop' } },
      { id: 'decline', label: '再等等', hint: '保持独立', effect: {} },
    ],
  },
  {
    id: 'vet-visit',
    title: '兽医下乡',
    body: '畜牧站的技术员来了，可以顺便做一次全面检查。',
    season: 'spring',
    choices: [
      { id: 'full', label: '建档检查', hint: '花费 600 元建立检查记录；不替代治疗', effect: { money: -600, flag: 'checked' } },
      { id: 'partial', label: '简略排查', hint: '花费 200 元，模拟中仍有 1 头出现症状', effect: { money: -200, infect: 1 } },
    ],
  },
  {
    id: 'blizzard',
    title: '暴雪封山',
    body: '一夜之间雪没过了小腿，牛群缩在暖棚里不肯出来。',
    season: 'winter',
    choices: [
      { id: 'haul', label: '抢运草料', hint: '花钱出力，保住畜群', effect: { money: -1000, hayKg: 200, bcsDelta: -0.1 } },
      { id: 'save', label: '保人先保畜', hint: '损失几头，换来口碑', effect: { loseAnimals: 3, reputation: 4 } },
      { id: 'endure', label: '硬扛', hint: '损失最大', effect: { loseAnimals: 6, bcsDelta: -0.4 } },
    ],
  },
  {
    id: 'lost-cattle',
    title: '牲畜走失',
    body: '清点时少了两头牛，可能是昨天转场时走散了。',
    choices: [
      { id: 'search', label: '组织寻找', hint: '花费现金与人手，本次不再损失牲畜', effect: { labor: -1, money: -300, flag: 'found' } },
      { id: 'give-up', label: '放弃', hint: '止损', effect: { loseAnimals: 1 } },
    ],
  },
];

// Every event remains resolvable when cash, hay or herd are exhausted.
for (const card of EVENTS) {
  card.choices.push({
    id: 'defer', label: '资源不足，暂缓应对',
    hint: '仅在常规方案都不可执行时开放；体况 -0.2，草场退化 +0.02',
    effect: { bcsDelta: -0.2, degradationDelta: 0.02 },
  });
}

export function eligibleCards(season: Season, used: string[]): EventCard[] {
  const usedSet = new Set(used);
  return EVENTS.filter(
    (card) => !usedSet.has(card.id) && (!card.season || card.season === season),
  );
}

/** Roughly half the weeks bring a card; the rest pass quietly. */
export function drawEvent(season: Season, used: string[], rng: Rng): EventCard | null {
  const pool = eligibleCards(season, used);
  if (pool.length === 0) return null;
  if (!chance(rng, 0.55)) return null;
  return pick(rng, pool);
}

export function findCard(id: string): EventCard | undefined {
  return EVENTS.find((card) => card.id === id);
}
