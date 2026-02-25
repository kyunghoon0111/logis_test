/**
 * conceptCard.js - 개념 섹션 렌더러
 */

const TIP_META = {
  warning: { icon: '⚠️', label: '주의' },
  compare: { icon: '🔵', label: '비교' },
  memory:  { icon: '🧠', label: '암기' },
  trick:   { icon: '✨', label: '팁' },
};

export function highlightSQL(text) {
  // SQL 하이라이팅 제거 (물류관리사 앱에서 불필요)
  return String(text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * 섹션 전체 내용 렌더링
 * @param {object} section - 정규화된 섹션 객체
 * @returns {string} HTML 문자열
 */
export function renderSectionContent(section) {
  const parts = [];

  // 본문
  if (section.content) {
    parts.push(`<p class="section-content-text">${escHtml(section.content)}</p>`);
  }

  // 핵심 포인트
  if (section.keyPoints?.length) {
    parts.push(`
      <div class="key-points-list">
        <div class="key-points-title">
          <span>📌</span> 핵심 포인트
        </div>
        ${section.keyPoints.map(kp => `
          <div class="key-point-item">
            <div class="key-point-dot"></div>
            <div>${escHtml(kp)}</div>
          </div>
        `).join('')}
      </div>
    `);
  }

  // 팁
  if (section.tips?.length) {
    parts.push(section.tips.map(tip => {
      const meta = TIP_META[tip.type] || TIP_META.memory;
      return `
        <div class="tip-box ${tip.type || 'memory'}">
          <span class="tip-icon">${meta.icon}</span>
          <strong>${meta.label}:</strong> ${escHtml(tip.text)}
        </div>
      `;
    }).join(''));
  }

  // 테이블
  if (section.tables?.length) {
    parts.push(section.tables.map(tbl => `
      <div style="margin:var(--sp-4) 0;">
        ${tbl.title ? `<div style="font-size:var(--text-sm); font-weight:700; margin-bottom:var(--sp-2); color:var(--text-secondary);">${escHtml(tbl.title)}</div>` : ''}
        <div class="table-wrap">
          <table class="concept-table">
            <thead>
              <tr>${(tbl.headers || []).map(h => `<th>${escHtml(h)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${(tbl.rows || []).map(row =>
                `<tr>${(Array.isArray(row) ? row : [row]).map(cell => `<td>${escHtml(String(cell))}</td>`).join('')}</tr>`
              ).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join(''));
  }

  // 수식/공식 예제
  if (section.formulaExamples?.length) {
    parts.push(section.formulaExamples.map(ex => `
      <div class="formula-block">
        ${ex.formula ? `<div class="formula-text">${escHtml(ex.formula)}</div>` : ''}
        ${ex.desc ? `<div class="formula-desc">${escHtml(ex.desc)}</div>` : ''}
      </div>
    `).join(''));
  }

  return parts.join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
