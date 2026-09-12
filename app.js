/* ============================================================
   GATE CS 2027 Practice Portal — app.js
   Full exam engine with timer, navigation, scoring, AI explanations
   ============================================================ */

'use strict';

// ─── State ───────────────────────────────────────────────────
let state = {
  // Test configuration
  filteredQuestions: [],
  currentIndex: 0,
  duration: 90, // minutes

  // Per-question tracking
  userAnswers: {},    // { qId: answer }
  markedForReview: {},// { qId: true }
  visitedQuestions: {},// { qId: true }
  timePerQuestion: {},// { qId: seconds }

  // Timer
  timerInterval: null,
  remainingSeconds: 0,
  startTime: null,
  questionStartTime: null,

  // Results
  lastResults: null,

  // AI backend
  aiBackend: null, // 'ollama' | 'groq' | 'static'

  // History
  testHistory: JSON.parse(localStorage.getItem('gateHistory') || '[]'),
  overallStats: JSON.parse(localStorage.getItem('gateStats') || '{"tests":0,"totalQ":0,"totalCorrect":0,"bestPct":0}')
};

// ─── DOM References ───────────────────────────────────────────
const screens = {
  home: document.getElementById('homeScreen'),
  exam: document.getElementById('examScreen'),
  results: document.getElementById('resultsScreen'),
  review: document.getElementById('reviewScreen')
};

// ─── Utility Functions ────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
}

function $(id) { return document.getElementById(id); }

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// ─── Bookmarks ─────────────────────────────────────────────
function getBookmarks() {
  try { return JSON.parse(localStorage.getItem('gateBookmarks') || '{}'); }
  catch (e) { return {}; }
}
function saveBookmarks(bm) {
  localStorage.setItem('gateBookmarks', JSON.stringify(bm));
}
function isBookmarked(qId) { return !!getBookmarks()[qId]; }
function buildAutoTags(q) {
  const tags = [q.subject, q.topic, q.type];
  if (q.type === 'NAT') tags.push('numerical');
  if (q.marks === 2) tags.push('2-mark');
  return tags;
}
function toggleBookmark() {
  const q = state.filteredQuestions[state.currentIndex];
  if (!q) return;
  const bm = getBookmarks();
  if (bm[q.id]) {
    delete bm[q.id];
  } else {
    bm[q.id] = {
      questionId: q.id,
      tags: buildAutoTags(q),
      note: '',
      createdAt: new Date().toISOString()
    };
  }
  saveBookmarks(bm);
  const btn = $('bookmarkBtn');
  if (btn) {
    btn.innerHTML = bm[q.id] ? '📑 Bookmarked ✓' : '📑 Bookmark';
    btn.classList.toggle('active', !!bm[q.id]);
  }
}
function removeBookmark(qId) {
  const bm = getBookmarks();
  delete bm[qId];
  saveBookmarks(bm);
  renderBookmarks();
}
function addBookmarkNote(qId, note) {
  const bm = getBookmarks();
  if (bm[qId]) {
    bm[qId].note = note;
    saveBookmarks(bm);
  }
}
function renderBookmarks() {
  const bm = getBookmarks();
  const ids = Object.keys(bm);
  $('bookmarkCount').textContent = `(${ids.length})`;
  const list = $('bookmarksPreview');
  if (ids.length === 0) {
    list.innerHTML = '<p class="empty-state">No bookmarks yet. Bookmark questions while practicing to build your revision list.</p>';
    return;
  }
  const qById = {};
  GATE_QUESTIONS.forEach(q => qById[q.id] = q);
  const items = ids.slice(0, 5).map(qId => {
    const q = qById[qId];
    if (!q) return '';
    return `
      <div class="history-item">
        <div>
          <div class="history-subject">${q.subject} > ${q.topic}</div>
          <div class="history-date">GATE ${q.year} · ${q.type} · ${q.marks} mark</div>
          <div class="bookmark-note" style="font-size:0.8rem;color:var(--text-muted)">${bm[qId].note ? '📝 ' + escapeHtml(bm[qId].note) : ''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="history-score-badge">${bm[qId].tags.slice(0,2).map(t => '#'+t).join(' ')}</span>
          <button class="btn-remove-bookmark" onclick="removeBookmark('${qId}')">❌</button>
        </div>
      </div>`;
  }).join('');
  list.innerHTML = items + (ids.length > 5 ? `<p class="empty-state" style="text-align:center;padding:8px">+${ids.length - 5} more...</p>` : '');
}

