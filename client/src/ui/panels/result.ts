import { gameState } from '../../core/GameState';
import { comparePolicies } from '../../sim/policies';
import { exportRun } from '../../sim/replay';
import type { RunState, ScenarioId } from '../../sim/types';
import { saveSystem } from '../../systems/SaveSystem';
import { ui } from '../instance';
import { openOverviewPanel } from './overview';
import { assessmentMarkup, comparisonMetricsMarkup, objectiveMarkup, weekHistoryMarkup } from './reviewView';
import { escapeHtml } from './shared';

const ENDINGS: Record<string, [string, string]> = {
  bankrupt: ['资金耗尽', '结算后现金已耗尽。本次复盘可以帮助你比较补草、减载与持续支出的取舍。'],
  collapse: ['生态失衡', '平均草场退化达到本游戏的失衡阈值。回看轮牧和恢复记录，寻找透支发生的周次。'],
  subsistence: ['维持经营', '这次经营结束了。结合三维成果与季末使命，看看下一次可以改善哪项条件。'],
  'well-off': ['经营有余', '经营积累了成果，继续核对草场与畜群是否具备持续经营的条件。'],
  cooperative: ['均衡经营', '经营、生态、动物健康与保留存栏均达到本游戏最高成果条件。'],
};

function comparisonMarkup(state: RunState): string {
  const comparison = comparePolicies(state);
  if (!comparison.available) return `<p class="decision-notice">${escapeHtml(comparison.reason ?? '完成本局后可运行同条件对照。')}</p>`;
  const score = (value: number): string => value.toFixed(0);
  return `<h3 id="comparison-title" tabindex="-1">同条件策略对照</h3>
    <p class="modal-note">同场景、同 seed ${state.seed}，第 ${comparison.fromWeek}–${comparison.toWeek} 周${comparison.provenance === 'continued' ? '续玩记录区间' : '完整记录区间'}。自动策略采用相同的可负担事件规则；搜索策略承担实际设备购置和维护费用。</p>
    <div class="decision-table-wrap" role="region" aria-label="同条件策略对照，可横向滚动" tabindex="0"><table class="data-table decision-comparison-table">
      <caption>模拟结果 · 完成结算、资金存续与最高成果达标分别判断</caption><thead><tr><th scope="col">策略</th><th scope="col">最高成果</th><th scope="col">保留比例（羊单位）</th><th scope="col">经营分</th><th scope="col">生态分</th><th scope="col">健康分</th><th scope="col">净资产</th><th scope="col">存栏</th><th scope="col">平均 BCS</th><th scope="col">退化</th><th scope="col">行动数</th><th scope="col">搜索节点</th><th scope="col">重跑耗时</th></tr></thead>
      <tbody>${comparison.rows.map(row => `<tr ${row.id === 'player' ? 'class="decision-player-row"' : ''}><th scope="row">${escapeHtml(row.label)}${row.failure ? `<span class="decision-comparison-failure">未完成：${escapeHtml(row.failure)}</span>` : ''}</th><td>${row.outcome.goalReached ? '已达标' : row.outcome.completed ? '已结算 · 未达标' : '未完成'}</td><td class="${row.outcome.retainedHalf ? '' : 'danger-text'}">${(row.outcome.retainedShare * 100).toFixed(1)}%${row.outcome.retainedHalf ? '' : ' · 低于50%'}</td><td>${score(row.assessment.economy)}</td><td>${score(row.assessment.ecology)}</td><td>${score(row.assessment.health)}</td>${comparisonMetricsMarkup(row.metrics)}<td>${row.actions}</td><td>${row.expanded}</td><td>${row.elapsedMs.toFixed(1)} ms</td></tr>`).join('')}</tbody></table></div>
    <ul class="decision-comparison-notes">${comparison.notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
    <p class="modal-note">最高成果需同时满足三维评分、保留至少50%起点羊单位与正现金。完成结算或未破产均不等于达标。同 seed 可复现，但不同策略会改变风险状态，动物损失可能不同。对照只报告此模拟内的结果，不证明真实牧场收益、教学效果或搜索总能胜出。</p>`;
}

function restartRun(seed: number | undefined, scenario: ScenarioId): void {
  const settings = { ...gameState.settings };
  saveSystem.clear(scenario);
  gameState.newGame(seed, scenario);
  gameState.setSettings(settings);
  const saved = saveSystem.save(gameState.toData());
  ui.closeModal(true);
  openOverviewPanel();
  if (!saved) ui.toast('新局已经开始，但浏览器未能保存。请检查存储权限。', 'bad', 4000);
}

