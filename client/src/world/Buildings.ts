import Phaser from 'phaser';
import type { BuildingDef } from '../types';
import footprintsData from '../data/footprints.json';

const footprints = footprintsData as Record<string, { extrude: number }>;

/**
 * Buildings are 2.5D sprites placed over an empty tile layer.
 * Depth is keyed to the building's south edge so the player renders
 * behind the facade when walking north of it and in front when south.
 */
export function createBuildings(scene: Phaser.Scene, defs: BuildingDef[]): Phaser.GameObjects.Image[] {
  return defs.map((def) => {
    const extruded = footprints[def.id] && def.type !== 'sports' && def.type !== 'gate';
    const offsetY = (extruded ? footprints[def.id].extrude : 0) + 4;
    const image = scene.add.image(def.x * 16 - 4, def.y * 16 - offsetY, def.key).setOrigin(0);
    image.setDepth(10 + ((def.y + def.h) * 16) / 10000);
    image.setData('buildingId', def.id);
    return image;
  });
}
