/* ===== 물류관리사 기출문제 앱 ===== */
'use strict';

const SUBJECT_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
const PASS = { perSubjectMin: 40, avgMin: 60 };
const LS = 'mlq_state_v1';

const App = {
  data: null,
  state: {
    theme: 'light',
    history: [],      // 완료한 시험 기록
    wrong: [],        // 오답노트: [{round,si,no}]
    bookmarks: [],    // 즐겨찾기: [{round,si,no}]
    session: null,    // 진행중 시험
  },
  view: { name: 'home', params: {} },
};

/* ---------- 저장/불러오기 ---------- */
function saveState() {
  try { localStorage.setItem(LS, JSON.stringify(App.state)); } catch (e) {}
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS));
    if (s) Object.assign(App.state, s);
  } catch (e) {}
  const t = App.state.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  App.state.theme = t;
  document.documentElement.setAttribute('data-theme', t);
}

/* ---------- 유틸 ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CIRCLED = ['①', '②', '③', '④', '⑤'];
const keyOf = (r, si, no) => `${r}-${si}-${no}`;
const acceptOf = (q) => (Array.isArray(q.accept) && q.accept.length ? q.accept : [q.answer]);
const isCorrect = (q, pick) => pick != null && acceptOf(q).includes(pick);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

function exam(round) { return App.data.exams.find((e) => e.round === round); }

// 시험 세트 구성: 문제 배열 flatten
function buildQuestions(round, mode, si) {
  const ex = exam(round);
  const out = [];
  const pushSubj = (sIdx) => {
    ex.subjects[sIdx].questions.forEach((q) => out.push({
      round, si: sIdx, subjName: ex.subjects[sIdx].name, ...q,
    }));
  };
  if (mode === 'subject') pushSubj(si);
  else ex.subjects.forEach((_, i) => pushSubj(i)); // full
  return out;
}

/* ---------- 화면 전환 ---------- */
function go(name, params = {}) {
  App.view = { name, params };
  render();
  window.scrollTo(0, 0);
}

function render() {
  const app = $('#app');
  const R = {
    home: renderHome, config: renderConfig, quiz: renderQuiz,
    result: renderResult, review: renderReview, progress: renderProgress,
    bookmarks: renderBookmarks,
  }[App.view.name] || renderHome;
  app.innerHTML = '';
  R(app);
}

/* ---------- 공통 컴포넌트 ---------- */
function topbar(title, opts = {}) {
  const bar = document.createElement('div');
  bar.className = 'topbar';
  bar.innerHTML = `
    ${opts.back ? `<button class="back-btn" data-act="back">‹ ${esc(opts.backLabel || '뒤로')}</button>` : `<span class="brand">물류관리사 <small>기출문제</small></span>`}
    <span class="spacer"></span>
    ${opts.right || ''}
    <button class="icon-btn" data-act="theme" aria-label="테마">
      ${App.state.theme === 'dark'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>'}
    </button>`;
  return bar;
}

function tabbar(active) {
  const nav = document.createElement('nav');
  nav.className = 'tabbar';
  const tabs = [
    ['home', '홈', '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'],
    ['progress', '진도', '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'],
    ['bookmarks', '오답·즐겨', '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'],
  ];
  nav.innerHTML = tabs.map(([id, label, path]) =>
    `<button class="${active === id ? 'active' : ''}" data-tab="${id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>
      <span>${label}</span>
    </button>`).join('');
  return nav;
}

/* ---------- 홈 ---------- */
function bestScore(round) {
  const hs = App.state.history.filter((h) => h.round === round && h.mode === 'full');
  if (!hs.length) return null;
  return hs.reduce((a, b) => (b.avg > a.avg ? b : a));
}

