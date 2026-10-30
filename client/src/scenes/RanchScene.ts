import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE, TILE, WORLD_TILES_H, WORLD_TILES_W } from '../config';
import { gameState } from '../core/GameState';
import { bus } from '../core/emitter';
import { Player } from '../entities/Player';
import { HerdSprite } from '../entities/Animal';
import { InputManager } from '../systems/InputManager';
import { InteractionSystem } from '../systems/InteractionSystem';
import { RanchInteractionController } from '../systems/RanchInteractionController';
import { tintForSeason } from '../systems/Calendar';
import { audio } from '../systems/AudioManager';
import { endWeekFlow, resumePendingWeek } from '../systems/WeekFlow';
import { bindRanchNavigation } from '../ui/RanchNavigation';
import { SceneLabels } from '../ui/SceneLabels';
import { RanchWorld } from '../world/RanchWorld';
import { sampleSceneAnimals } from '../world/sceneState';
import { openAnimalDetail } from '../ui/panels/animalDetail';
import { ui } from '../ui/instance';
import type { TriggerDef } from '../types';

export class RanchScene extends Phaser.Scene {
  private player!: Player;
  private controls!: InputManager;
  private interactions!: InteractionSystem;
  private controller!: RanchInteractionController;
  private wash!: Phaser.GameObjects.Rectangle;
  private snow!: Phaser.GameObjects.Particles.ParticleEmitter;
  private world!: RanchWorld;
  private labels!: SceneLabels;
  private herdSprites = new Map<string, { entity: HerdSprite; slot: number; kind: 'yak' | 'sheep' }>();
  private herdSignature = '';
  private unsubscribes: Array<() => void> = [];

  constructor() { super('RanchScene'); }

  create(): void {
    const worldW = WORLD_TILES_W * TILE;
    const worldH = WORLD_TILES_H * TILE;

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.setBackgroundColor('#1b3a5c');

    this.world = new RanchWorld(this);
    const { ground } = this.world.build(gameState.season);
    this.world.syncPasture(gameState.run);
    this.syncHerd();

    const spawn = gameState.getSpawn();
    this.player = new Player(this, spawn.x, spawn.y);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.physics.add.collider(this.player.sprite, ground);
    this.world.buildStructures(this.player.sprite);

    this.controller = new RanchInteractionController(this);
    this.interactions = new InteractionSystem(
      (trigger) => {
        if (trigger) ui.showPrompt(trigger.label);
        else ui.hidePrompt();
      },
      (trigger) => { void this.controller.handle(trigger); },
    );
    const triggers = this.buildTriggers();
    this.interactions.setTriggers(triggers);
    this.labels = new SceneLabels(this, triggers, () => ui.isBlocking(), (trigger) => {
      void this.controller.handle(trigger);
    });

    this.controls = new InputManager(this);

    const fixed = this.fixedEffectOrigin();
    this.wash = this.add.rectangle(fixed.x, fixed.y, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);
    this.buildSnow();
    this.buildVignette();

    this.unsubscribes.push(bus.on('state:changed', () => {
      this.applySeasonWash();
      this.syncHerd();
      this.world.syncPasture(gameState.run);
      this.labels.updateState(gameState.run);
    }));
    this.unsubscribes.push(bindRanchNavigation());
    this.unsubscribes.push(bus.on('calendar:changed', () => {
      this.applySeasonWash();
      this.world.applySeasonArt(gameState.season);
      this.updateSnow();
    }));

    ui.showHud();
    ui.onEndWeek = endWeekFlow;
    audio.setSeason(gameState.season);
    this.applySeasonWash();
    this.world.applySeasonArt(gameState.season);
    this.labels.updateState(gameState.run);
    this.updateSnow();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    resumePendingWeek();
  }

  update(): void {
    const blocked = ui.isBlocking();
    this.interactions.setEnabled(!blocked);
    this.controls.setEnabled(!blocked);

    if (blocked) {
      this.player.stop();
    } else {
      this.player.update(this.controls.getVector());
      this.interactions.update(this.player.x, this.player.y);
      if (this.controls.consumeInteract()) this.interactions.interact();
    }

    gameState.setPlayer(this.player.x, this.player.y);
  }

  private teardown(): void {
    for (const off of this.unsubscribes) off();
    this.unsubscribes = [];
    this.controls.destroy();
    this.labels.destroy();
    this.clearHerd();
    this.herdSignature = '';
    ui.onEndWeek = null;
    ui.hidePrompt();
    ui.hideHud();
  }

  private applySeasonWash(): void {
    const tint = tintForSeason(gameState.season);
    this.wash.setFillStyle(tint.color, tint.alpha);
  }

