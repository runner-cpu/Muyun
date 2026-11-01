import { describe, expect, it } from 'vitest';
import { assessRun } from '../src/sim/assessment';
import { ensureTracking, recordWeek } from '../src/sim/history';
import { applyAction, createRun, endWeek } from '../src/sim/run';
import { createWinterChallenge } from '../src/sim/scenarios';
import { actionDescription, assessmentMarkup, baselineDescription, currentWeekMarkup, objectiveMarkup, weekHistoryMarkup } from '../src/ui/panels/reviewView';

describe('决策复盘视图', () => {
  it('current-week disclosure reads real actions, clears after settlement and never fabricates tasks', () => {
    let state = createRun(105);
    expect(currentWeekMarkup(state)).toContain('本周已记录 0 次经营');
    expect(currentWeekMarkup(state)).toContain('查看面板或运行试算都不算实际行动');
    state = applyAction(state, { kind: 'graze', cellId: 'P1' });
    state = applyAction(state, { kind: 'buy-hay', kg: 100 });
    const before = JSON.stringify(state);
    const html = currentWeekMarkup(state);
    expect(html).toContain('本周已记录 2 次经营 · 剩余 1 行动');
    expect(html.indexOf('P1 区放牧')).toBeLessThan(html.indexOf('购买 100 kg'));
    expect(html).toContain('P2、P3、P4 尚未利用');
    expect(html).not.toContain('id="overview-current-actions" open');
    expect(JSON.stringify(state)).toBe(before);
    expect(currentWeekMarkup(endWeek(state))).toContain('本周已记录 0 次经营');
  });

  it('current records escape imported text and explain continuation boundaries', () => {
    const state = ensureTracking({ ...createRun(55), tracking: undefined }, 'continued');
    state.animals[0].tag = '<img src=x>';
    state.tracking!.pending = [{ kind: 'action', action: { kind: 'sell', animalIds: [state.animals[0].id] } }];
    const html = currentWeekMarkup(state);
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img');
    expect(html).toContain('不补造此前选择');
  });

  it('展示真实三维指标，并区分游戏评分和持续经营条件', () => {
    const state = createWinterChallenge();
    const result = assessRun(state);
    const html = assessmentMarkup(state);
    expect(html).toContain(`${result.economy.toFixed(0)}</td>`);
    expect(html).toContain(`${result.ecology.toFixed(0)}</td>`);
    expect(html).toContain(`${result.health.toFixed(0)}</td>`);
    expect(html).toContain('游戏设计评分');
    expect(html).toContain('不是农牧行业标准');
    expect(html).toContain('第 10 周挑战给定配置');
    expect(html).toContain('tabindex="0"');
  });

  it('缺少历史时不伪造增长、死亡或综合成果', () => {
    const state = { ...createRun(77), tracking: undefined };
    const html = assessmentMarkup(state);
    expect(html).toContain('缺少可靠增长基准');
    expect(html).toContain('不补造历史增长');
    expect(html).toContain('记录内已知死亡</dt><dd>未记录');
    expect(html).not.toContain('综合成果 <strong>');
    expect(html).not.toContain('已满足最高成果');
  });

  it('挑战只展示冬季使命，不补造前三季轨迹', () => {
    const state = createWinterChallenge();
    const html = objectiveMarkup(state);
    expect(html).toContain('冬季使命');
    expect(html).not.toContain('春季使命');
    expect(html).not.toContain('夏季使命');
    expect(html).not.toContain('秋季使命');
    expect(weekHistoryMarkup(state)).toContain('尚无已结算周记录');
  });

  it('只显示当前季节使命，并明确旧档的续玩起点', () => {
    const raw = { ...createRun(93), week: 7, season: 'autumn' as const, tracking: undefined };
    const state = ensureTracking(raw, 'continued');
    expect(objectiveMarkup(state, true)).toContain('秋季使命');
    expect(objectiveMarkup(state, true)).not.toContain('春季使命');
    expect(baselineDescription(state)).toContain('第 7 周的本次续玩起点');
  });

  it('逐周记录保留全部真实选择并转义动态内容', () => {
    const before = createRun(105);
    before.animals[0].tag = '<img src=x onerror=alert(1)>';
    before.tracking!.pending = [
      { kind: 'action', action: { kind: 'sell', animalIds: [before.animals[0].id] } },
      { kind: 'event', cardId: '<script>bad</script>', choiceId: '"选择"' },
    ];
    const state = recordWeek(before, { ...before, money: before.money + 500 });
    const snapshot = JSON.stringify(state);
    const html = weekHistoryMarkup(state);
    expect(html).toContain('第 1–1 周已结算轨迹');
    expect(html).toContain('2 项选择');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('aria-label="逐周经营记录，可横向滚动"');
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('行动描述保留对象与数量，不用分数替代可执行步骤', () => {
    const state = createRun(302);
    expect(actionDescription(state, { kind: 'graze', cellId: 'P2' })).toBe('P2 区放牧');
    expect(actionDescription(state, { kind: 'buy-hay', kg: 1200 })).toBe('购买 1,200 kg 干草');
    expect(actionDescription(state, { kind: 'sell', animalIds: [state.animals[0].id] })).toContain(state.animals[0].tag);
  });
});
