import { describe, expect, it } from 'vitest';
import { compareWeekPlans, exportWeekExperiment } from '../src/sim/experiment';
import { PLAN_PROFILES } from '../src/sim/planner';
import { createWinterChallenge } from '../src/sim/scenarios';
import { experimentMarkup } from '../src/ui/panels/strategyView';

describe('策略偏好的视觉人格', () => {
  it('保留可用键盘选择的三张卡片，并为每种偏好提供名称、短句与真实权重', () => {
    const state = { ...createWinterChallenge(), actionsLeft: 0 };
    const experiment = compareWeekPlans(state);
    const markup = experimentMarkup(state, experiment);
    const cards = markup.slice(markup.indexOf('<fieldset'), markup.indexOf('</fieldset>'));

    expect(markup).toContain('<fieldset class="experiment-profiles strategy-personas">');
    expect(markup.match(/name="strategy-profile"/g)).toHaveLength(3);
    expect(markup).toMatch(/type="radio" name="strategy-profile" value="balanced" checked/);
    for (const [id, profile] of Object.entries(PLAN_PROFILES)) {
      expect(markup).toContain(`class="strategy-persona strategy-persona--${id}"`);
      expect(markup).toContain(`aria-label="${profile.label}：`);
      expect(markup).toContain(`value="${id}"`);
    }
    expect(cards.match(/class="strategy-persona-icon"/g)).toHaveLength(3);
    expect(markup).toContain('更重视本周净资产');
    expect(markup).not.toContain('先保住现金和存栏');
    expect(markup).toContain('查看四项权重的精确数值');
    expect(markup).toContain('aria-label="饲草覆盖权重 45"');
    expect(markup).toContain('aria-label="草场状态权重 35"');
    expect(markup).toContain('aria-label="净资产评价权重 30"');
    expect(markup).toContain('style="width:45%"');
  });

  it('卡片和结果呈现只读，不改变输入、实验结果或实验单导出内容', () => {
    const state = { ...createWinterChallenge(), actionsLeft: 0 };
    const experiment = compareWeekPlans(state);
    const before = JSON.stringify({ state, experiment });
    const exported = exportWeekExperiment(state, experiment);
    experimentMarkup(state, experiment);
    expect(JSON.stringify({ state, experiment })).toBe(before);
    expect(exportWeekExperiment(state, experiment)).toBe(exported);
  });
});