export function openResultPanel(): void {
  const state = gameState.toData().run;
  const scenario = state.scenario ?? 'year';
  const challenge = scenario === 'winter-challenge-v1';
  const continuation = state.tracking?.provenance === 'continued';
  const ending = state.ending ?? 'subsistence';
  const [title, text] = ENDINGS[ending] ?? ['经营复盘', '查看本次经营的指标与选择。'];
  const logs = state.log.slice(-8);
  const root = ui.openModal({
    title: `${state.ended ? '结局' : '经营复盘'} · ${title}`,
    subtitle: `${challenge ? '四周越冬挑战' : '十三周完整经营'} · seed ${state.seed} · 第 ${state.week} 周`,
    closable: !state.ended,
    body: `
      <p class="decision-ending-copy">${text}</p>
      ${assessmentMarkup(state)}
      <section class="panel-section"><h3>季末使命</h3>${objectiveMarkup(state)}</section>
      <section class="panel-section"><h3>逐周记录</h3>${weekHistoryMarkup(state)}</section>
      <section class="panel-section"><h3>同条件实验与导出</h3><p>从真实记录起点重跑固定贪心与每周搜索策略，和你的实际经营比较。对照只在完局后开放。</p>
        <div class="decision-inline-actions"><button type="button" class="pixel-btn" id="result-compare" ${state.ended ? '' : 'disabled'}>运行同条件对照</button><button type="button" class="pixel-btn" id="result-export" ${state.ended ? '' : 'disabled'}>导出本局 JSON</button></div>
        <p id="result-export-status" class="modal-note" aria-live="polite"></p><div id="result-comparison" aria-live="polite"></div>
      </section>
      <details class="decision-method"><summary>查看最近经营日志</summary><div class="timeline">${logs.length ? logs.map(entry => `<p class="log-${entry.tone === 'bad' ? 'bad' : entry.tone === 'good' ? 'good' : 'info'}">第 ${entry.week} 周 · ${escapeHtml(entry.text)}</p>`).join('') : '<p>没有可显示的经营日志。</p>'}</div></details>
      <div class="modal-actions"><button type="button" class="pixel-btn" id="result-title">返回主菜单</button><button type="button" class="pixel-btn primary" id="result-again">${challenge ? '重新挑战相同条件' : continuation ? '用相同 seed 重开完整局' : '用相同条件再试'}</button>${challenge ? '' : '<button type="button" class="pixel-btn" id="result-new-seed">换一组条件开始完整局</button>'}</div>
      <p class="modal-note decision-restart-note">重开只替换当前${challenge ? '挑战' : '完整经营'}存档，保留另一模式的存档。${challenge ? '挑战固定从第 10 周开始，使用相同给定配置。' : continuation ? '本次为旧档续玩；重开保留 seed，从第 1 周初始配置开始，不会恢复到续玩起点。' : '相同条件会保留本局 seed；换一组条件会创建新的 seed。'}</p>`,
  });
  root.querySelector('#result-again')?.addEventListener('click', () => restartRun(state.seed, scenario));
  root.querySelector('#result-new-seed')?.addEventListener('click', () => restartRun(undefined, 'year'));
  root.querySelector('#result-title')?.addEventListener('click', () => {
    if (!saveSystem.save(gameState.toData())) ui.toast('浏览器未能保存本局，请检查存储权限。', 'bad', 4000);
    ui.closeModal(true);
    ui.onReturnTitle?.();
  });
  root.querySelector<HTMLButtonElement>('#result-compare')?.addEventListener('click', async event => {
    if (!state.ended) return;
    const button = event.currentTarget as HTMLButtonElement;
    const output = root.querySelector<HTMLElement>('#result-comparison')!;
    button.disabled = true;
    button.textContent = '正在重跑两种策略…';
    output.setAttribute('aria-busy', 'true');
    output.innerHTML = '<p class="decision-loading" role="status">正在从同一记录起点重跑模拟，请稍候…</p>';
    await new Promise(resolve => window.setTimeout(resolve, 40));
    if (!root.isConnected) return;
    try {
      output.innerHTML = comparisonMarkup(state);
      output.querySelector<HTMLElement>('#comparison-title')?.focus({ preventScroll: true });
      button.textContent = '对照已完成';
    } catch {
      output.innerHTML = '<p class="danger-text" role="alert">本次对照未完成，可以重试。实际经营记录仍可导出。</p>';
      button.disabled = false;
      button.textContent = '重新运行对照';
    } finally {
      output.setAttribute('aria-busy', 'false');
    }
  });
  root.querySelector('#result-export')?.addEventListener('click', () => {
    if (!state.ended) return;
    const status = root.querySelector<HTMLElement>('#result-export-status')!;
    try {
      const blob = new Blob([exportRun(state)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `muyun-${scenario}-${state.seed}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = '已发起 JSON 下载，包含场景、记录起点、行动轨迹、逐周指标与公式版本。';
    } catch {
      status.textContent = '浏览器未能生成下载文件，请重试或检查下载权限。';
    }
  });
}
