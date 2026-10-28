import Phaser from 'phaser';

export interface TreeDef { x: number; y: number; variant: number; }

export function createTrees(scene: Phaser.Scene, trees: TreeDef[]): Phaser.GameObjects.Image[] {
  return trees.map((tree) => {
    const image = scene.add.image(tree.x * 16 + 8, tree.y * 16 + 16, `tree_${tree.variant}`).setOrigin(0.5, 1);
    image.setDepth(10 + (tree.y * 16 + 16) / 10000);
    return image;
  });
}
