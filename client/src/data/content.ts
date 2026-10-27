export interface QuizQuestion { q: string; options: string[]; answer: number; note: string; }

export const QUIZZES: QuizQuestion[] = [
  { q: '北门到睿智楼的这条路，在游戏里最接近哪种形状？', options: ['一条直线', '一条绕行的环线', '一个圆圈'], answer: 1, note: '睿智楼挡住了直路，得从两侧绕过去。' },
  { q: '橘猫、黑猫、白猫的克制关系是？', options: ['橘 → 黑 → 白 → 橘', '橘 → 白 → 黑 → 橘', '三系互不相克'], answer: 0, note: '记住这条链，宠物对战就不会打得太难看。' },
  { q: '图书馆的开放时间是？', options: ['08:00 — 22:00', '09:00 — 21:00', '全天开放'], answer: 0, note: '闭馆前五分钟，馆内灯光会变暖。' },
  { q: '游戏里一天等于现实多长时间？', options: ['6 分钟', '30 分钟', '1 小时'], answer: 0, note: '一天 6 分钟，所以别在学生食堂门口发太久呆。' },
];

export const MEALS = [
  { name: '尕面片套餐', desc: '热腾腾的一碗，食堂阿姨说今天面片揪得特别匀。', mood: 8 },
  { name: '青海老酸奶 + 馍', desc: '酸甜冰凉，配刚出炉的馍，稳妥的选择。', mood: 6 },
  { name: '土火锅小份', desc: '辣度随机，心情也随机，冬天最合适。', mood: 7 },
];

export function timetableBody(): string {
  return `<div class="stat-row"><div><b>08:30</b><span>像素渲染基础</span></div><div><b>10:20</b><span>校园漫游设计</span></div><div><b>14:00</b><span>猫的行为学</span></div></div>
    <p class="modal-note">课程表是静态展示，v1 只做“上课”一个交互点。</p>
    <div class="modal-actions"><button class="pixel-btn" id="timetable-close">知道了</button></div>`;
}

export function noticeBody(): string {
  return `<p><b>今日通知</b>：西田径场附近出现了一只黑猫，猫协提醒大家不要投喂人类食物。</p>
    <p><b>操作</b>：WASD / 方向键移动，E 或空格互动，手机用左下摇杆 + 右下按钮。</p>
    <p><b>可用交互</b>：签到、上课、课程表、图书馆问答、座位提示、打饭、睡觉、撸猫、猫图鉴、宠物对战、躲猫猫、看台、售货机、路灯开关。</p>
    <p class="modal-note">校园布局按青海大学公开地图的相对位置排布，细节仍在继续校正。</p>
    <div class="modal-actions"><button class="pixel-btn" id="notice-close">知道了</button></div>`;
}

export function seatBody(): string {
  return `<p>三楼靠窗还有 3 个空位，二楼自习区基本坐满。</p>
    <p class="modal-note">靠窗座位：林同学、周同学、一只假装看书的橘猫。</p>
    <div class="modal-actions"><button class="pixel-btn" id="seat-close">去找个位置</button></div>`;
}

export function grandstandBody(first: boolean): string {
  return `<p>从这里能看到整个西田径场：红色跑道、绿色球场，还有一只在灯柱后面鬼鬼祟祟的黑猫。</p>
    <p class="modal-note">${first ? '心情 +1。' : '今天已经在这里吹过风了。'}</p>
    <div class="modal-actions"><button class="pixel-btn" id="stand-close">继续逛</button></div>`;
}
