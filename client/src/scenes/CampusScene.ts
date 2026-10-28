import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { gameState } from '../core/GameState';
import { saveSystem } from '../systems/SaveSystem';
import { audio } from '../systems/AudioManager';
import { TimeSystem, tintFor, phaseFor } from '../systems/TimeSystem';
import { InputManager } from '../systems/InputManager';
import { InteractionSystem } from '../systems/InteractionSystem';
import { DialogueSystem } from '../systems/DialogueSystem';
import { InteractionController } from '../systems/InteractionController';
import { buildCampusMap, type CampusMap } from '../world/CampusMap';
import { createBuildings } from '../world/Buildings';
import { createTrees, type TreeDef } from '../world/Trees';
import { Player } from '../entities/Player';
import { Npc } from '../entities/Npc';
import { Cat, registerCatAnims } from '../entities/Cat';
import { PetBattleUI } from '../minigames/PetBattleUI';
import { HideSeekGame } from '../minigames/HideSeekGame';
import { ui } from '../ui/instance';
import type { BuildingDef, CatDef, HideSpot, TriggerDef } from '../types';
import catsData from '../data/cats.json';
import hidespotsData from '../data/hidespots.json';
import buildingsData from '../data/buildings.json';
import treesData from '../data/trees.json';

const cats = catsData as CatDef[];
const hideSpots = hidespotsData as HideSpot[];
const buildings = buildingsData as BuildingDef[];
const trees = treesData as TreeDef[];
const TILE = 16;

export class CampusScene extends Phaser.Scene {
  private mapData!: CampusMap;
  private player!: Player;
  private inputManager!: InputManager;
  private interactions!: InteractionSystem;
  private dialogue!: DialogueSystem;
  private timeSystem!: TimeSystem;
  private battle!: PetBattleUI;
  private hideSeek!: HideSeekGame;
  private controller!: InteractionController;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private markers = new Map<string, Phaser.GameObjects.Triangle>();
  private buildingLabels: Phaser.GameObjects.Text[] = [];
  private hideMarkers: Phaser.GameObjects.Text[] = [];
  private hideTriggers: TriggerDef[] = [];
  private lampGlows: Phaser.GameObjects.Arc[] = [];
  private lastPhase = '';
  private lastHudMinute = -1;

  constructor() { super('CampusScene'); }

  create(): void {
    this.mapData = buildCampusMap(this);
    registerCatAnims(this);
    createBuildings(this, buildings);
    createTrees(this, trees);
    this.physics.world.setBounds(0, 0, this.mapData.width, this.mapData.height);
    this.cameras.main.setBounds(0, 0, this.mapData.width, this.mapData.height).setRoundPixels(true);

    const spawn = gameState.getSpawn();
    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player.sprite, this.mapData.collision);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.fadeIn(420, 16, 23, 38);

    this.spawnNpcs();
    this.spawnCats();
    this.createMarkers();
    this.createBuildingLabels();
    this.createLamps();
    this.createNightOverlay();

    this.timeSystem = new TimeSystem(gameState);
    this.dialogue = new DialogueSystem(ui.dialogue);
    this.battle = new PetBattleUI(ui);
    this.hideSeek = new HideSeekGame(ui, hideSpots, (active) => this.setHideSeekActive(active));
    this.controller = new InteractionController(ui, {
      time: this.timeSystem,
      dialogue: this.dialogue,
      battle: this.battle,
      hideSeek: this.hideSeek,
      persist: () => this.persist(),
      refreshLights: () => this.updateLighting(true),
      sleep: () => this.sleep(),
    });
    this.interactions = new InteractionSystem(
      (trigger) => {
        if (trigger) ui.showPrompt(trigger.label);
        else ui.hidePrompt();
      },
      (trigger) => this.controller.handle(trigger),
    );
    this.interactions.setTriggers(this.mapData.triggers);
    this.inputManager = new InputManager(this);

