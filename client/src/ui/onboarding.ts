import { gameState } from '../core/GameState';
import { ui } from './instance';
import { openOverviewPanel } from './panels/overview';
import { pendingEventForRun } from './ranchView';

const SEEN_KEY = 'muyun-onboarding-v1';
let seenThisSession = false;

const STEPS = [
  {
    title: '先看这周需要什么',
    paragraphs: [
      '打开「本周安排」查看饲草、现金和季节使命；再用「三周储备账」核对后续压力。',
      '牧场状态、本周安排、经营工具和周结算，都能点标题收起或展开，把视野留给牧场。',
    ],
  },
  {
    title: '安排一次经营行动',
    paragraphs: [
      '展开「经营工具」，到草场安排放牧，或到畜群照料、集市补草。先查看费用，再决定是否行动。',
      '放牧抵扣本周需草，收草进入库存；每块草场每周只能使用一次，留着不用就是休牧。',
    ],
  },
  {
    title: '结算后，看看变化',
    paragraphs: [
      '安排好后展开「周结算」，核对确认，再阅读现金、干草、存栏和体况的实际变化。剩余行动点不会结转。',
      '用 WASD 或方向键在场景里走动；需要时，在「帮助」里重看引导或查操作。现在先打开概览，看看自己的牧场。',
    ],
  },
] as const;

function ranchIsReady(): boolean {
  return document.getElementById('app')?.dataset.playing === 'true'
    && document.getElementById('hud')?.classList.contains('hidden') === false
    && !ui.isBlocking();
}

function hasSeen(): boolean {
  if (seenThisSession) return true;
  try { return localStorage.getItem(SEEN_KEY) === 'seen'; }
  catch { return false; }
}

function rememberSeen(): void {
  seenThisSession = true;
  try { localStorage.setItem(SEEN_KEY, 'seen'); }
  catch { /* A dismissed guide stays dismissed for this session even without storage. */ }
}

function showStep(index: number): void {
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const root = ui.openModal({
    title: '简易引导',
    subtitle: `${index + 1} / ${STEPS.length} · ${last ? '准备开始经营' : '一步一步认识牧场'}`,
    body: `<section class="onboarding-step" aria-labelledby="onboarding-heading">
      <h3 id="onboarding-heading">${step.title}</h3>
      ${step.paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('')}
    </section>
    <div class="onboarding-actions">
      <button type="button" class="text-btn" id="onboarding-skip">跳过引导</button>
      <div><button type="button" class="pixel-btn" id="onboarding-back" ${index === 0 ? 'disabled' : ''}>上一步</button>
      <button type="button" class="pixel-btn primary" id="onboarding-next">${last ? '打开本周概览' : '下一步'}</button></div>
    </div>`,
    onClose: () => document.getElementById('modal-card')?.classList.remove('onboarding-modal'),
  });
  document.getElementById('modal-card')?.classList.add('onboarding-modal');
  rememberSeen();
  root.querySelector('#onboarding-skip')?.addEventListener('click', () => ui.closeModal());
  root.querySelector('#onboarding-back')?.addEventListener('click', () => {
    if (index > 0) showStep(index - 1);
  });
  root.querySelector('#onboarding-next')?.addEventListener('click', () => {
    if (last) {
      ui.closeModal();
      openOverviewPanel();
    } else showStep(index + 1);
  });
}

/** Called after the ranch and any mandatory resumed event have mounted. */
export function maybeShowOnboarding(): void {
  if (!ranchIsReady() || hasSeen() || gameState.ended || pendingEventForRun(gameState.run)) return;
  showStep(0);
}

/** Manual replay from Help; does not reset the ranch or execute an action. */
export function openOnboarding(): void {
  if (ranchIsReady()) showStep(0);
}
