import { gameState } from '../core/GameState';
import { audio } from '../systems/AudioManager';
import { seasonLabel, weekLabel } from '../systems/Calendar';
import { ranchSnapshot, weeklyAlert } from './ranchView';
import { actionLimit } from '../sim/rules';
import { seasonObjectives } from '../sim/objectives';

export function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function renderHud(): void {
  const snapshot = ranchSnapshot(gameState.run);
  const number = (n: number): string => Math.ceil(n).toLocaleString('zh-CN');
  setText('hud-week', weekLabel(gameState.week));
  setText('hud-season', seasonLabel(gameState.season));
  setText('hud-weather', snapshot.weatherLabel);
  setText('hud-money', number(gameState.money));
  setText('hud-hay', number(gameState.hayKg));
  setText('hud-reputation', String(gameState.reputation));
  setText('hud-actions', String(gameState.actionsLeft));
  setText('hud-action-limit', String(actionLimit(gameState.run)));
  const objective = seasonObjectives(gameState.run).find(item => item.season === gameState.season);
  setText('hud-objective', objective ? `${objective.title} · ${objective.current}` : '先安排放牧，再补足饲草。');
  setText('hud-herd', String(snapshot.aliveCount));
  setText('hint-text', snapshot.hint);
  setText('hud-feed-need', number(snapshot.feedRequiredHayKg));
  setText('hud-feed-status', snapshot.feedGapKg > 0 ? `还缺 ${number(snapshot.feedGapKg)} kg，建议先放牧或补草` : '现有储备足够本周饲喂');
  document.getElementById('hud-feed-status')?.classList.toggle('bad', snapshot.feedGapKg > 0);
  const alert = weeklyAlert(gameState.run);
  setText('hud-risk-text', alert.text);
  const riskButton = document.getElementById('btn-overview-risk');
  if (riskButton) riskButton.dataset.tone = alert.tone;
  const track = document.getElementById('week-track');
  const startWeek = gameState.run.scenario === 'winter-challenge-v1' ? 10 : 1;
  if (track) track.innerHTML = Array.from({ length: 14 - startWeek }, (_, i) => { const week = i + startWeek; return `<i class="${week < gameState.week || gameState.ended ? 'passed' : week === gameState.week ? 'current' : ''}"></i>`; }).join('');
  setText('btn-end-week', gameState.ended ? '查看结算' : '结束本周');
  audio.setSeason(gameState.season);
}