  private updateSnow(): void {
    if (this.snow) this.snow.emitting = gameState.season === 'winter'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Keep fixed effects aligned when the internal render viewport is larger than world units. */
  private fixedEffectOrigin(): { x: number; y: number } {
    return { x: (this.cameras.main.width - GAME_WIDTH) / 2, y: (this.cameras.main.height - GAME_HEIGHT) / 2 };
  }

  /** A light edge shade preserves daylight and readable animal silhouettes. */
  private buildVignette(): void {
    const key = 'ranch-vignette-v2';
    if (!this.textures.exists(key)) {
      const canvas = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
      if (!canvas) return;
      const ctx = canvas.getContext();
      const gradient = ctx.createRadialGradient(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, 70,
        GAME_WIDTH / 2, GAME_HEIGHT / 2, 300,
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(8,12,18,0.18)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      canvas.refresh();
    }
    const fixed = this.fixedEffectOrigin();
    this.add.image(fixed.x, fixed.y, key).setOrigin(0, 0).setScrollFactor(0).setDepth(860);
  }

  /** Every representative is a real record; stable slots keep surviving individuals in place. */
  private syncHerd(): void {
    const sampled = sampleSceneAnimals(gameState.animals);
    const signature = sampled.map(animal => `${animal.id}:${animal.health}:${animal.bcs}:${animal.collar}`).join('|');
    if (signature === this.herdSignature) return;
    this.herdSignature = signature;
    const selected = new Set(sampled.map(animal => animal.id));
    for (const [id, entry] of this.herdSprites) {
      if (!selected.has(id)) {
        entry.entity.sprite.destroy();
        this.herdSprites.delete(id);
      }
    }
    for (const animal of sampled) {
      const existing = this.herdSprites.get(animal.id);
      if (existing) { existing.entity.updateAnimal(animal); continue; }
      const occupied = new Set([...this.herdSprites.values()].filter(entry => entry.kind === animal.species).map(entry => entry.slot));
      let slot = 0;
      while (occupied.has(slot)) slot++;
      const index = Math.floor(slot / 2);
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = (animal.species === 'yak' ? 80 : 448) + column * 53;
      // Keep representatives near the crossroads so their health feedback is visible on arrival.
      const y = slot % 2 === 0 ? 317 + row * 32 : 151 - row * 19;
      const entity = new HerdSprite(this, x, y, animal, (id) => {
        if (!ui.isBlocking()) openAnimalDetail(id);
      });
      this.herdSprites.set(animal.id, { entity, slot, kind: animal.species });
    }
  }

  private clearHerd(): void {
    for (const { entity } of this.herdSprites.values()) entity.sprite.destroy();
    this.herdSprites.clear();
  }

  private buildSnow(): void {
    if (!this.textures.exists('snowflake')) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.9).fillRect(0, 0, 2, 2);
      g.generateTexture('snowflake', 2, 2);
      g.destroy();
    }
    const fixed = this.fixedEffectOrigin();
    this.snow = this.add.particles(fixed.x, fixed.y, 'snowflake', {
      x: { min: 0, max: GAME_WIDTH },
      y: -8,
      lifespan: 4200,
      speedY: { min: 18, max: 46 },
      speedX: { min: -12, max: 12 },
      scale: { min: 0.5, max: 1.1 },
      alpha: { start: 0.9, end: 0.2 },
      frequency: 90,
      quantity: 1,
    });
    this.snow.setScrollFactor(0).setDepth(800);
    this.snow.emitting = false;
  }

  private buildTriggers(): TriggerDef[] {
    return [
      { id: 'herd', kind: 'herd', payload: '', label: '查看畜群', radius: 40, x: 328, y: 152 },
      { id: 'pasture-a', kind: 'pasture', payload: 'P1', label: '草场 P1 区', radius: 40, x: 136, y: 120 },
      { id: 'pasture-b', kind: 'pasture', payload: 'P2', label: '草场 P2 区', radius: 40, x: 520, y: 120 },
      { id: 'pasture-c', kind: 'pasture', payload: 'P3', label: '草场 P3 区', radius: 40, x: 136, y: 360 },
      { id: 'pasture-d', kind: 'pasture', payload: 'P4', label: '草场 P4 区', radius: 40, x: 520, y: 360 },
      { id: 'market', kind: 'market', payload: '', label: '去集市', radius: 44, x: 264, y: 104 },
      { id: 'tech', kind: 'tech', payload: '', label: '科技服务', radius: 44, x: 328, y: 456 },
    ];
  }
}
