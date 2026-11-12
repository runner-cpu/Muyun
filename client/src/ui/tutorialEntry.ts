import { gameState } from '../core/GameState';
import { ui } from './instance';
import { offerTutorialOnce } from './tutorialPreferences';

let opening = false;

/** The practice controller and view are loaded only after an explicit choice. */
export function launchTutorial(): void {
  if (opening || ui.isBlocking()) return;
  opening = true;
  void import('./tutorial').then(({ openTutorialWeek }) => {
    if (!ui.isBlocking()) openTutorialWeek();
  }).catch(() => ui.toast('教学周未能打开，请稍后再试。', 'bad'))
    .finally(() => { opening = false; });
}

/** A dismissible invitation; no focus stealing, modal, formal action or save write. */
export function mountTutorialInvitation(): () => void {
  const host = document.getElementById('tutorial-invitation');
  if (!host || gameState.run.scenario === 'winter-challenge-v1' || gameState.ended
    || ui.isBlocking() || !offerTutorialOnce()) return () => undefined;
  host.classList.remove('hidden');
  const start = host.querySelector('#tutorial-invitation-start');
  const skip = host.querySelector('#tutorial-invitation-skip');
  const dismiss = (): void => host.classList.add('hidden');
  const begin = (): void => { dismiss(); launchTutorial(); };
  start?.addEventListener('click', begin);
  skip?.addEventListener('click', dismiss);
  return () => {
    dismiss();
    start?.removeEventListener('click', begin);
    skip?.removeEventListener('click', dismiss);
  };
}
