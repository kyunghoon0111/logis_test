/**
 * quizCard.js - 퀴즈 문제 렌더러
 */
import { highlightSQL } from './conceptCard.js';

/**
 * @param {object} quiz - 정규화된 퀴즈 객체
 * @param {function} onAnswer - (quizId, answer, correct) => void
 * @param {boolean} answered - 이미 답한 경우 결과 표시
 * @param {string|null} chosenAnswer - 선택된 답
 */
export function renderQuizCard(quiz, onAnswer, answered = false, chosenAnswer = null) {
  const el = document.createElement('div');
  el.className = 'quiz-card-wrap';

  // 문제 텍스트 (SQL 블록 포함 가능)
  const questionHtml = renderQuestionText(quiz.question);

  el.innerHTML = `
    <div class="quiz-meta">
      <span class="chip chip-diff-${quiz.difficulty}">${['', '초급', '중급', '고급'][quiz.difficulty]}</span>
      <span class="chip chip-gray">${quiz.type === 'exam' ? '실전' : '개념'}</span>
      ${quiz.topic ? `<span class="chip chip-gray">${quiz.topic}</span>` : ''}
    </div>
    <div class="quiz-question-text">${questionHtml}</div>
    <div id="quiz-options"></div>
    <div id="quiz-explanation"></div>
  `;

  const optionsEl = el.querySelector('#quiz-options');
  const explEl    = el.querySelector('#quiz-explanation');

  if (quiz.format === 'ox') {
    renderOX(quiz, optionsEl, explEl, onAnswer, answered, chosenAnswer);
  } else {
    renderMC(quiz, optionsEl, explEl, onAnswer, answered, chosenAnswer);
  }

  return el;
}

/* ===== 객관식 ===== */
function renderMC(quiz, optionsEl, explEl, onAnswer, answered, chosen) {
  optionsEl.innerHTML = quiz.options.map((opt, i) => {
    const letter = ['A','B','C','D','E'][i];
    let cls = 'quiz-option';
    if (answered) {
      if (letter === quiz.answer) cls += ' correct';
      else if (letter === chosen && letter !== quiz.answer) cls += ' incorrect';
      else cls += ' dimmed';
    }
    return `
      <button class="${cls}" data-letter="${letter}">
        <span class="opt-label">${letter}</span>
        <span class="opt-text">${escHtml(opt.replace(/^[A-E]\.\s*/,''))}</span>
      </button>
    `;
  }).join('');

  if (!answered) {
    optionsEl.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const letter = btn.dataset.letter;
        const correct = letter === quiz.answer;

        // 상태 반영
        optionsEl.querySelectorAll('.quiz-option').forEach(b => {
          const l = b.dataset.letter;
          if (l === quiz.answer) b.classList.add('correct');
          else if (l === letter && !correct) b.classList.add('incorrect');
          else b.classList.add('dimmed');
          b.disabled = true;
        });

        showExplanation(explEl, quiz, correct);
        onAnswer?.(quiz.id, letter, correct);
      });
    });
  } else if (answered) {
    showExplanation(explEl, quiz, chosen === quiz.answer);
  }
}

/* ===== OX ===== */
function renderOX(quiz, optionsEl, explEl, onAnswer, answered, chosen) {
  optionsEl.innerHTML = `
    <div class="ox-wrap">
      <button class="ox-btn ox-o${answered && quiz.answer === 'O' ? ' correct' : ''}${answered && chosen === 'O' && quiz.answer !== 'O' ? ' incorrect' : ''}" data-ans="O">
        <span>⭕</span>
        <span class="ox-btn-label">맞다</span>
      </button>
      <button class="ox-btn ox-x${answered && quiz.answer === 'X' ? ' correct' : ''}${answered && chosen === 'X' && quiz.answer !== 'X' ? ' incorrect' : ''}" data-ans="X">
        <span>❌</span>
        <span class="ox-btn-label">틀리다</span>
      </button>
    </div>
  `;

  if (!answered) {
    optionsEl.querySelectorAll('.ox-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ans = btn.dataset.ans;
        const correct = ans === quiz.answer;

        optionsEl.querySelectorAll('.ox-btn').forEach(b => {
          b.disabled = true;
          if (b.dataset.ans === quiz.answer) b.classList.add(quiz.answer === 'O' ? 'correct' : 'correct');
          else if (b.dataset.ans === ans && !correct) b.classList.add('incorrect');
        });

        showExplanation(explEl, quiz, correct);
        onAnswer?.(quiz.id, ans, correct);
      });
    });
  } else if (answered) {
    showExplanation(explEl, quiz, chosen === quiz.answer);
  }
}

/* ===== 해설 표시 ===== */
function showExplanation(el, quiz, correct) {
  el.innerHTML = `
    <div class="explanation-box explanation-appear">
      <div class="explanation-result ${correct ? 'correct' : 'incorrect'}">
        ${correct ? '✅ 정답!' : '❌ 오답'}
      </div>
      <div class="explanation-text">${escHtml(quiz.explanation)}</div>
      ${quiz.examTip ? `
        <div class="exam-tip-box">
          💡 <strong>시험 팁:</strong> ${escHtml(quiz.examTip)}
        </div>
      ` : ''}
    </div>
  `;
}

/* ===== 문제 텍스트 렌더링 ===== */
function renderQuestionText(text) {
  if (!text) return '';
  return escHtml(text).replace(/\n/g, '<br>');
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