function renderHome(app) {
  app.appendChild(topbar());
  const s = document.createElement('div');
  s.className = 'screen fade-in';
  const totalExplained = App.data.exams.reduce((a, e) => a + e.explained, 0);
  const totalQ = App.data.exams.reduce((a, e) => a + e.totalQuestions, 0);
  const done = App.state.history.filter((h) => h.mode === 'full').length;

  let html = `
    <div class="hero">
      <h1>물류관리사 5개년 기출</h1>
      <p>실제 시험처럼 풀고 · 채점받고 · 해설로 복습하세요</p>
      <div class="stat-row">
        <div class="stat"><b>${App.data.exams.length}</b><span>회차</span></div>
        <div class="stat"><b>${totalQ}</b><span>문제</span></div>
        <div class="stat"><b>${done}</b><span>응시 완료</span></div>
      </div>
    </div>`;

  if (App.state.session) {
    const ss = App.state.session;
    const ex = exam(ss.round);
    const answered = ss.answers.filter((a) => a != null).length;
    html += `
      <div class="card" style="border-color:var(--primary)">
        <div style="font-weight:800;margin-bottom:4px">이어서 풀기</div>
        <div style="color:var(--text-dim);font-size:14px">제${ss.round}회 · ${ss.mode === 'subject' ? esc(ex.subjects[ss.si].name) : '전과목'} · ${answered}/${ss.order.length}문제 완료</div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn" data-act="resume">이어서 풀기</button>
          <button class="btn secondary" style="flex:0 0 auto;width:auto;padding:14px 18px" data-act="discard">삭제</button>
        </div>
      </div>`;
  }

  html += `<div class="section-label">회차 선택</div><div class="year-grid">`;
  App.data.exams.slice().reverse().forEach((e) => {
    const best = bestScore(e.round);
    const explainedFull = e.explained === e.totalQuestions;
    html += `
      <button class="year-card" data-round="${e.round}">
        <div class="rnd">제${e.round}회</div>
        <div class="yr">${e.year}년도 · ${e.totalQuestions}문제</div>
        <div class="meta">
          ${explainedFull
            ? '<span class="badge ok">해설 완비</span>'
            : `<span class="badge wait">해설 ${e.explained}/${e.totalQuestions}</span>`}
          ${best ? `<span class="badge ${best.pass ? 'pass' : 'fail'}">${best.pass ? '합격' : '불합'} ${best.avg}점</span>` : ''}
        </div>
      </button>`;
  });
  html += `</div>`;
  s.innerHTML = html;
  app.appendChild(s);
  app.appendChild(tabbar('home'));
}

