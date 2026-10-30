import type { Action, RunState } from '../../sim/types';
import { actionStatus } from './panelActions';

export function yuan(value: number): string {
  return `¥${Math.round(value).toLocaleString('zh-CN')}`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function meter(value: number, max: number, tone = ''): string {
  const width = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return `<span class="meter ${tone}"><i style="width:${width}%"></i></span>`;
}

export function statRow(items: Array<[string | number, string]>): string {
  return `<div class="stat-row">${items
    .map(([value, label]) => `<div><b>${value}</b><span>${label}</span></div>`)
    .join('')}</div>`;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function actionControl(state: RunState, action: Action, label: string, attributes: string, detail?: string): string {
  const { cost, reason } = actionStatus(state, action);
  const hint = detail ?? `1 行动点，${cost > 0 ? `费用 ${yuan(cost)}` : '不花现金'}`;
  return `<div class="action-control">
    <button type="button" class="pixel-btn tiny" ${attributes} ${reason ? 'disabled' : ''}>${escapeHtml(label)}</button>
    <span class="action-hint">${escapeHtml(hint)}</span>
    ${reason ? `<span class="action-hint" data-blocked="true">${escapeHtml(reason)}</span>` : ''}
  </div>`;
}

export function panelStatus(state: RunState): string {
  return `<p class="panel-intro">第 ${state.week} 周，剩余 <strong>${state.actionsLeft} 个行动点</strong>。每次有效经营操作消耗 1 点，结束本周后恢复。</p>`;
}
