/**
 * progressRing.js - SVG 원형 진도 표시
 */

/**
 * @param {number} percent - 0~100
 * @param {object} opts
 * @param {number} opts.size - 지름 (px)
 * @param {number} opts.stroke - 선 두께
 * @param {string} opts.color - 채우기 색상
 * @param {string} opts.label - 하단 레이블
 * @returns HTMLElement
 */
export function createProgressRing(percent, {
  size   = 80,
  stroke = 7,
  color  = '#3B82F6',
  label  = '',
} = {}) {
  const r       = (size / 2) - stroke;
  const circ    = 2 * Math.PI * r;
  const filled  = circ * (Math.max(0, Math.min(100, percent)) / 100);
  const gap     = circ - filled;

  const wrap = document.createElement('div');
  wrap.className = 'progress-ring-wrap';

  wrap.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle
        cx="${size/2}" cy="${size/2}" r="${r}"
        fill="none"
        stroke="var(--bg-tertiary)"
        stroke-width="${stroke}"
      />
      <circle
        cx="${size/2}" cy="${size/2}" r="${r}"
        fill="none"
        stroke="${color}"
        stroke-width="${stroke}"
        stroke-linecap="round"
        stroke-dasharray="${filled} ${gap}"
        stroke-dashoffset="0"
        transform="rotate(-90 ${size/2} ${size/2})"
        class="ring-fill"
      />
      <text
        x="${size/2}" y="${size/2 + 1}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="${size < 70 ? 13 : 16}"
        font-weight="700"
        fill="var(--text-primary)"
      >${percent}%</text>
    </svg>
    ${label ? `<span class="progress-ring-label">${label}</span>` : ''}
  `;

  return wrap;
}