    ui.showHud();
    ui.updateHud();
    this.timeSystem.emit();
    this.updateLighting(true);
    this.persist();
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.persist() });
    this.time.delayedCall(650, () => {
      ui.toast('WASD / 摇杆移动 · 靠近黄色标记按 E 互动', 'gold', 3600);
    });
    this.time.delayedCall(1600, () => ui.toast('先找一栋院系教学楼上课，拿今天的第一笔学分', '', 2600));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputManager?.destroy();
    });
  }

  update(_time: number, delta: number): void {
    const blocked = ui.isBlocking();
    this.inputManager.setEnabled(!blocked);
    this.interactions.setEnabled(!blocked);
    this.timeSystem.paused = blocked;

    if (blocked) {
      this.player.stop();
      this.updateMarkers();
      return;
    }

    const vector = this.inputManager.getVector();
    this.player.update(vector);
    this.interactions.update(this.player.x, this.player.y);
    if (this.inputManager.consumeInteract()) this.interactions.interact();

    this.timeSystem.update(delta);
    if (this.hideSeek.isActive()) this.hideSeek.update(delta, this.player.x, this.player.y);
    this.updateMarkers();
    this.updateLabels();
    this.updateLighting();
    gameState.setPlayer(this.player.x, this.player.y);

    const minute = gameState.timeMinutes;
    if (minute !== this.lastHudMinute) {
      this.lastHudMinute = minute;
      this.updateLightsForPhase();
    }
  }

  teleport(x: number, y: number): void {
    this.player.setPosition(x, y);
    gameState.setPlayer(x, y);
  }

  triggerById(id: string): void {
    const trigger = this.mapData.triggers.find((t) => t.id === id);
    if (trigger) this.controller.handle(trigger);
  }

  private spawnNpcs(): void {
    const npcs: Array<[string, string, number]> = [
      ['guard', '保安大爷', 0x9fb4ff],
      ['auntie', '食堂阿姨', 0xffb0b0],
      ['librarian', '图书管理员', 0xc9b0ff],
      ['catclub', '猫协同学 小满', 0xb0ffd0],
      ['trainer', '神秘训练师', 0xffd27f],
    ];
    for (const [triggerId, name, tint] of npcs) {
      const point = this.mapData.triggers.find((t) => t.id === triggerId);
      if (point) new Npc(this, point.x, point.y, name, tint);
    }
  }

  private spawnCats(): void {
    for (const cat of cats) {
      const trigger = this.mapData.triggers.find((t) => t.kind === 'cat' && t.payload === cat.id);
      if (trigger) new Cat(this, trigger.x, trigger.y + 4, cat);
    }
  }

  private createMarkers(): void {
    for (const trigger of this.mapData.triggers) {
      const marker = this.add.triangle(trigger.x, trigger.y - 18, 0, 0, 7, 0, 3.5, 7, 0xf2c14e)
        .setDepth(22)
        .setVisible(false)
        .setInteractive(new Phaser.Geom.Circle(3.5, 3.5, 14), Phaser.Geom.Circle.Contains);
      marker.on('pointerdown', () => this.tryTap(trigger));
      this.markers.set(trigger.id, marker);
    }
  }

  private createBuildingLabels(): void {
    const labels: Array<[string, number, number]> = [
      ['北门', 71, 4], ['明博楼', 102, 9], ['学生公寓', 122, 12],
      ['学生食堂', 144, 23], ['学生活动中心', 28, 23], ['公园', 12, 19],
      ['综合体育中心', 14, 53], ['西田径场', 36, 43], ['东田径场', 86, 43],
      ['图书馆', 34, 67], ['睿智楼', 117, 47], ['雨化楼', 120, 67],
      ['镂金楼', 120, 79], ['尚真楼', 64, 77], ['鼎新馆', 82, 69],
      ['融馨楼', 82, 83], ['逸夫楼', 103, 83], ['静远楼', 19, 85],
      ['求实楼', 14, 97], ['机械学院', 32, 99], ['圣汇楼', 61, 99],
      ['东门', 152, 61], ['南门', 94, 117], ['西门', 4, 71],
    ];
    for (const [text, tx, ty] of labels) {
      const label = this.add.text(tx * TILE + 8, ty * TILE + 8, text, {
        fontFamily: '"Microsoft YaHei", "PingFang SC", monospace',
        fontSize: '10px', color: '#f4ecd8', stroke: '#101726', strokeThickness: 3,
      }).setOrigin(0.5).setResolution(2).setDepth(20);
      label.setData('tx', tx);
      label.setData('ty', ty);
      this.buildingLabels.push(label);
    }
  }

  private createLamps(): void {
    this.mapData.props.forEachTile((tile) => {
      if (tile.index !== 24) return;
      const x = tile.pixelX + 8;
      const y = tile.pixelY + 8;
      const glow = this.add.circle(x, y, 28, 0xffd27f, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(6);
      this.lampGlows.push(glow);
    });
  }

  private createNightOverlay(): void {
    this.nightOverlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x111a3a, 0)
      .setOrigin(0).setScrollFactor(0).setDepth(50);
  }

  private updateLighting(force = false): void {
    const { color, alpha } = tintFor(gameState.timeMinutes);
    this.nightOverlay.setFillStyle(color, alpha);
    const phase = phaseFor(gameState.timeMinutes);
    if (force || phase !== this.lastPhase) {
      this.lastPhase = phase;
      audio.setPhase(phase);
      this.updateLightsForPhase();
    }
  }

  private updateLightsForPhase(): void {
    const phase = phaseFor(gameState.timeMinutes);
    const off = gameState.hasFlag('lights_off');
    const alpha = off ? 0 : phase === 'night' ? 0.32 : phase === 'dusk' ? 0.14 : phase === 'dawn' ? 0.06 : 0;
    for (const glow of this.lampGlows) glow.setAlpha(alpha);
  }

  private updateMarkers(): void {
    const now = this.time.now;
    for (const trigger of this.mapData.triggers) {
      const marker = this.markers.get(trigger.id);
      if (!marker) continue;
      const dist = Math.hypot(trigger.x - this.player.x, trigger.y - this.player.y);
      const visible = dist < 86 && !ui.isBlocking();
      marker.setVisible(visible);
      if (visible) {
        marker.setY(trigger.y - 18 + Math.sin(now / 300 + trigger.x) * 2);
        marker.setAlpha(dist < 40 ? 1 : 0.55);
      }
    }
    for (const marker of this.hideMarkers) {
      const trigger = marker.getData('trigger') as TriggerDef;
      const dist = Phaser.Math.Distance.Between(trigger.x, trigger.y, this.player.x, this.player.y);
      marker.setVisible(!ui.isBlocking());
      marker.setAlpha(dist < 40 ? 1 : 0.7);
    }
  }

  private updateLabels(): void {
    for (const label of this.buildingLabels) {
      const tx = label.getData('tx') as number;
      const ty = label.getData('ty') as number;
      const dist = Math.hypot(tx * TILE + 8 - this.player.x, ty * TILE + 8 - this.player.y);
      label.setVisible(dist < 300 && !ui.isBlocking());
      label.setAlpha(dist < 150 ? 1 : 0.65);
    }
  }

  private tryTap(trigger: TriggerDef): void {
    if (ui.isBlocking()) return;
    const dist = Math.hypot(trigger.x - this.player.x, trigger.y - this.player.y);
    if (dist > 92) {
      ui.toast('走近一点再互动', 'bad', 1000);
      return;
    }
    this.controller.handle(trigger);
  }

  private setHideSeekActive(active: boolean): void {
    if (active) {
      for (const spot of hideSpots) {
        const x = spot.tx * TILE + 8;
        const y = spot.ty * TILE + 8;
        const text = this.add.text(x, y - 12, '?', {
          fontFamily: 'monospace', fontSize: '13px', color: '#f2c14e',
          stroke: '#101726', strokeThickness: 3, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(23).setResolution(2);
        text.setInteractive(new Phaser.Geom.Circle(0, 0, 12), Phaser.Geom.Circle.Contains);
        const trigger: TriggerDef = {
          id: `hide_${spot.id}`, kind: 'hidespot', payload: spot.id,
          label: `检查 ${spot.name}`, radius: 26, x, y,
        };
        text.on('pointerdown', () => this.tryTap(trigger));
        text.setData('trigger', trigger);
        this.hideMarkers.push(text);
        this.hideTriggers.push(trigger);
        this.interactions.addTrigger(trigger);
      }
    } else {
      for (const marker of this.hideMarkers) marker.destroy();
      this.hideMarkers = [];
      for (const trigger of this.hideTriggers) this.interactions.removeTrigger(trigger.id);
      this.hideTriggers = [];
      this.persist();
    }
  }

  private sleep(): void {
    ui.fadeThrough(() => {
      this.timeSystem.sleep();
      const bed = this.mapData.triggers.find((t) => t.id === 'sleep');
      const x = bed ? bed.x : 117 * TILE + 8;
      const y = bed ? bed.y + TILE : 35 * TILE;
      this.player.setPosition(x, y);
      gameState.setPlayer(x, y);
      this.persist();
      this.updateLighting(true);
      ui.toast(`DAY ${gameState.day} · 08:00，新的一天开始了`, 'gold', 2600);
    });
  }

  private persist(): void {
    if (!this.player) return;
    gameState.setPlayer(this.player.x, this.player.y);
    saveSystem.save(gameState.toData());
  }
}