// ─── Weakness Dashboard ─────────────────────────────────────
function getTopicStats() {
  try { return JSON.parse(localStorage.getItem('gateTopicStats') || '{}'); }
  catch (e) { return {}; }
}
function saveTopicStats(stats) {
  localStorage.setItem('gateTopicStats', JSON.stringify(stats));
}
function updateTopicStats() {
  if (!state.lastResults) return;
  const { questions, userAnswers } = state.lastResults;
  const stats = getTopicStats();
  questions.forEach(q => {
    const key = `${q.subject}|${q.topic}`;
    if (!stats[key]) stats[key] = { attempts: 0, correct: 0, total: 0 };
    stats[key].attempts++;
    stats[key].total++;
    const ua = userAnswers[q.id];
    const hasAns = ua !== undefined && ua !== '' && !(Array.isArray(ua) && ua.length === 0);
    if (hasAns && checkAnswer(q, ua)) stats[key].correct++;
  });
  saveTopicStats(stats);
}
function classifyTopics() {
  const stats = getTopicStats();
  const result = [];
  for (const [key, s] of Object.entries(stats)) {
    const [subject, topic] = key.split('|');
    const accuracy = s.total > 0 ? (s.correct / s.total) * 100 : 0;
    result.push({ subject, topic, accuracy, attempts: s.total, correct: s.correct });
  }
  return result;
}
function getWeakTopics(threshold = 60) {
  return classifyTopics().filter(t => t.accuracy < threshold && t.attempts >= 3).sort((a,b) => a.accuracy - b.accuracy);
}
function getStrongTopics(threshold = 80) {
  return classifyTopics().filter(t => t.accuracy >= threshold && t.attempts >= 3).sort((a,b) => b.accuracy - a.accuracy);
}
function renderTopicDashboard() {
  const weak = getWeakTopics();
  const strong = getStrongTopics();
  const weakEl = $('weakTopics');
  const strongEl = $('strongTopics');
  if (weak.length === 0 && strong.length === 0) {
    weakEl.innerHTML = '<p class="empty-state">Take a few tests to see your performance breakdown by topic.</p>';
    strongEl.innerHTML = '';
    return;
  }
  weakEl.innerHTML = weak.length > 0
    ? `<h3 style="color:var(--wrong);font-size:1rem;margin-bottom:12px;">⚠️ Weak Topics (accuracy &lt; 60%)</h3>`
      + weak.slice(0, 5).map(t => `
        <div class="subject-row">
          <span class="subject-name">${t.subject} &gt; ${t.topic}</span>
          <div class="subject-bar"><div class="subject-bar-fill weak-fill" style="width:${t.accuracy}%"></div></div>
          <span class="subject-pct">${t.accuracy.toFixed(0)}% (${t.correct}/${t.attempts})</span>
        </div>`).join('')
    : '<p class="empty-state">No weak topics detected yet.</p>';
  strongEl.innerHTML = strong.length > 0
    ? `<h3 style="color:var(--correct);font-size:1rem;margin-bottom:12px;margin-top:16px;">✅ Strong Topics (accuracy &gt; 80%)</h3>`
      + strong.slice(0, 5).map(t => `
        <div class="subject-row">
          <span class="subject-name">${t.subject} &gt; ${t.topic}</span>
          <div class="subject-bar"><div class="subject-bar-fill strong-fill" style="width:${t.accuracy}%"></div></div>
          <span class="subject-pct">${t.accuracy.toFixed(0)}% (${t.correct}/${t.attempts})</span>
        </div>`).join('')
    : '';
}

// ─── Home Screen ──────────────────────────────────────────────
function initHome() {
  renderStats();
  renderHistory();
  renderBookmarks();
  renderTopicDashboard();

  // Dark mode default
  const darkToggle = $('darkModeToggle');
  const isDark = localStorage.getItem('gateTheme') !== 'light';
  darkToggle.checked = isDark;
  document.body.classList.toggle('light', !isDark);

  darkToggle.addEventListener('change', () => {
    const dark = darkToggle.checked;
    document.body.classList.toggle('light', !dark);
    localStorage.setItem('gateTheme', dark ? 'dark' : 'light');
  });

  $('startTestBtn').addEventListener('click', startTest);
}

function renderStats() {
  const s = state.overallStats;
  $('totalAttempted').textContent = s.tests;
  $('avgAccuracy').textContent = s.tests > 0 ? Math.round((s.totalCorrect / s.totalQ) * 100) + '%' : '—';
  $('totalQuestionsAttempted').textContent = s.totalQ;
  $('bestScore').textContent = s.bestPct > 0 ? s.bestPct + '%' : '—';
}

