import Phaser from 'phaser';
import type { BuildingDef } from '../types';

/**
 * Buildings are 2.5D sprites placed over an empty tile layer.
 * Depth is keyed to the building's south edge so the player renders
 * behind the facade when walking north of it and in front when south.
 */
export function createBuildings(scene: Phaser.Scene, defs: BuildingDef[]): Phaser.GameObjects.Image[] {
  return defs.map((def) => {
    const image = scene.add.image(def.x * 16 - 4, def.y * 16 - 4, def.key).setOrigin(0);
    image.setDepth(10 + ((def.y + def.h) * 16) / 10000);
    image.setData('buildingId', def.id);
    return image;
  });
}
