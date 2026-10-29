export function yuan(value: number): string {
  return `¥${Math.round(value).toLocaleString('zh-CN')}`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function meter(value: number, max: number, tone = ''): string {
  const width = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return `<span class="meter ${tone}"><i style="width:${width}%"></i></span>`;
}

export function statRow(items: Array<[string | number, string]>): string {
  return `<div class="stat-row">${items
    .map(([value, label]) => `<div><b>${value}</b><span>${label}</span></div>`)
    .join('')}</div>`;
}