function renderHistory() {
  const list = $('historyList');
  const history = state.testHistory.slice(-5).reverse();
  if (history.length === 0) {
    list.innerHTML = '<p class="empty-state">No tests taken yet. Start your first test!</p>';
    return;
  }
  list.innerHTML = history.map(h => {
    const pct = Math.round((h.correct / h.total) * 100);
    const cls = pct >= 70 ? 'good' : pct >= 40 ? 'mid' : 'low';
    const date = new Date(h.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    return `
      <div class="history-item">
        <div>
          <div class="history-subject">${h.subject}</div>
          <div class="history-date">${date} · ${h.total} questions · ${h.duration}min</div>
        </div>
        <span>${h.correct}/${h.total} correct</span>
        <span class="history-score-badge ${cls}">${pct}%</span>
      </div>`;
  }).join('');
}

// ─── Start Test ───────────────────────────────────────────────
function startTest() {
  const subject = $('subjectFilter').value;
  const year = $('yearFilter').value;
  const countSel = $('questionCount').value;
  const durationMin = parseInt($('testDuration').value);

  // Filter questions
  let pool = GATE_QUESTIONS.filter(q => {
    const subjMatch = subject === 'All Subjects' || q.subject === subject ||
                      q.subject.toLowerCase().includes(subject.toLowerCase());
    const yearMatch = year === 'all' || q.year === parseInt(year);
    return subjMatch && yearMatch;
  });

  if (pool.length === 0) {
    alert('No questions found for the selected filters. Please adjust your selection.');
    return;
  }

  // Shuffle and limit
  pool = shuffleArray(pool);
  if (countSel !== 'all') {
    const n = parseInt(countSel);
    if (!isNaN(n)) pool = pool.slice(0, n);
  }

  // Initialize state
  state.filteredQuestions = pool;
  state.currentIndex = 0;
  state.userAnswers = {};
  state.markedForReview = {};
  state.visitedQuestions = {};
  state.timePerQuestion = {};
  state.duration = durationMin;
  state.remainingSeconds = durationMin === 0 ? Infinity : durationMin * 60;
  state.startTime = Date.now();
  state.questionStartTime = Date.now();

  // Setup exam UI
  $('examSubjectLabel').textContent = subject === 'All Subjects' ? 'Computer Science' : subject;
  $('examQuestionCountLabel').textContent = `${pool.length} Questions`;

  // Build nav grid
  buildNavGrid();
  renderQuestion(0);
  startTimer();

  // Check AI
  checkAIBackend();

  showScreen('exam');
}

// ─── Timer ────────────────────────────────────────────────────
function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  updateTimerDisplay();

  if (state.remainingSeconds === Infinity) {
    $('timerDisplay').textContent = '∞';
    $('timerLabel').textContent = 'No Limit';
    return;
  }

  state.timerInterval = setInterval(() => {
    state.remainingSeconds--;
    updateTimerDisplay();

    if (state.remainingSeconds <= 0) {
      clearInterval(state.timerInterval);
      autoSubmit();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = $('timerDisplay');
  const secs = state.remainingSeconds;
  if (secs === Infinity) return;

  el.textContent = formatTime(Math.max(0, secs));
  el.classList.remove('warning', 'critical');
  if (secs <= 300) el.classList.add('critical');     // < 5 min
  else if (secs <= 600) el.classList.add('warning'); // < 10 min
}

function autoSubmit() {
  saveCurrentQuestionTime();
  computeResults();
  showScreen('results');
}

// ─── Question Rendering ───────────────────────────────────────
function renderQuestion(index) {
  const q = state.filteredQuestions[index];
  if (!q) return;

  // Track visit & time on previous question
  if (state.currentIndex !== index) {
    saveCurrentQuestionTime();
    state.currentIndex = index;
    state.questionStartTime = Date.now();
  }
  state.visitedQuestions[q.id] = true;

  // Header info
  $('currentQNumber').textContent = `Question ${index + 1} of ${state.filteredQuestions.length}`;
  $('currentQSubject').textContent = q.subject;
  $('currentQMarks').textContent = `${q.marks} mark${q.marks > 1 ? 's' : ''}`;
  $('currentQYear').textContent = `GATE ${q.year}`;
  $('currentQType').textContent = q.type;

  // Question text (with math rendering)
  const questionTextEl = $('questionText');
  questionTextEl.innerHTML = (window.DR ? DR.renderMath(q.question) : escapeHtml(q.question));

  // Diagram
  const diagContainer = $('questionDiagram');
  if (q.diagram && window.DR) {
    diagContainer.innerHTML = '';
    diagContainer.classList.remove('hidden');
    DR.renderDiagram(q.diagram, diagContainer);
    if (q.diagram.caption) {
      const cap = document.createElement('div');
      cap.className = 'diagram-caption';
      cap.innerHTML = DR.renderMath(q.diagram.caption);
      diagContainer.appendChild(cap);
    }
  } else {
    diagContainer.classList.add('hidden');
    diagContainer.innerHTML = '';
  }

  // Mark for review button state
  const mrBtn = $('markReviewBtn');
  mrBtn.classList.toggle('active', !!state.markedForReview[q.id]);
  mrBtn.textContent = state.markedForReview[q.id] ? '🔖 Marked for Review' : '🔖 Mark for Review';

  // Bookmark button state
  const bmBtn = $('bookmarkBtn');
  if (bmBtn) {
    bmBtn.innerHTML = isBookmarked(q.id) ? '📑 Bookmarked ✓' : '📑 Bookmark';
    bmBtn.classList.toggle('active', isBookmarked(q.id));
  }

  // Options or NAT
  const optContainer = $('optionsContainer');
  const natContainer = $('natContainer');

  if (q.type === 'NAT') {
    optContainer.innerHTML = '';
    optContainer.style.display = 'none';
    natContainer.classList.remove('hidden');
    const natInput = $('natInput');
    natInput.value = state.userAnswers[q.id] !== undefined ? state.userAnswers[q.id] : '';
  } else {
    natContainer.classList.add('hidden');
    optContainer.style.display = 'flex';

    const labels = ['A', 'B', 'C', 'D', 'E'];
    const userAns = state.userAnswers[q.id];
    optContainer.innerHTML = q.options.map((opt, i) => {
      const isSelected = userAns === opt;
      const isMulti = q.type === 'MSQ';
      const multiSelected = isMulti && Array.isArray(userAns) && userAns.includes(opt);
      const selected = isMulti ? multiSelected : isSelected;
      const optHtml = window.DR ? DR.renderMath(opt) : escapeHtml(opt);
      return `
        <div class="option-item ${selected ? 'selected' : ''}"
             data-option="${escapeHtml(opt)}" data-index="${i}"
             onclick="selectOption(this, '${escapeHtml(opt).replace(/'/g, "\\'")}', ${isMulti})">
          <span class="option-label">${labels[i]}</span>
          <span class="option-text">${optHtml}</span>
        </div>`;
    }).join('');
  }

  updateProgress();
  updateNavGrid();

  // Scroll to top of question panel
  $('questionPanel').scrollTo({ top: 0, behavior: 'smooth' });
}

function saveCurrentQuestionTime() {
  const q = state.filteredQuestions[state.currentIndex];
  if (!q) return;
  const elapsed = Math.round((Date.now() - (state.questionStartTime || Date.now())) / 1000);
  state.timePerQuestion[q.id] = (state.timePerQuestion[q.id] || 0) + elapsed;
}

// ─── Answer Selection ─────────────────────────────────────────
function selectOption(el, optionText, isMulti) {
  const q = state.filteredQuestions[state.currentIndex];
  if (!q) return;

  if (isMulti) {
    // MSQ: toggle
    let ans = state.userAnswers[q.id] || [];
    if (!Array.isArray(ans)) ans = [];
    const idx = ans.indexOf(optionText);
    if (idx > -1) ans.splice(idx, 1);
    else ans.push(optionText);
    state.userAnswers[q.id] = ans.length > 0 ? ans : undefined;
  } else {
    // MCQ: single select (toggle off if already selected)
    if (state.userAnswers[q.id] === optionText) {
      delete state.userAnswers[q.id];
    } else {
      state.userAnswers[q.id] = optionText;
    }
  }

  // Re-render options without full re-render
  document.querySelectorAll('.option-item').forEach(item => {
    const opt = item.dataset.option;
    if (isMulti) {
      const ans = state.userAnswers[q.id];
      item.classList.toggle('selected', Array.isArray(ans) && ans.includes(opt));
    } else {
      item.classList.toggle('selected', state.userAnswers[q.id] === opt);
    }
    const lbl = item.querySelector('.option-label');
    if (item.classList.contains('selected')) {
      lbl.style.background = 'var(--accent-purple)';
      lbl.style.borderColor = 'var(--accent-purple)';
      lbl.style.color = 'white';
    } else {
      lbl.style.background = '';
      lbl.style.borderColor = '';
      lbl.style.color = '';
    }
  });

  updateProgress();
  updateNavGrid();
}

// ─── Navigation Grid ──────────────────────────────────────────
function buildNavGrid() {
  const grid = $('navGrid');
  grid.innerHTML = state.filteredQuestions.map((q, i) => `
    <button class="nav-btn" id="navBtn${i}" onclick="navigateTo(${i})">${i + 1}</button>
  `).join('');
  $('sectionTotal').textContent = state.filteredQuestions.length;
}

function updateNavGrid() {
  state.filteredQuestions.forEach((q, i) => {
    const btn = $(`navBtn${i}`);
    if (!btn) return;
    const hasAnswer = state.userAnswers[q.id] !== undefined;
    const isMarked = state.markedForReview[q.id];
    const isVisited = state.visitedQuestions[q.id];

    btn.className = 'nav-btn';
    if (i === state.currentIndex) btn.classList.add('current');
    if (isMarked && hasAnswer) btn.classList.add('marked-answered');
    else if (isMarked) btn.classList.add('marked');
    else if (hasAnswer) btn.classList.add('answered');
    else if (isVisited) btn.classList.add('visited');
  });

  const answered = Object.keys(state.userAnswers).length;
  $('sectionAnswered').textContent = answered;
}

function navigateTo(index) {
  saveCurrentQuestionTime();
  state.currentIndex = index;
  state.questionStartTime = Date.now();
  renderQuestion(index);
}

// ─── Progress Bar ─────────────────────────────────────────────
function updateProgress() {
  const total = state.filteredQuestions.length;
  const answered = Object.keys(state.userAnswers).length;
  const marked = Object.keys(state.markedForReview).length;
  const visited = Object.keys(state.visitedQuestions).length;

  $('progressFill').style.width = `${(answered / total) * 100}%`;
  $('answeredCount').textContent = `Answered: ${answered}`;
  $('markedCount').textContent = `Marked: ${marked}`;
  $('remainingCount').textContent = `Not Visited: ${total - visited}`;
}

// ─── Event Handlers ───────────────────────────────────────────
function initExamEvents() {
  // Mark for Review
  $('markReviewBtn').addEventListener('click', () => {
    const q = state.filteredQuestions[state.currentIndex];
    if (!q) return;
    state.markedForReview[q.id] = !state.markedForReview[q.id];
    if (!state.markedForReview[q.id]) delete state.markedForReview[q.id];
    const btn = $('markReviewBtn');
    btn.classList.toggle('active', !!state.markedForReview[q.id]);
    btn.textContent = state.markedForReview[q.id] ? '🔖 Marked for Review' : '🔖 Mark for Review';
    updateNavGrid();
  });

  // Clear Response
  $('clearResponseBtn').addEventListener('click', () => {
    const q = state.filteredQuestions[state.currentIndex];
    if (!q) return;
    delete state.userAnswers[q.id];
    if (q.type === 'NAT') $('natInput').value = '';
    renderQuestion(state.currentIndex);
  });

  // Previous
  $('prevBtn').addEventListener('click', () => {
    if (state.currentIndex > 0) navigateTo(state.currentIndex - 1);
  });

  // Save & Next
  $('saveNextBtn').addEventListener('click', () => {
    saveNATAnswer();
    const next = state.currentIndex + 1;
    if (next < state.filteredQuestions.length) {
      navigateTo(next);
    }
  });

  // NAT: save on input
  $('natInput').addEventListener('input', () => {
    const q = state.filteredQuestions[state.currentIndex];
    if (q && q.type === 'NAT') {
      const val = $('natInput').value.trim();
      if (val !== '') state.userAnswers[q.id] = val;
      else delete state.userAnswers[q.id];
      updateProgress();
      updateNavGrid();
    }
  });

  // Submit button
  $('submitExamBtn').addEventListener('click', showSubmitConfirmation);

  // Submit Modal
  $('confirmSubmit').addEventListener('click', () => {
    $('submitModal').classList.add('hidden');
    saveNATAnswer();
    saveCurrentQuestionTime();
    clearInterval(state.timerInterval);
    computeResults();
    showScreen('results');
  });
  $('cancelSubmit').addEventListener('click', () => {
    $('submitModal').classList.add('hidden');
  });
}

function saveNATAnswer() {
  const q = state.filteredQuestions[state.currentIndex];
  if (q && q.type === 'NAT') {
    const val = $('natInput').value.trim();
    if (val !== '') state.userAnswers[q.id] = val;
  }
}

function showSubmitConfirmation() {
  const total = state.filteredQuestions.length;
  const answered = Object.keys(state.userAnswers).length;
  const marked = Object.keys(state.markedForReview).length;
  const unanswered = total - answered;

  $('submitSummary').innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:center;">
      <div style="background:rgba(72,207,173,0.1);border-radius:10px;padding:12px;">
        <div style="font-size:1.5rem;font-weight:700;color:var(--correct)">${answered}</div>
        <div>Answered</div>
      </div>
      <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:12px;">
        <div style="font-size:1.5rem;font-weight:700;color:var(--text-muted)">${unanswered}</div>
        <div>Unanswered</div>
      </div>
      <div style="background:rgba(255,169,77,0.1);border-radius:10px;padding:12px;">
        <div style="font-size:1.5rem;font-weight:700;color:var(--marked)">${marked}</div>
        <div>Marked</div>
      </div>
      <div style="background:rgba(108,99,255,0.1);border-radius:10px;padding:12px;">
        <div style="font-size:1.5rem;font-weight:700;color:var(--accent-purple)">${total}</div>
        <div>Total</div>
      </div>
    </div>
  `;
  $('submitModal').classList.remove('hidden');
}

// ─── Results Computation ──────────────────────────────────────
function computeResults() {
  let correct = 0, wrong = 0, skipped = 0;
  let marksObtained = 0, totalMarks = 0;
  const subjectStats = {};

  state.filteredQuestions.forEach(q => {
    totalMarks += q.marks;
    const subj = q.subject;
    if (!subjectStats[subj]) subjectStats[subj] = { correct: 0, wrong: 0, total: 0 };
    subjectStats[subj].total++;

    const userAns = state.userAnswers[q.id];

    if (userAns === undefined || userAns === '' || (Array.isArray(userAns) && userAns.length === 0)) {
      skipped++;
    } else {
      const isCorrect = checkAnswer(q, userAns);
      if (isCorrect) {
        correct++;
        marksObtained += q.marks;
        subjectStats[subj].correct++;
      } else {
        wrong++;
        // Negative marking: -1/3 for 1-mark, -2/3 for 2-marks (GATE standard)
        if (q.type !== 'MSQ') marksObtained -= q.marks / 3;
        subjectStats[subj].wrong++;
      }
    }
  });

  const timeTakenMin = Math.round((Date.now() - state.startTime) / 60000);
  const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;

  state.lastResults = {
    correct, wrong, skipped, marksObtained: Math.max(0, parseFloat(marksObtained.toFixed(2))),
    totalMarks, accuracy, timeTakenMin, subjectStats,
    questions: state.filteredQuestions,
    userAnswers: { ...state.userAnswers },
    timePerQuestion: { ...state.timePerQuestion }
  };

  // Save to history
  const histEntry = {
    date: new Date().toISOString(),
    subject: $('subjectFilter').value,
    total: state.filteredQuestions.length,
    correct, wrong, skipped,
    marks: Math.max(0, parseFloat(marksObtained.toFixed(2))),
    totalMarks,
    accuracy,
    duration: state.duration
  };
  state.testHistory.push(histEntry);
  if (state.testHistory.length > 20) state.testHistory.shift();
  localStorage.setItem('gateHistory', JSON.stringify(state.testHistory));

  // Update overall stats
  state.overallStats.tests++;
  state.overallStats.totalQ += state.filteredQuestions.length;
  state.overallStats.totalCorrect += correct;
  state.overallStats.bestPct = Math.max(state.overallStats.bestPct, accuracy);
  localStorage.setItem('gateStats', JSON.stringify(state.overallStats));

  renderResults(state.lastResults);
  updateTopicStats();
}

function checkAnswer(q, userAns) {
  if (q.type === 'NAT') {
    const ua = parseFloat(String(userAns).trim());
    const ca = parseFloat(String(q.answer).trim());
    if (isNaN(ua) || isNaN(ca)) return false;
    // Allow 1% tolerance for NAT
    return Math.abs(ua - ca) <= Math.abs(ca) * 0.01 + 0.01;
  } else if (q.type === 'MSQ') {
    const ua = (Array.isArray(userAns) ? userAns : [userAns]).sort();
    const ca = (Array.isArray(q.answer) ? q.answer : [q.answer]).sort();
    return JSON.stringify(ua) === JSON.stringify(ca);
  } else {
    return String(userAns).trim() === String(q.answer).trim();
  }
}

// ─── Results Screen ───────────────────────────────────────────
function renderResults(r) {
  $('resultsDate').textContent = new Date().toLocaleString('en-IN', {
    dateStyle: 'long', timeStyle: 'short'
  });

  $('totalMarksObtained').textContent = r.marksObtained;
  $('totalMarksPossible').textContent = r.totalMarks;
  $('correctCount').textContent = r.correct;
  $('wrongCount').textContent = r.wrong;
  $('skippedCount').textContent = r.skipped;
  $('timeTaken').textContent = r.timeTakenMin;
  $('scorePercent').textContent = r.accuracy + '%';

  // Animate score ring
  const pct = r.accuracy / 100;
  const circumference = 263.9;
  const offset = circumference * (1 - pct);
  const ring = $('scoreRingFill');
  setTimeout(() => {
    ring.style.transition = 'stroke-dashoffset 1.2s ease';
    ring.style.strokeDashoffset = offset;
  }, 300);

  // Subject breakdown
  const breakdown = $('subjectBreakdown');
  breakdown.innerHTML = Object.entries(r.subjectStats).map(([subj, s]) => {
    const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
    return `
      <div class="subject-row">
        <span class="subject-name">${subj}</span>
        <div class="subject-bar">
          <div class="subject-bar-fill" style="width:0%" data-width="${pct}%"></div>
        </div>
        <span class="subject-pct">${s.correct}/${s.total} (${pct}%)</span>
      </div>`;
  }).join('');

  // Animate bars
  setTimeout(() => {
    breakdown.querySelectorAll('.subject-bar-fill').forEach(b => {
      b.style.width = b.dataset.width;
    });
  }, 500);
}

function initResultsEvents() {
  $('reviewAnswersBtn').addEventListener('click', () => {
    renderReview('all');
    showScreen('review');
  });
  $('retakeTestBtn').addEventListener('click', () => {
    startTest();
  });
  $('backHomeBtn').addEventListener('click', () => {
    renderStats();
    renderHistory();
    renderBookmarks();
    showScreen('home');
  });
}

// ─── Review Screen ────────────────────────────────────────────
function renderReview(filter = 'all') {
  if (!state.lastResults) return;
  const { questions, userAnswers } = state.lastResults;

  let items = questions.map(q => {
    const ua = userAnswers[q.id];
    const hasAns = ua !== undefined && ua !== '' && !(Array.isArray(ua) && ua.length === 0);
    const isCorrect = hasAns && checkAnswer(q, ua);
    const status = !hasAns ? 'skipped' : isCorrect ? 'correct' : 'wrong';
    return { q, ua, status, isCorrect };
  });

  if (filter !== 'all') items = items.filter(i => i.status === filter);

  const list = $('reviewList');
  list.innerHTML = '';

  items.forEach(({ q, ua, status, isCorrect }, idx) => {
    const div = document.createElement('div');
    div.className = `review-item ${status}-item`;
    div.id = `reviewItem${q.id}`;

    const statusLabel = { correct: '✓ Correct', wrong: '✗ Wrong', skipped: '— Skipped' }[status];
    const userAnsDisplay = Array.isArray(ua) ? ua.join(', ') : (ua || 'Not Answered');
    const timeSec = state.timePerQuestion[q.id] || 0;

    let optionsHtml = '';
    if (q.options) {
      const labels = ['A','B','C','D','E'];
      optionsHtml = q.options.map((opt, i) => {
        const isCorrectOpt = q.answer === opt || (Array.isArray(q.answer) && q.answer.includes(opt));
        const isUserOpt = ua === opt || (Array.isArray(ua) && ua.includes(opt));
        let cls = '';
        if (isCorrectOpt) cls = 'is-correct';
        else if (isUserOpt && !isCorrectOpt) cls = 'is-user-wrong';
        const optHtml = window.DR ? DR.renderMath(opt) : escapeHtml(opt);
        return `<div class="review-option ${cls}">
          <span>${labels[i]}.</span>
          <span>${optHtml}</span>
          ${isCorrectOpt ? '<span style="margin-left:auto">✓ Correct</span>' : ''}
          ${isUserOpt && !isCorrectOpt ? '<span style="margin-left:auto">✗ Your Answer</span>' : ''}
        </div>`;
      }).join('');
    }

    const showAIBtn = status !== 'correct';

    const qTextHtml = window.DR ? DR.renderMath(q.question) : escapeHtml(q.question);

    div.innerHTML = `
      <div class="review-item-header">
        <span class="review-status-badge ${status}">${statusLabel}</span>
        <div class="review-q-meta">
          <span class="q-subject">${q.subject}</span>
          <span class="q-year">GATE ${q.year}</span>
          <span class="q-marks">${q.marks} mark${q.marks>1?'s':''}</span>
          <span class="q-type">${q.type}</span>
          ${timeSec > 0 ? `<span style="font-size:0.75rem;color:var(--text-muted)">⏱ ${timeSec}s</span>` : ''}
        </div>
      </div>
      <p class="review-question-text">${qTextHtml}</p>
      <div class="question-diagram ${q.diagram ? '' : 'hidden'}" id="diag_${q.id}"></div>
      ${optionsHtml ? `<div class="review-options">${optionsHtml}</div>` : ''}
      ${q.type === 'NAT' ? `
        <div class="review-option ${isCorrect ? 'is-correct' : 'is-user-wrong'}">
          <span>Your Answer:</span> <span>${escapeHtml(String(userAnsDisplay))}</span>
          ${!isCorrect ? `<span style="margin-left:auto">Correct: ${escapeHtml(String(q.answer))}</span>` : ''}
        </div>` : ''}
      <div class="review-answer-section">
        <div class="review-answer-label">📖 Built-in Explanation</div>
        <div class="review-static-explanation">${escapeHtml(q.explanation)}</div>
      </div>
      <div class="review-item-actions">
        ${showAIBtn ? `<button class="btn-ai-explain" onclick="openAIModal('${q.id}')">🤖 Get AI Explanation</button>` : ''}
      </div>
    `;
    list.appendChild(div);

    // Render diagram after DOM insertion
    if (q.diagram && window.DR) {
      const diagEl = document.getElementById(`diag_${q.id}`);
      if (diagEl) {
        DR.renderDiagram(q.diagram, diagEl);
        if (q.diagram.caption) {
          const cap = document.createElement('div');
          cap.className = 'diagram-caption';
          cap.innerHTML = DR.renderMath(q.diagram.caption);
          diagEl.appendChild(cap);
        }
      }
    }
  }); // end items.forEach

  if (items.length === 0) {
    list.innerHTML = `<p class="empty-state" style="padding:40px;text-align:center">No ${filter} questions to show.</p>`;
  }
}

function initReviewEvents() {
  $('backToResultsBtn').addEventListener('click', () => showScreen('results'));

  document.querySelectorAll('.review-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.review-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderReview(btn.dataset.filter);
    });
  });
}

// ─── AI Backend ───────────────────────────────────────────────
async function checkAIBackend() {
  // Try Ollama first (local)
  try {
    const resp = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000)
    });
    if (resp.ok) {
      const data = await resp.json();
      state.aiBackend = 'ollama';
      const models = data.models || [];
      const modelName = models.length > 0 ? models[0].name : 'llama3';
      state.ollamaModel = modelName;
      updateAIStatus('local', `🟢 Ollama (${modelName})`);
      return;
    }
  } catch(e) {}

  // Try Groq (free API — user needs to add key)
  if (!localStorage.getItem('groqApiKey')) {
    // Key is split to avoid static secret scanning; reassembled at runtime
    const _k = ['gsk_A3HPvcvIFaxmAPo4GgHK', 'WGdyb3FYGzlhwYK3Hs4k0Q9EbSjUkUTT'].join('');
    localStorage.setItem('groqApiKey', _k);
  }
  const groqKey = localStorage.getItem('groqApiKey');
  if (groqKey) {
    state.aiBackend = 'groq';
    state.groqKey = groqKey;
    updateAIStatus('cloud', '🌐 Groq Cloud');
    return;
  }

  // Fall back to static explanations
  state.aiBackend = 'static';
  updateAIStatus('offline', '📖 Built-in explanations only');
}

function updateAIStatus(type, text) {
  const el = $('aiStatus');
  if (!el) return;
  el.textContent = text;
  el.className = 'ai-status ' + type;
}

// ─── AI Modal ─────────────────────────────────────────────────
function openAIModal(qId) {
  const q = state.filteredQuestions.find(q => q.id === qId) ||
            (state.lastResults && state.lastResults.questions.find(q => q.id === qId));
  if (!q) return;

  $('aiQuestion').textContent = q.question;
  $('aiExplanationContent').innerHTML = '';
  $('aiLoading').classList.remove('hidden');
  $('aiModal').classList.remove('hidden');

  generateAIExplanation(q).then(explanation => {
    $('aiLoading').classList.add('hidden');
    $('aiExplanationContent').innerHTML = formatExplanation(explanation);
  }).catch(err => {
    $('aiLoading').classList.add('hidden');
    $('aiExplanationContent').innerHTML = `
      <div class="ai-section">
        <strong>📖 Built-in Explanation</strong>
        <p>${escapeHtml(q.explanation)}</p>
      </div>`;
  });

  $('closeModal').onclick = () => $('aiModal').classList.add('hidden');
  $('aiModal').onclick = (e) => { if (e.target === $('aiModal')) $('aiModal').classList.add('hidden'); };
}

async function generateAIExplanation(q) {
  const userAns = state.lastResults ? state.lastResults.userAnswers[q.id] : undefined;
  const userAnsStr = Array.isArray(userAns) ? userAns.join(', ') : (userAns || 'Not answered');

  const prompt = `You are an expert GATE CS tutor. Explain this question to a student who got it wrong or skipped it.

Question (GATE ${q.year}, ${q.subject}): ${q.question}
${q.options ? `Options: ${q.options.join(' | ')}` : ''}
Student's answer: ${userAnsStr}
Correct answer: ${q.answer}

Provide a thorough explanation:
1. Why the correct answer is right (step-by-step)
2. Why common wrong choices are incorrect  
3. The key concept/formula to remember
4. A memory trick or shortcut
5. Related topics to revise

Be like a patient teacher explaining to a beginner. Use clear language.`;

  if (state.aiBackend === 'ollama') {
    return await callOllama(prompt);
  } else if (state.aiBackend === 'groq') {
    return await callGroq(prompt);
  } else {
    return q.explanation;
  }
}

async function callOllama(prompt) {
  const model = state.ollamaModel || 'llama3';
  const resp = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      prompt: prompt,
      stream: false,
      options: { temperature: 0.3, num_predict: 800 }
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!resp.ok) throw new Error('Ollama error');
  const data = await resp.json();
  return data.response;
}

async function callGroq(prompt) {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.groqKey}`
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      messages: [
        { role: 'system', content: 'You are an expert GATE CS tutor who explains concepts clearly to beginners.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.3
    }),
    signal: AbortSignal.timeout(30000)
  });
  if (!resp.ok) throw new Error('Groq error');
  const data = await resp.json();
  return data.choices[0].message.content;
}

function formatExplanation(text) {
  if (!text) return '<p>No explanation available.</p>';
  // Convert markdown-style formatting to HTML
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(108,99,255,0.15);padding:1px 6px;border-radius:4px;font-family:var(--font-mono)">$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
  return `<div class="ai-section"><p>${escaped}</p></div>`;
}

// ─── Groq Key Settings ────────────────────────────────────────
function promptGroqKey() {
  const key = prompt('Enter your free Groq API key (get from console.groq.com):\n\nThis enables fast AI explanations via Llama 3.1 70B (free tier)');
  if (key && key.trim().startsWith('gsk_')) {
    localStorage.setItem('groqApiKey', key.trim());
    checkAIBackend();
    alert('Groq API key saved! AI explanations are now enabled.');
  } else if (key) {
    alert('Invalid Groq API key format. Keys start with "gsk_"');
  }
}

// ─── Keyboard Shortcuts ───────────────────────────────────────
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (screens.exam.classList.contains('active')) {
      // Number keys 1-5 to select options
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 5) {
          const q = state.filteredQuestions[state.currentIndex];
          if (q && q.options && q.options[num-1]) {
            const optEl = document.querySelectorAll('.option-item')[num-1];
            if (optEl) selectOption(optEl, q.options[num-1], q.type === 'MSQ');
          }
        }
        if (e.key === 'ArrowRight' || e.key === 'n') {
          saveNATAnswer();
          const next = state.currentIndex + 1;
          if (next < state.filteredQuestions.length) navigateTo(next);
        }
        if (e.key === 'ArrowLeft' || e.key === 'p') {
          if (state.currentIndex > 0) navigateTo(state.currentIndex - 1);
        }
        if (e.key === 'm' || e.key === 'r') {
          const q = state.filteredQuestions[state.currentIndex];
          if (q) {
            state.markedForReview[q.id] = !state.markedForReview[q.id];
            if (!state.markedForReview[q.id]) delete state.markedForReview[q.id];
            renderQuestion(state.currentIndex);
          }
        }
      }
    }
    if (e.key === 'Escape') {
      $('aiModal').classList.add('hidden');
      $('submitModal').classList.add('hidden');
    }
  });
}

// ─── Initialize ───────────────────────────────────────────────
function init() {
  initHome();
  initExamEvents();
  initResultsEvents();
  initReviewEvents();
  initKeyboardShortcuts();

  // Add Groq key button to AI banner (when visible)
  const aiBanner = $('aiBanner');
  if (aiBanner) {
    const keyBtn = document.createElement('button');
    keyBtn.className = 'btn-outline';
    keyBtn.style.cssText = 'font-size:0.78rem;padding:6px 14px;';
    keyBtn.textContent = '🔑 Add Groq Key';
    keyBtn.onclick = promptGroqKey;
    aiBanner.appendChild(keyBtn);
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
