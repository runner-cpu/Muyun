import { gameState } from '../../core/GameState';
import { exportWeekExperiment } from '../../sim/experiment';
import type { WeekExperiment } from '../../sim/experiment';
import type { PlanningProfile } from '../../sim/planner';
import { startSimulationJob } from '../../systems/SimulationJob';
import type { SimulationJob } from '../../systems/SimulationJob';
import { MAX_CANDIDATES, PLAN_PROFILES, SEARCH_DEPTH, SEARCH_WIDTH } from '../../sim/planner';
import { ui } from '../instance';
import { escapeHtml } from './shared';
import { experimentMarkup, experimentPlanMarkup, isPlanningProfile } from './strategyView';
import { openTechPanel } from './tech';
import { openReservePanel } from './reserves';

interface StrategyDraft { input: string; experiment: WeekExperiment; profile: PlanningProfile }

export function openStrategyPanel(onBack?: () => void, draft?: StrategyDraft): void {
  const state = gameState.toData().run;
  const input = JSON.stringify(state);
  let cached = draft?.input === input ? draft : undefined;
  let job: SimulationJob<WeekExperiment> | undefined;
  const locked = !state.tech.scanned;
  const root = ui.openModal({
    title: '本周策略试算',
    subtitle: `第 ${state.week} 周 · 同一起点比较偏好，再由你亲自执行。`,
    onClose: () => job?.cancel(),
    body: `
      <div id="strategy-intro"><p class="panel-intro">均衡、护草、保资产，该怎样取舍？对照“不再行动”的结果，查看三种偏好在饲草、退化、体况与资产上的变化。</p>
      <p class="modal-note">免费试算，不改变存档。预估复用游戏的饲喂、生长、休牧与费用规则，不含未来随机天气、事件和疫病结果。</p></div>
      ${locked ? `<div class="decision-notice"><h3>需要先开通草场监测</h3><p>开通消耗 1 行动点、¥800，之后每周维护 ¥30。监测提供各区放牧与休牧预测，并解锁本周策略搜索；已有的草量和基础饲草提醒继续可读。</p><button type="button" class="pixel-btn primary" id="strategy-tech">查看科技与费用</button></div>` : `<div class="decision-run-controls"><button type="button" class="pixel-btn primary" id="strategy-run" ${state.ended ? 'disabled' : ''}>运行三种偏好对照</button><span class="action-hint">${state.ended ? '本局已结束，请在结算中查看同条件对照。' : `可用 ${state.actionsLeft} 个行动点；每种偏好最多搜索 ${SEARCH_DEPTH} 层，允许提前停止。`}</span></div>`}
      <p id="strategy-run-status" class="modal-note" role="status"></p><div id="strategy-output"></div>
      <div class="decision-context-action"><div><h3>把本周方案放回整局目标</h3><p>查看三周库存压力、持续费用与保留存栏下限。本周安全条件不替代局末达标条件。</p></div><button type="button" class="pixel-btn" id="strategy-reserves">查看三周储备账</button></div>
      <details class="decision-method"><summary>查看搜索依据与预测边界</summary>
        <p>每种偏好先选择饲草覆盖且结算后现金大于零的方案，再按本组权重评分。${Object.values(PLAN_PROFILES).map(profile => `${escapeHtml(profile.label)}：${profile.weights.feed}F + ${profile.weights.ecology}E + ${profile.weights.health}H + ${profile.weights.value}V`).join('；')}。不同权重的总分不能直接比较。</p>
        <p>F 为饲草覆盖率，E 为 1 − 平均退化；E 与局末同时考虑草量和退化的生态分不同。H、V 为相对本次试算起点的健康和经营评价，均归一化为 0–1。</p>
        <p>束搜索宽度 ${SEARCH_WIDTH}，每节点最多 ${MAX_CANDIDATES} 个候选，最多 ${SEARCH_DEPTH} 层。至少保留本次试算起点一半羊单位；同一区每周最多放牧或割草一次。局末最高成果另按开局基准检查。</p>
        <p class="modal-note">权重与阈值为游戏设计参数。免疫的未来风险收益不在本周确定性预测中，未被选中不代表免疫没有价值。有限搜索不保证最优；参考方案不是实际牧场经营建议。</p></details>
      ${onBack ? '<div class="modal-actions"><button type="button" class="pixel-btn" id="strategy-back">返回上个面板</button></div>' : ''}`,
  });
  root.querySelector('#strategy-tech')?.addEventListener('click', openTechPanel);
  root.querySelector('#strategy-back')?.addEventListener('click', () => onBack?.());
  root.querySelector('#strategy-reserves')?.addEventListener('click', () => openReservePanel(() => openStrategyPanel(onBack, cached)));
  const renderResult = (experiment: WeekExperiment, profile: PlanningProfile = 'balanced'): void => {
    const output = root.querySelector<HTMLElement>('#strategy-output')!;
    const status = root.querySelector<HTMLElement>('#strategy-run-status')!;
    cached = { input, experiment, profile };
    output.innerHTML = experimentMarkup(state, experiment);
    root.dataset.experimentReady = String(!experiment.lockedReason && Boolean(experiment.baseline));
    const selectPlan = (selected: PlanningProfile): void => {
      const plan = experiment.plans.find(item => item.profile === selected);
      const detail = output.querySelector<HTMLElement>('#strategy-plan');
      if (plan && detail) {
        detail.innerHTML = experimentPlanMarkup(state, plan);
        cached!.profile = selected;
        const radio = output.querySelector<HTMLInputElement>(`input[value="${selected}"]`);
        if (radio) radio.checked = true;
      }
    };
    selectPlan(profile);
    status.textContent = experiment.lockedReason ?? '对照已完成。先比较原始指标，再选择方案查看行动与依据。';
    output.querySelector('fieldset')?.addEventListener('change', event => {
      const selected = (event.target as HTMLInputElement).value;
      if (isPlanningProfile(selected)) selectPlan(selected);
    });
    output.querySelector('#strategy-repeat')?.addEventListener('click', () => root.querySelector<HTMLButtonElement>('#strategy-run')?.click());
    output.querySelector('#strategy-export')?.addEventListener('click', () => {
      const exportStatus = output.querySelector<HTMLElement>('#strategy-export-status')!;
      try {
        const serialized = exportWeekExperiment(gameState.toData().run, experiment);
        const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `muyun-week-${state.seed}-w${state.week}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        exportStatus.textContent = '已发起本周实验单下载。请检查浏览器保存结果；文件为假设预测，实际经营记录仍在局末单独导出。';
      } catch {
        exportStatus.textContent = '未能生成实验单。请确认当前状态未改变，重新试算后再导出，并检查下载权限。';
      }
    });
  };
  root.querySelector<HTMLButtonElement>('#strategy-run')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    const output = root.querySelector<HTMLElement>('#strategy-output')!;
    const status = root.querySelector<HTMLElement>('#strategy-run-status')!;
    root.dataset.experimentReady = 'false';
    button.disabled = true;
    button.textContent = '正在比较三种偏好…';
    output.setAttribute('aria-busy', 'true');
    cached = undefined;
    output.innerHTML = '<button type="button" class="pixel-btn" id="strategy-cancel">取消计算</button>';
    status.textContent = '正在从同一配置计算不行动基线和三组合法方案…';
    job = startSimulationJob('week', state);
    output.querySelector('#strategy-cancel')?.addEventListener('click', () => job?.cancel());
    try {
      const experiment = await job.result;
      if (!root.isConnected) return;
      renderResult(experiment);
      output.querySelector<HTMLElement>('#strategy-result-title')?.focus();
    } catch (error) {
      if (!root.isConnected) return;
      output.innerHTML = `<p class="modal-note" role="status">${escapeHtml(error instanceof Error ? error.message : '本次试算未完成。')} 可以重新运行，或返回经营面板继续安排。</p>`;
      status.textContent = '';
    } finally {
      output.setAttribute('aria-busy', 'false');
      button.textContent = '重新运行三种偏好对照';
      button.disabled = false;
    }
  });
  if (cached) renderResult(cached.experiment, cached.profile);
}
