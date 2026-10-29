import type Phaser from 'phaser';
import type { TriggerDef } from '../types';
import { ui } from '../ui/instance';

/**
 * Phase 0 stub. Phase 2 replaces the placeholder panels with the real
 * herd / pasture / market / tech panels.
 */
export class RanchInteractionController {
  constructor(private scene: Phaser.Scene) {}

  async handle(trigger: TriggerDef): Promise<void> {
    switch (trigger.kind) {
      case 'herd':
        this.openPlaceholder();
        break;
      case 'pasture':
        ui.toast('草场面板将在 Phase 2 接入');
        break;
      case 'market':
        ui.toast('集市面板将在 Phase 2 接入');
        break;
      case 'tech':
        ui.toast('科技面板将在 Phase 2 接入');
        break;
      default:
        ui.toast(`未实现的交互：${trigger.kind}`, 'bad');
    }
  }

  private openPlaceholder(): void {
    ui.openModal({
      title: '畜群',
      subtitle: 'Phase 0 骨架 · Phase 2 接入完整畜群面板',
      body: `
        <p>这里将显示每一头牦牛与藏羊的个体档案。</p>
        <div class="stat-row">
          <div><b>20</b><span>牦牛</span></div>
          <div><b>30</b><span>藏羊</span></div>
          <div><b>3.2</b><span>平均 BCS</span></div>
        </div>
        <p class="modal-note">下一步：耳标、体重曲线、体况评分、发情与疫病预警。</p>`,
    });
  }
}
