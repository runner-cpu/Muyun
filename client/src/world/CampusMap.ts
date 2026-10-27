import Phaser from 'phaser';
import { TILE } from '../config';
import type { TriggerDef } from '../types';

export interface CampusMap {
  map: Phaser.Tilemaps.Tilemap;
  ground: Phaser.Tilemaps.TilemapLayer;
  detail: Phaser.Tilemaps.TilemapLayer;
  shadows: Phaser.Tilemaps.TilemapLayer;
  buildings: Phaser.Tilemaps.TilemapLayer;
  props: Phaser.Tilemaps.TilemapLayer;
  collision: Phaser.Tilemaps.TilemapLayer;
  triggers: TriggerDef[];
  width: number;
  height: number;
}

function readProperty(object: Phaser.Types.Tilemaps.TiledObject, name: string): string {
  const props = object.properties as Array<{ name: string; value: unknown }> | undefined;
  const value = props?.find((p) => p.name === name)?.value;
  return value === undefined || value === null ? '' : String(value);
}

export function buildCampusMap(scene: Phaser.Scene): CampusMap {
  const map = scene.make.tilemap({ key: 'campus' });
  const tileset = map.addTilesetImage('campus', 'tiles');
  if (!tileset) throw new Error('tileset not found');

  const ground = map.createLayer('ground', tileset)!;
  const detail = map.createLayer('detail', tileset)!;
  const shadows = map.createLayer('shadows', tileset)!;
  const buildings = map.createLayer('buildings', tileset)!;
  const props = map.createLayer('props', tileset)!;
  const collision = map.createLayer('collision', tileset)!;

  ground.setDepth(0);
  detail.setDepth(1);
  shadows.setDepth(2);
  buildings.setDepth(3);
  props.setDepth(4);
  collision.setDepth(5).setVisible(false);
  collision.setCollisionByExclusion([-1, 0]);

  const objectLayer = map.getObjectLayer('triggers');
  const triggers: TriggerDef[] = (objectLayer?.objects ?? []).map((object) => ({
    id: readProperty(object, 'id') || object.name,
    kind: readProperty(object, 'kind'),
    payload: readProperty(object, 'payload'),
    label: readProperty(object, 'label'),
    radius: Number(readProperty(object, 'radius')) || 30,
    x: object.x ?? 0,
    y: object.y ?? 0,
  }));

  return {
    map,
    ground,
    detail,
    shadows,
    buildings,
    props,
    collision,
    triggers,
    width: map.widthInPixels,
    height: map.heightInPixels,
  };
}

export function tileCenter(tx: number, ty: number): { x: number; y: number } {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}
