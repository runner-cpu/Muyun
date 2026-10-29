import type Phaser from 'phaser';
import type { TriggerDef } from '../types';
import { ui } from '../ui/instance';
import { openHerdPanel } from '../ui/panels/herd';
import { openPasturePanel } from '../ui/panels/pasture';
import { openMarketPanel } from '../ui/panels/market';
import { openTechPanel } from '../ui/panels/tech';

export class RanchInteractionController {
  constructor(private scene: Phaser.Scene) {}

  async handle(trigger: TriggerDef): Promise<void> {
    switch (trigger.kind) {
      case 'herd':
        openHerdPanel();
        break;
      case 'pasture':
        openPasturePanel(trigger.payload || undefined);
        break;
      case 'market':
        openMarketPanel();
        break;
      case 'tech':
        openTechPanel();
        break;
      default:
        ui.toast(`未实现的交互：${trigger.kind}`, 'bad');
    }
  }
}
