import { ui } from '../instance';
import { gameState } from '../../core/GameState';
import { actionLimit } from '../../sim/rules';
import { openFieldNotes } from './fieldnotes';

export function openGuidePanel(inRanch = false): void {
  const root = ui.openModal({
    title: '玩法说明',
    subtitle: '先完成一周经营，其他规则按需展开。',
    body: `
      <ol class="guide-quickstart">
        <li><h3>先看本周</h3><p>展开本周安排，核对缺草、患病、维护费和季节使命。</p></li>
        <li><h3>做一次安排</h3><p>从经营工具打开草场、畜群或集市，使用有限的行动点。</p></li>
        <li><h3>结算后再调整</h3><p>确认结束本周，阅读真实变化，再安排下一周。剩余行动点不结转。</p></li>
      </ol>
      <p class="modal-note">点击界面各栏的标题，可收起或展开内容，让牧场留出更多视野。</p>
      ${inRanch ? '<div class="guide-replay"><p>想按步骤熟悉操作？可以随时重看简易引导。</p><button type="button" class="pixel-btn" id="guide-onboarding">重看简易引导</button></div>' : ''}
      <details class="panel-disclosure"><summary>使命、饲草与三周储备</summary><p>打开本周概览，先看季节使命、患病与缺草风险，再核对需草量、已有放牧采食、干草库存和维护费。三周储备账把库存压力、季节草价与持续支出放在一起，也显示距离整局保留存栏下限的余量；它固定当前畜群、不假定未来放牧，只是预算参照。春季练习轮牧，夏季留出恢复时间，秋季储草，冬季保住健康与经营连续性。</p></details>
      <details class="panel-disclosure"><summary>行动点、轮牧与帮工</summary><p>基础每周 3 个行动点；每新增一名帮工，从下一周增加 1 点，最多 5 点。当前配置上限为 ${actionLimit(gameState.run)} 点。雇用消耗 ¥3,000 和 1 行动点，每名帮工每周还需 ¥260。</p><p>畜群、草场、集市和科技可直接打开。每块草场每周只能放牧或收草一次；两者都会中断连续休牧。放牧抵扣本周需草，割草增加库存，未使用小区会自动休牧。缺草时可补草或适度减载；卖空畜群不能取得最高综合成果。</p></details>
      <details class="panel-disclosure"><summary>科技监测与方案试算</summary><p>项圈为已佩戴个体展示真实体况趋势，没有前次记录时显示“首次记录”。草场监测需要 1 行动点、¥800，每周维护 ¥30；开通后能比较放牧与休牧，并运行本周策略搜索。把均衡、草场、资产三种偏好与“不再行动”比较；选择方案可查看行动顺序、逐步变化和评分依据，随后导出本周实验单。</p><p class="modal-note">试算不花行动、不改变存档、不自动执行。参考序列遵守现金和行动点限制，预估不含未来随机天气、事件或疫病结果。不同权重的总分不能直接比较；不同偏好可能给出相同行动，有限搜索不保证最优。</p></details>
      <details class="panel-disclosure"><summary>周结算、繁育与独立存档</summary><p>确认结束本周后，系统执行喂养、生长、疫病、天气和费用结算。阅读实际变化，再处理下一周事件；剩余行动点不会保留。只有仍存活、在栏的孕母会在本局结束时产仔。</p><p>完整经营从第 1 周开始，第 13 周结束；固定越冬挑战从第 10 周开始，恰好结算四次。两种模式各有独立存档，重开其中一种会保留另一种。</p></details>
      <details class="panel-disclosure"><summary>三维成果与同条件实验</summary><p>局末分别评价经营、生态和动物健康，并展示季末使命、逐周指标与关键选择。最高成果还要求足够的保留存栏和现金。完局后可与固定贪心、每周搜索策略从同一场景和 seed 重跑比较，并导出 JSON。完成结算、没有破产、达到最高成果分别判断；参考搜索解决本周问题，不能保证达成整局使命。</p><p class="modal-note">评分、使命阈值与搜索权重都是游戏设计参数，不是农牧行业标准。旧档或规则升级只从实际续玩起点重新记录，不补造缺失周次。</p></details>
      ${inRanch ? '<details class="panel-disclosure"><summary>高原手记</summary><p>高原手记读取当前草场、储草与畜群，解释冬季窗口、连续休牧和两种负担尺度。</p><button type="button" class="pixel-btn" id="guide-fieldnotes">打开高原手记</button></details>' : ''}
      <details class="panel-disclosure"><summary>键鼠与触屏操作</summary><dl class="guide-controls">
        <div><dt><kbd>WASD</kbd> / <kbd>方向键</kbd></dt><dd>在牧场里走动</dd></div>
        <div><dt><kbd>E</kbd> / <kbd>空格</kbd></dt><dd>靠近设施后互动</dd></div>
        <div><dt><kbd>1</kbd>–<kbd>4</kbd></dt><dd>畜群、草场、集市、科技</dd></div>
        <div><dt><kbd>Esc</kbd></dt><dd>关闭面板或打开设置</dd></div>
      </dl>
      <p class="modal-note">手机建议横屏，使用左下摇杆移动、右下按钮互动。有效经营行动、周结算与事件选择后自动保存到当前浏览器。</p></details>`,
  });
  root.querySelector('#guide-fieldnotes')?.addEventListener('click', () => openFieldNotes(ui));
  root.querySelector('#guide-onboarding')?.addEventListener('click', () => {
    void import('../onboarding').then(({ openOnboarding }) => {
      if (!root.isConnected) return;
      ui.closeModal();
      openOnboarding();
    });
  });
}