/* ---------- 시험 설정 ---------- */
function renderConfig(app) {
  const round = App.view.params.round;
  const ex = exam(round);
  App.view.params.mode = App.view.params.mode || 'full';
  App.view.params.si = App.view.params.si ?? 0;
  App.view.params.timer = App.view.params.timer ?? false;
  const p = App.view.params;

  app.appendChild(topbar('', { back: true, backLabel: '홈' }));
  const s = document.createElement('div');
  s.className = 'screen fade-in';
  const modes = [
    ['full', '전과목 모의고사', `5과목 ${ex.totalQuestions}문제 · 합격 판정`, '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'],
    ['subject', '과목별 풀기', '한 과목 40문제 집중', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'],
  ];
  let html = `
    <div class="pagettl">제${round}회 (${ex.year})</div>
    <p class="subttl">풀이 방식을 선택하세요</p>
    <div class="mode-list">`;
  modes.forEach(([id, t, d, icon]) => {
    html += `
      <button class="mode-opt ${p.mode === id ? 'active' : ''}" data-mode="${id}">
        <span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span>
        <span class="t"><b>${t}</b><span>${d}</span></span>
      </button>`;
  });
  html += `</div>`;

  if (p.mode === 'subject') {
    html += `<div class="section-label">과목 선택</div><div class="subject-chips">`;
    ex.subjects.forEach((sub, i) => {
      html += `<button class="chip ${p.si === i ? 'active' : ''}" data-si="${i}">${esc(sub.name)}</button>`;
    });
    html += `</div>`;
  }

  html += `
    <div class="card" style="margin-top:20px;display:flex;align-items:center;justify-content:space-between">
      <div><b>시험 타이머</b><div style="font-size:13px;color:var(--text-dim)">경과 시간 표시</div></div>
      <button class="chip ${p.timer ? 'active' : ''}" data-act="toggle-timer">${p.timer ? '켜짐' : '꺼짐'}</button>
    </div>
    <div style="margin-top:24px"><button class="btn" data-act="start">시험 시작</button></div>`;
  s.innerHTML = html;
  app.appendChild(s);
}

/* ---------- 시험 시작 ---------- */
function startExam(round, mode, si, timer) {
  const qs = buildQuestions(round, mode, si);
  App.state.session = {
    round, mode, si, timer: !!timer,
    order: qs.map((q) => ({ round: q.round, si: q.si, no: q.no })),
    answers: new Array(qs.length).fill(null),
    flags: new Array(qs.length).fill(false),
    index: 0,
    startedAt: Date.now(),
    elapsed: 0,
  };
  saveState();
  go('quiz');
}

/* ---------- 시험 풀이 화면 ---------- */
function sessionQuestion(ss, idx) {
  const o = ss.order[idx];
  const ex = exam(o.round);
  const q = ex.subjects[o.si].questions.find((x) => x.no === o.no);
  return { ...q, si: o.si, round: o.round, subjName: ex.subjects[o.si].name };
}

let timerInt = null;
function renderQuiz(app) {
  const ss = App.state.session;
  if (!ss) return go('home');
  const idx = ss.index;
  const q = sessionQuestion(ss, idx);
  const total = ss.order.length;
  const answered = ss.answers.filter((a) => a != null).length;
  const col = SUBJECT_COLORS[q.si];

  const top = document.createElement('div');
  top.className = 'quiz-top';
  top.innerHTML = `
    <div class="row">
      <button class="back-btn" data-act="exit" style="padding:6px 2px">‹ 나가기</button>
      <div class="progress-track"><div class="progress-fill" style="width:${(answered / total) * 100}%"></div></div>
      ${ss.timer ? `<span class="timer" id="timer">00:00</span>` : ''}
    </div>
    <div class="row" style="margin-top:8px">
      <span class="subject-tag" style="background:${col}">${esc(q.subjName)}</span>
      <span class="spacer" style="flex:1"></span>
      <span class="qcount">${idx + 1} / ${total}</span>
    </div>`;
  app.appendChild(top);

  const body = document.createElement('div');
  body.className = 'quiz-body fade-in';
  const sel = ss.answers[idx];
  let opts = '';
  q.options.forEach((opt, i) => {
    const n = i + 1;
    opts += `<button class="option ${sel === n ? 'selected' : ''}" data-opt="${n}">
      <span class="lbl">${CIRCLED[i]}</span><span>${esc(opt)}</span></button>`;
  });
  body.innerHTML = `
    <div class="q-num">문제 ${q.no}</div>
    <div class="q-text">${esc(q.q)}</div>
    <div class="options">${opts}</div>`;
  app.appendChild(body);

  const nav = document.createElement('div');
  nav.className = 'quiz-nav';
  const isLast = idx === total - 1;
  nav.innerHTML = `
    <button class="grid-btn flag-btn ${ss.flags[idx] ? 'on' : ''}" data-act="flag" aria-label="검토표시">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="${ss.flags[idx] ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
    </button>
    <button class="grid-btn" data-act="grid" aria-label="문제 목록">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    </button>
    <button class="nav-btn" data-act="prev" ${idx === 0 ? 'disabled' : ''}>← 이전</button>
    ${isLast
      ? `<button class="nav-btn primary" data-act="submit">제출하기</button>`
      : `<button class="nav-btn primary" data-act="next">다음 →</button>`}`;
  app.appendChild(nav);

  if (ss.timer) startTimer();
}

function startTimer() {
  clearInterval(timerInt);
  const tick = () => {
    const ss = App.state.session; if (!ss) return clearInterval(timerInt);
    const el = ss.elapsed + Math.floor((Date.now() - ss.startedAt) / 1000);
    const m = String(Math.floor(el / 60)).padStart(2, '0');
    const s = String(el % 60).padStart(2, '0');
    const t = document.getElementById('timer'); if (t) t.textContent = `${m}:${s}`;
  };
  tick(); timerInt = setInterval(tick, 1000);
}

/* 문제 목록 시트 */
function openGrid() {
  const ss = App.state.session;
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  let cells = '';
  let lastSi = -1;
  const ex = exam(ss.round);
  ss.order.forEach((o, i) => {
    if (ss.mode === 'full' && o.si !== lastSi) {
      lastSi = o.si;
      cells += `<div class="subj-divider">${esc(ex.subjects[o.si].name)}</div>`;
    }
    const cls = [
      ss.answers[i] != null ? 'answered' : '',
      i === ss.index ? 'current' : '',
      ss.flags[i] ? 'flagged' : '',
    ].join(' ');
    cells += `<button class="qg ${cls}" data-jump="${i}">${o.no}</button>`;
  });
  back.innerHTML = `<div class="sheet"><div class="handle"></div>
    <h3>문제 목록 · ${ss.answers.filter((a) => a != null).length}/${ss.order.length} 완료</h3>
    <div class="qgrid">${cells}</div></div>`;
  document.body.appendChild(back);
  back.addEventListener('click', (e) => {
    if (e.target === back) return back.remove();
    const j = e.target.closest('[data-jump]');
    if (j) { App.state.session.index = +j.dataset.jump; back.remove(); saveState(); render(); }
  });
}

/* ---------- 제출/채점 ---------- */
function submitExam() {
  const ss = App.state.session;
  const unanswered = ss.answers.filter((a) => a == null).length;
  if (unanswered > 0 && !confirm(`아직 ${unanswered}문제를 풀지 않았습니다. 제출할까요?`)) return;

  const ex = exam(ss.round);
  const perSubj = {}; // si -> {correct, total}
  const wrongList = [];
  ss.order.forEach((o, i) => {
    const q = ex.subjects[o.si].questions.find((x) => x.no === o.no);
    const ok = isCorrect(q, ss.answers[i]);
    perSubj[o.si] = perSubj[o.si] || { correct: 0, total: 0 };
    perSubj[o.si].total++;
    if (ok) perSubj[o.si].correct++;
    else wrongList.push({ round: o.round, si: o.si, no: o.no });
  });

  const scores = {};
  Object.keys(perSubj).forEach((si) => {
    scores[si] = Math.round((perSubj[si].correct / perSubj[si].total) * 100);
  });
  const vals = Object.values(scores);
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const isFull = ss.mode === 'full';
  const pass = isFull && vals.every((v) => v >= PASS.perSubjectMin) && avg >= PASS.avgMin;
  const totalCorrect = Object.values(perSubj).reduce((a, s) => a + s.correct, 0);
  const el = ss.elapsed + (ss.timer ? Math.floor((Date.now() - ss.startedAt) / 1000) : 0);

  // 오답노트 갱신
  const wset = new Set(App.state.wrong.map((w) => keyOf(w.round, w.si, w.no)));
  wrongList.forEach((w) => { if (!wset.has(keyOf(w.round, w.si, w.no))) App.state.wrong.push(w); });
  // 맞춘 문제는 오답노트에서 제거
  const correctKeys = new Set();
  ss.order.forEach((o, i) => {
    const q = ex.subjects[o.si].questions.find((x) => x.no === o.no);
    if (isCorrect(q, ss.answers[i])) correctKeys.add(keyOf(o.round, o.si, o.no));
  });
  App.state.wrong = App.state.wrong.filter((w) => !correctKeys.has(keyOf(w.round, w.si, w.no)));

  const record = {
    round: ss.round, mode: ss.mode, si: ss.si,
    scores, avg, pass, isFull, totalCorrect, total: ss.order.length,
    elapsed: el, date: Date.now(),
    // 리뷰용 스냅샷
    answers: ss.answers.slice(), order: ss.order.slice(),
  };
  App.state.history.unshift(record);
  if (App.state.history.length > 50) App.state.history.length = 50;
  App.state.session = null;
  clearInterval(timerInt);
  saveState();
  go('result', { rec: record });
}

/* ---------- 결과 화면 ---------- */
function ringSVG(pct, pass) {
  const r = 52, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  const color = pass ? 'var(--success)' : (pct >= 60 ? 'var(--primary)' : 'var(--danger)');
  return `<svg width="140" height="140" viewBox="0 0 140 140">
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="12"/>
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 70 70)" style="transition:stroke-dashoffset .6s"/>
    <text x="70" y="66" text-anchor="middle" font-size="34" font-weight="800" fill="var(--text)">${pct}</text>
    <text x="70" y="88" text-anchor="middle" font-size="13" fill="var(--text-dim)">평균점수</text>
  </svg>`;
}

function renderResult(app) {
  const rec = App.view.params.rec || App.state.history[0];
  if (!rec) return go('home');
  const ex = exam(rec.round);
  app.appendChild(topbar('', { back: true, backLabel: '홈' }));
  const s = document.createElement('div');
  s.className = 'screen fade-in';

  const mm = Math.floor(rec.elapsed / 60), sss = rec.elapsed % 60;
  let html = `<div class="result-hero">`;
  if (rec.isFull) {
    html += `<div class="verdict ${rec.pass ? 'pass' : 'fail'}">${rec.pass ? '합격 예상 🎉' : '불합격'}</div>
      <div class="avg">제${rec.round}회 전과목 · ${rec.totalCorrect}/${rec.total}문제 정답${rec.elapsed ? ` · ${mm}분 ${sss}초` : ''}</div>`;
  } else {
    html += `<div class="verdict ${rec.avg >= 60 ? 'pass' : 'fail'}">${rec.avg}점</div>
      <div class="avg">제${rec.round}회 ${esc(ex.subjects[rec.si].name)} · ${rec.totalCorrect}/${rec.total}문제 정답</div>`;
  }
  html += `<div class="ring-wrap">${ringSVG(rec.avg, rec.pass)}</div></div>`;

  html += `<div class="card"><div class="score-bars">`;
  Object.keys(rec.scores).forEach((si) => {
    const v = rec.scores[si];
    const fail = rec.isFull && v < PASS.perSubjectMin;
    const color = fail ? 'var(--danger)' : SUBJECT_COLORS[si];
    html += `
      <div class="score-bar">
        <div class="top">
          <span class="nm">${esc(ex.subjects[si].name)}${fail ? '<span class="fail-flag">과락</span>' : ''}</span>
          <span class="sc">${v}<small>/100</small></span>
        </div>
        <div class="bar-track">
          <div class="fill" style="width:${v}%;background:${color}"></div>
          ${rec.isFull ? '<div class="cut" style="left:40%"></div>' : ''}
        </div>
      </div>`;
  });
  html += `</div>`;
  if (rec.isFull) html += `<p style="font-size:12.5px;color:var(--text-mute);margin:14px 0 0">합격기준: 전과목 평균 60점 이상 &amp; 과목별 40점 이상(과락 없음). 회색 선은 과락 기준선입니다.</p>`;
  html += `</div>`;

  html += `<div class="btn-row" style="margin-top:20px">
      <button class="btn" data-act="review">해설 보기</button>
      <button class="btn secondary" data-act="retry">다시 풀기</button>
    </div>
    <button class="btn ghost" style="margin-top:10px" data-act="home">홈으로</button>`;
  s.innerHTML = html;
  app.appendChild(s);
}

/* ---------- 해설 리뷰 ---------- */
function renderReview(app) {
  const p = App.view.params;
  const rec = p.rec;                     // 결과 기반 리뷰
  const custom = p.list;                 // 오답노트/즐겨찾기 기반 리뷰
  const onlyWrong = p.onlyWrong;

  app.appendChild(topbar('', { back: true, backLabel: '뒤로' }));
  const s = document.createElement('div');
  s.className = 'screen fade-in';

  let items = [];
  if (rec) {
    rec.order.forEach((o, i) => {
      const ex = exam(o.round);
      const q = ex.subjects[o.si].questions.find((x) => x.no === o.no);
      items.push({ q, si: o.si, round: o.round, subjName: ex.subjects[o.si].name, picked: rec.answers[i] });
    });
    if (onlyWrong) items = items.filter((it) => it.picked !== it.q.answer);
  } else if (custom) {
    custom.forEach((w) => {
      const ex = exam(w.round);
      const q = ex.subjects[w.si].questions.find((x) => x.no === w.no);
      if (q) items.push({ q, si: w.si, round: w.round, subjName: ex.subjects[w.si].name, picked: null });
    });
  }

  let head = `<div class="pagettl">${p.title || '해설'}</div>
    <p class="subttl">${items.length}문제${rec && !onlyWrong ? ` · <button class="chip" data-act="only-wrong" style="padding:5px 12px">틀린 문제만</button>` : ''}</p>`;
  let body = '';
  items.forEach((it) => {
    const { q, picked } = it;
    const bm = App.state.bookmarks.some((b) => keyOf(b.round, b.si, b.no) === keyOf(it.round, it.si, q.no));
    const acc = acceptOf(q);
    let opts = '';
    q.options.forEach((opt, i) => {
      const n = i + 1;
      let cls = '';
      if (acc.includes(n)) cls = 'correct';
      else if (picked === n) cls = 'wrong';
      opts += `<div class="option ${cls}"><span class="lbl">${CIRCLED[i]}</span><span>${esc(opt)}</span></div>`;
    });
    const ok = isCorrect(q, picked);
    const correctTxt = picked == null ? '' : (ok ? '✓ 정답' : `✗ 내 답: ${CIRCLED[picked - 1] || '-'}`);
    body += `
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span class="subject-tag" style="background:${SUBJECT_COLORS[it.si]}">${esc(it.subjName)} ${q.no}번</span>
          <span style="display:flex;gap:10px;align-items:center">
            ${correctTxt ? `<span style="font-size:13px;font-weight:700;color:${ok ? 'var(--success)' : 'var(--danger)'}">${correctTxt}</span>` : ''}
            <button class="icon-btn" style="width:34px;height:34px" data-bookmark="${it.round}-${it.si}-${q.no}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${bm ? 'var(--warn)' : 'none'}" stroke="${bm ? 'var(--warn)' : 'currentColor'}" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </span>
        </div>
        <div class="q-text" style="font-size:17px;margin-bottom:16px">${esc(q.q)}</div>
        <div class="options">${opts}</div>
        ${q.explanation
          ? `<div class="explain">
              <div class="hd">📘 해설</div>
              <p>${esc(q.explanation)}</p>
              ${q.examTip ? `<div class="tip">💡 ${esc(q.examTip)}</div>` : ''}
              ${q.relatedTopic ? `<div class="rel">관련 주제: <b>${esc(q.relatedTopic)}</b></div>` : ''}
            </div>`
          : `<div class="explain empty">이 문제의 해설은 준비 중입니다. (정답: ${acc.map((n) => CIRCLED[n - 1]).join(', ')})</div>`}
      </div>`;
  });
  if (!items.length) body = `<div class="empty-state">표시할 문제가 없습니다.</div>`;
  s.innerHTML = head + body;
  app.appendChild(s);
}

/* ---------- 진도 ---------- */
function renderProgress(app) {
  app.appendChild(topbar());
  const s = document.createElement('div');
  s.className = 'screen fade-in';
  const hist = App.state.history;
  let html = `<div class="pagettl">진도 현황</div><p class="subttl">응시 이력과 점수 추이</p>`;

  const fulls = hist.filter((h) => h.isFull);
  if (fulls.length) {
    const best = fulls.reduce((a, b) => (b.avg > a.avg ? b : a));
    const passed = fulls.filter((h) => h.pass).length;
    html += `<div class="card"><div class="score-bars" style="gap:16px">
      <div style="display:flex;justify-content:space-around;text-align:center">
        <div><div style="font-size:28px;font-weight:800">${fulls.length}</div><div style="font-size:12px;color:var(--text-dim)">모의고사 응시</div></div>
        <div><div style="font-size:28px;font-weight:800;color:var(--primary)">${best.avg}</div><div style="font-size:12px;color:var(--text-dim)">최고 평균점</div></div>
        <div><div style="font-size:28px;font-weight:800;color:var(--success)">${passed}</div><div style="font-size:12px;color:var(--text-dim)">합격 판정</div></div>
      </div></div>`;
  }

  html += `<div class="section-label">응시 이력</div>`;
  if (!hist.length) {
    html += `<div class="empty-state">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <p>아직 응시 기록이 없습니다.<br>홈에서 기출문제를 풀어보세요!</p></div>`;
  } else {
    html += `<div class="card">`;
    hist.slice(0, 30).forEach((h, i) => {
      const ex = exam(h.round);
      const d = new Date(h.date);
      const label = h.isFull ? '전과목' : esc(ex.subjects[h.si].name);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      html += `<div class="hist-row" data-hist="${i}">
        <div class="d"><b>제${h.round}회 · ${label}</b><span>${dateStr} · ${h.totalCorrect}/${h.total} 정답</span></div>
        ${h.isFull ? `<span class="badge ${h.pass ? 'pass' : 'fail'}">${h.pass ? '합격' : '불합'}</span>` : ''}
        <span class="sc" style="color:${h.avg >= 60 ? 'var(--success)' : 'var(--danger)'}">${h.avg}점</span>
      </div>`;
    });
    html += `</div>`;
  }
  s.innerHTML = html;
  app.appendChild(s);
  app.appendChild(tabbar('progress'));
}

/* ---------- 오답노트 · 즐겨찾기 ---------- */
function renderBookmarks(app) {
  app.appendChild(topbar());
  const s = document.createElement('div');
  s.className = 'screen fade-in';
  const wrong = App.state.wrong, book = App.state.bookmarks;
  let html = `<div class="pagettl">오답노트 · 즐겨찾기</div><p class="subttl">복습이 필요한 문제를 모았습니다</p>`;

  html += `<div class="card" style="display:flex;justify-content:space-between;align-items:center">
      <div><b style="font-size:17px">오답노트</b><div style="font-size:13px;color:var(--text-dim)">틀린 문제 ${wrong.length}개</div></div>
      <div class="btn-row" style="width:auto">
        ${wrong.length ? `<button class="btn" style="width:auto;padding:11px 16px" data-act="retry-wrong">다시 풀기</button>
        <button class="btn secondary" style="width:auto;padding:11px 16px" data-act="review-wrong">해설</button>` : '<span style="color:var(--text-mute);font-size:14px">없음</span>'}
      </div>
    </div>`;
  html += `<div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
      <div><b style="font-size:17px">즐겨찾기</b><div style="font-size:13px;color:var(--text-dim)">표시한 문제 ${book.length}개</div></div>
      ${book.length ? `<button class="btn secondary" style="width:auto;padding:11px 16px" data-act="review-book">해설 보기</button>` : '<span style="color:var(--text-mute);font-size:14px">없음</span>'}
    </div>`;

  s.innerHTML = html;
  app.appendChild(s);
  app.appendChild(tabbar('bookmarks'));
}

/* 오답노트로 시험 세트 만들기 */
function startWrongExam() {
  const list = App.state.wrong.slice();
  if (!list.length) return toast('오답이 없습니다');
  App.state.session = {
    round: list[0].round, mode: 'wrong', si: 0, timer: false,
    order: list.map((w) => ({ round: w.round, si: w.si, no: w.no })),
    answers: new Array(list.length).fill(null),
    flags: new Array(list.length).fill(false),
    index: 0, startedAt: Date.now(), elapsed: 0,
  };
  saveState();
  go('quiz');
}

/* ---------- 이벤트 위임 ---------- */
document.addEventListener('click', (e) => {
  const t = e.target;
  const act = t.closest('[data-act]')?.dataset.act;
  const v = App.view;

  // 테마
  if (act === 'theme') {
    App.state.theme = App.state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', App.state.theme);
    saveState(); render(); return;
  }
  if (act === 'back') { history.length > 1 ? go('home') : go('home'); return; }

  // 탭바
  const tab = t.closest('[data-tab]')?.dataset.tab;
  if (tab) { go(tab); return; }

  // 홈: 회차 선택
  const rc = t.closest('[data-round]');
  if (rc && v.name === 'home') { go('config', { round: +rc.dataset.round }); return; }

  // 홈: 이어풀기/삭제
  if (act === 'resume') { if (App.state.session) App.state.session.startedAt = Date.now(); saveState(); go('quiz'); return; }
  if (act === 'discard') { if (confirm('진행중인 시험을 삭제할까요?')) { App.state.session = null; saveState(); render(); } return; }

  // config
  if (v.name === 'config') {
    const md = t.closest('[data-mode]')?.dataset.mode;
    if (md) { v.params.mode = md; render(); return; }
    const si = t.closest('[data-si]')?.dataset.si;
    if (si != null) { v.params.si = +si; render(); return; }
    if (act === 'toggle-timer') { v.params.timer = !v.params.timer; render(); return; }
    if (act === 'start') { startExam(v.params.round, v.params.mode, v.params.si, v.params.timer); return; }
  }

  // quiz
  if (v.name === 'quiz') {
    const ss = App.state.session;
    const opt = t.closest('[data-opt]');
    if (opt) {
      ss.answers[ss.index] = +opt.dataset.opt; saveState();
      // 자동 다음 (마지막 아니면)
      if (ss.index < ss.order.length - 1) { setTimeout(() => { ss.index++; render(); }, 180); }
      else render();
      return;
    }
    if (act === 'next') { ss.index = Math.min(ss.index + 1, ss.order.length - 1); render(); return; }
    if (act === 'prev') { ss.index = Math.max(ss.index - 1, 0); render(); return; }
    if (act === 'flag') { ss.flags[ss.index] = !ss.flags[ss.index]; saveState(); render(); return; }
    if (act === 'grid') { openGrid(); return; }
    if (act === 'submit') { submitExam(); return; }
    if (act === 'exit') {
      if (confirm('나가면 진행상황은 저장됩니다. 홈으로 갈까요?')) {
        if (ss.timer) { ss.elapsed += Math.floor((Date.now() - ss.startedAt) / 1000); ss.startedAt = Date.now(); }
        clearInterval(timerInt); saveState(); go('home');
      }
      return;
    }
  }

  // result
  if (v.name === 'result') {
    const rec = v.params.rec || App.state.history[0];
    if (act === 'review') { go('review', { rec, title: `제${rec.round}회 해설` }); return; }
    if (act === 'retry') { rec.mode === 'wrong' ? startWrongExam() : startExam(rec.round, rec.mode, rec.si, false); return; }
    if (act === 'home') { go('home'); return; }
  }

  // review
  if (v.name === 'review') {
    if (act === 'only-wrong') { go('review', { ...v.params, onlyWrong: true }); return; }
    const bm = t.closest('[data-bookmark]');
    if (bm) {
      const [r, si, no] = bm.dataset.bookmark.split('-').map(Number);
      const k = keyOf(r, si, no);
      const idx = App.state.bookmarks.findIndex((b) => keyOf(b.round, b.si, b.no) === k);
      if (idx >= 0) { App.state.bookmarks.splice(idx, 1); toast('즐겨찾기 해제'); }
      else { App.state.bookmarks.push({ round: r, si, no }); toast('즐겨찾기 추가'); }
      saveState(); render(); return;
    }
  }

  // progress: 이력 클릭 → 리뷰
  const hi = t.closest('[data-hist]');
  if (hi) { const rec = App.state.history[+hi.dataset.hist]; if (rec) go('review', { rec, title: `제${rec.round}회 해설` }); return; }

  // bookmarks
  if (v.name === 'bookmarks') {
    if (act === 'retry-wrong') { startWrongExam(); return; }
    if (act === 'review-wrong') { go('review', { list: App.state.wrong, title: '오답노트 해설' }); return; }
    if (act === 'review-book') { go('review', { list: App.state.bookmarks, title: '즐겨찾기 해설' }); return; }
  }
});

/* ---------- 부팅 ---------- */
async function boot() {
  loadState();
  try {
    const res = await fetch('data/exams.json');
    App.data = await res.json();
  } catch (e) {
    $('#app').innerHTML = `<div class="empty-state" style="padding-top:120px">데이터를 불러오지 못했습니다.<br><small>${esc(e.message)}</small></div>`;
    return;
  }
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
