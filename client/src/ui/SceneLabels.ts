import type Phaser from 'phaser';
import type { TriggerDef } from '../types';
import type { RunState } from '../sim/types';
import { pastureUse } from '../sim/rules';
import './styles/scene-labels.css';

interface Rect { x: number; y: number; width: number; height: number }
interface Label { trigger: TriggerDef; button: HTMLButtonElement; width: number; height: number }

/** Project world coordinates through the visible camera, including canvas letterboxing. */
export function projectSceneLabel(world: { x: number; y: number }, view: Rect, canvas: Rect): { x: number; y: number } {
  return {
    x: canvas.x + (world.x - view.x) / view.width * canvas.width,
    y: canvas.y + (world.y - view.y) / view.height * canvas.height,
  };
}

export function rectanglesOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width > b.x - gap
    && a.y < b.y + b.height + gap && a.y + a.height > b.y - gap;
}

/** DOM labels remain readable while pixel art is scaled by the camera and browser. */
export class SceneLabels {
  private root = document.createElement('div');
  private labels: Label[] = [];
  private observer: ResizeObserver;
  private geometryDirty = true;
  private canvasBounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private obstructions: Rect[] = [];

  constructor(
    private scene: Phaser.Scene,
    triggers: TriggerDef[],
    private blocked: () => boolean,
    select: (trigger: TriggerDef) => void,
  ) {
    this.root.className = 'scene-label-layer';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', '牧场场景地点');
    document.getElementById('app')!.appendChild(this.root);

    for (const trigger of triggers) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scene-label';
      button.tabIndex = -1; // The four persistent navigation controls are the keyboard path.
      button.textContent = trigger.kind === 'pasture' ? `草场 ${trigger.payload}`
        : { herd: '畜群', market: '集市', tech: '科技' }[trigger.kind] ?? trigger.label;
      button.setAttribute('aria-label', trigger.label);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!this.blocked()) select(trigger);
      });
      this.root.appendChild(button);
      this.labels.push({ trigger, button, width: 0, height: 0 });
    }

    this.observer = new ResizeObserver(this.invalidateGeometry);
    this.observer.observe(this.root.parentElement!);
    this.observer.observe(scene.game.canvas);
    scene.scale.on('resize', this.invalidateGeometry);
    // Camera follow and zoom have been applied by the time this event fires.
    scene.events.on('render', this.render);
  }

  private invalidateGeometry = (): void => { this.geometryDirty = true; };

  /** DOM text exposes the exact values behind the pasture's density and bare patches. */
  updateState(state: RunState): void {
    let changed = false;
    for (const { trigger, button } of this.labels) {
      if (trigger.kind !== 'pasture') continue;
      const cell = state.pasture.find(item => item.id === trigger.payload);
      if (!cell) continue;
      const use = pastureUse(state, cell);
      const useLabel = { grazed: '已放牧', cut: '已割草', resting: '休牧中' }[use];
      const biomass = Math.round(cell.biomassKgPerHa);
      const degradation = Math.round(cell.degradation * 100);
      const summary = `${cell.id} · ${useLabel} ${biomass} kg/ha · 退化 ${degradation}%`;
      if (button.dataset.summary === summary) continue;
      button.dataset.summary = summary;
      button.dataset.use = use;
      const name = document.createElement('span');
      name.className = 'scene-label-name';
      name.textContent = `${cell.id} `;
      const status = document.createElement('span');
      status.textContent = `· ${useLabel}`;
      name.append(status);
      const detail = document.createElement('span');
      detail.className = 'scene-label-detail';
      detail.textContent = `${biomass} kg/ha `;
      const condition = document.createElement('span');
      condition.textContent = `· 退化 ${degradation}%`;
      detail.append(condition);
      button.replaceChildren(name, detail);
      button.setAttribute('aria-label', `草场 ${cell.id}，本周${useLabel}，草量 ${biomass} 千克每公顷，退化率 ${degradation}%。点击查看经营方案。`);
      changed = true;
    }
    if (changed) this.invalidateGeometry();
  }

  private measure(): void {
    const app = this.root.parentElement!.getBoundingClientRect();
    const canvas = this.scene.game.canvas.getBoundingClientRect();
    this.canvasBounds = { x: canvas.left - app.left, y: canvas.top - app.top, width: canvas.width, height: canvas.height };
    this.obstructions = [];
    document.querySelectorAll<HTMLElement>('.hud-bar, .week-note, .ranch-nav, .week-advance, .joystick, .interact-btn, .hud-risk')
      .forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width && rect.height) this.obstructions.push({ x: rect.left - app.left, y: rect.top - app.top, width: rect.width, height: rect.height });
      });
    this.labels.forEach((label) => {
      label.width = label.button.offsetWidth;
      label.height = label.button.offsetHeight;
    });
    this.geometryDirty = false;
  }

  private render = (): void => {
    const blocked = this.blocked();
    if (this.root.hidden !== blocked) {
      this.root.hidden = blocked;
      this.root.inert = blocked;
      this.geometryDirty = true;
    }
    if (blocked) return;
    if (this.geometryDirty) this.measure();

    const camera = this.scene.cameras.main;
    const view = camera.worldView;
    if (!view.width || !view.height) return;
    // Use the camera's viewport, rather than assuming it fills a CSS-sized canvas.
    const gameSize = this.scene.scale.gameSize;
    const canvas = {
      x: this.canvasBounds.x + camera.x / gameSize.width * this.canvasBounds.width,
      y: this.canvasBounds.y + camera.y / gameSize.height * this.canvasBounds.height,
      width: camera.width / gameSize.width * this.canvasBounds.width,
      height: camera.height / gameSize.height * this.canvasBounds.height,
    };
    for (const label of this.labels) {
      const anchor = projectSceneLabel({ x: label.trigger.x, y: label.trigger.y - 13 }, view, canvas);
      const box = { x: anchor.x - label.width / 2, y: anchor.y - label.height, width: label.width, height: label.height };
      const inside = box.x >= canvas.x + 8 && box.y >= canvas.y + 8
        && box.x + box.width <= canvas.x + canvas.width - 8
        && box.y + box.height <= canvas.y + canvas.height - 8;
      const visible = inside && !this.obstructions.some((obstruction) => rectanglesOverlap(box, obstruction, 8));
      label.button.classList.toggle('is-visible', visible);
      label.button.disabled = !visible;
      if (visible) {
        label.button.style.left = `${Math.round(anchor.x)}px`;
        label.button.style.top = `${Math.round(anchor.y)}px`;
      }
    }
  };

  destroy(): void {
    this.observer.disconnect();
    this.scene.scale.off('resize', this.invalidateGeometry);
    this.scene.events.off('render', this.render);
    this.root.remove();
    this.labels = [];
  }
}
