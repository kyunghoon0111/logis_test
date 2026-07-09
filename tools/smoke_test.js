/* app.js를 DOM 셰임 위에서 실제로 구동해 화면 HTML을 뽑아본다.
 *
 *   node tools/smoke_test.js [앱폴더]        (기본: app)
 *
 * 브라우저 없이 렌더러를 검증한다. 표·박스가 그려지는지, 연습 모드가 즉시
 * 채점하는지, 실전 모드가 정답을 감추는지 확인하고 실패하면 종료코드 1.
 */
const fs = require('fs');
const vm = require('vm');
const nodePath = require('path');
const path = nodePath.resolve(process.argv[2] || 'app') + nodePath.sep;
const data = JSON.parse(fs.readFileSync(path + 'data/exams.json', 'utf8'));

const mkEl = () => {
  const el = {
    className: '', innerHTML: '', textContent: '', children: [],
    classList: { add() {}, remove() {} },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, setAttribute() {}, querySelector() { return null }, remove() {},
  };
  return el;
};
const appEl = mkEl();

const ctx = {
  console,
  document: {
    addEventListener() {},
    createElement: () => mkEl(),
    querySelector: (s) => (s === '#app' ? appEl : mkEl()),
    documentElement: { setAttribute() {} },
    body: mkEl(),
  },
  window: { scrollTo() {} },
  navigator: {},
  localStorage: { getItem: () => null, setItem() {} },
  matchMedia: () => ({ matches: false }),
  fetch: async () => ({ json: async () => data }),
  setTimeout, clearTimeout, setInterval, clearInterval,
  Date, Math, JSON, Set, Map, Array, Object, String, Number,
};
ctx.globalThis = ctx;
ctx.setImmediate = setImmediate;
vm.createContext(ctx);
// const 선언은 컨텍스트 객체에 붙지 않으므로 var로 내보낸다
vm.runInContext(
  fs.readFileSync(path + 'js' + nodePath.sep + 'app.js', 'utf8')
  + '\n;var __X = { App, blocksHTML, optionsHTML, feedbackHTML, renderQuiz };', ctx);
Object.assign(ctx, ctx.__X);

const dump = (label, html) => {
  console.log('\n========== ' + label + ' ==========');
  console.log(html.replace(/></g, '>\n<').replace(/\n\s*\n/g, '\n'));
};

async function main() {
await new Promise((r) => setImmediate(r));   // boot()의 fetch 완료 대기

const q = (round, sname, no) => {
  const ex = ctx.App.data.exams.find((e) => e.round === round);
  const si = ex.subjects.findIndex((s) => s.name === sname);
  return { q: ex.subjects[si].questions.find((x) => x.no === no), si, round };
};

// 1) 표가 있는 문제
const t = q(29, '물류관리론', 15);
dump('29회 물류관리론 15번 — 표 2개', ctx.blocksHTML(t.q));

// 2) 박스 지문
const b = q(29, '물류관리론', 40);
dump('29회 물류관리론 40번 — 박스', ctx.blocksHTML(b.q));

// 3) 병합셀 표(수송표)
const m = q(27, '화물운송론', 28);
dump('27회 화물운송론 28번 — 수송표', ctx.blocksHTML(m.q));

// 4) 선지형 표
const o = q(28, '국제물류론', 11);
dump('28회 국제물류론 11번 — 선지표', ctx.optionsHTML(o.q, { picked: 2, reveal: true }));

// 5) 연습 모드 즉시 채점 (오답을 골랐을 때)
dump('29회 물류관리론 40번 — 오답 선택 피드백', ctx.feedbackHTML(b.q, 4));

// 6) 실제 퀴즈 화면 렌더 (연습 모드, 답 선택 후)
ctx.App.state.session = {
  round: 29, mode: 'subject', si: 0, timer: false, practice: true,
  order: [{ round: 29, si: 0, no: 40 }], answers: [4], flags: [false],
  index: 0, startedAt: Date.now(), elapsed: 0,
};
appEl.children.length = 0;
ctx.renderQuiz(appEl);
const bodyEl = appEl.children.find((c) => c.className.includes('quiz-body'));
const html = bodyEl.innerHTML;
console.log('\n========== renderQuiz (연습 모드, ④ 선택) ==========');
console.log(html.slice(0, 260) + '\n  ...');
const checks = [
  ['박스 렌더', html.includes('qbox')],
  ['정답 ③ 초록', /class="option correct"[\s\S]*?150,000/.test(html)],
  ['내 답 ④ 빨강', /class="option wrong"[\s\S]*?200,000/.test(html)],
  ['피드백 표시', html.includes('feedback no')],
  ['해설 포함', html.includes('150,000km')],
  ['채점 후 클릭 불가(data-opt 없음)', !html.includes('data-opt')],
];
// 실전 모드는 채점하지 않아야 한다
ctx.App.state.session.practice = false;
appEl.children.length = 0;
ctx.renderQuiz(appEl);
const html2 = appEl.children.find((c) => c.className.includes('quiz-body')).innerHTML;
checks.push(['실전 모드는 정답 숨김', !html2.includes('feedback') && !html2.includes('option correct')]);
checks.push(['실전 모드는 선택만 표시', html2.includes('option selected')]);
checks.push(['실전 모드는 클릭 가능', html2.includes('data-opt')]);

console.log('\n========== 검증 ==========');
let bad = 0;
for (const [name, ok] of checks) { if (!ok) bad++; console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}`); }
console.log(bad ? `\n${bad}건 실패` : '\n전부 통과');
process.exit(bad ? 1 : 0);
}
main();
