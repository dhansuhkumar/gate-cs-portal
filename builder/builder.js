/* ============================================================
   GATE CS Question Builder — builder.js
   Visual authoring tool for GATE questions
   ============================================================ */
'use strict';

const QB = {
  questions: [],
  currentDiagram: null,
  diagramCounter: 0,
};

/* ─── Utility ─────────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  $('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ─── Editor (Rich ContentEditable) ───────────────────────── */
function initEditor() {
  const el = $('editorContainer');
  el.contentEditable = 'true';
  el.innerHTML = '<p><br></p>';

  el.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'm') { e.preventDefault(); openMathModal('inline'); }
    if (e.ctrlKey && e.shiftKey && e.key === 'M') { e.preventDefault(); openMathModal('block'); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveQuestion(); }
  });

  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/html') ||
                 (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertHTML', false, text);
  });

  el.addEventListener('input', updatePreview);
  return el;
}

function getEditorHTML() { return $('editorContainer').innerHTML; }
function setEditorHTML(html) { $('editorContainer').innerHTML = html || '<p><br></p>'; updatePreview(); }

/* ─── Math Modal ──────────────────────────────────────────── */
let mathInsertMode = 'inline';
let mathInsertCallback = null;

function openMathModal(mode, callback) {
  mathInsertMode = mode;
  mathInsertCallback = callback || null;
  $('mathModal').classList.remove('hidden');
  $('mathLatexInput').value = '';
  $('mathPreview').innerHTML = '<span style="color:var(--text-muted)">Type LaTeX to see preview</span>';
  $('mathLatexInput').focus();
}

function closeMathModal() {
  $('mathModal').classList.add('hidden');
}

function insertMath() {
  const latex = $('mathLatexInput').value.trim();
  if (!latex) return;

  if (mathInsertCallback) {
    mathInsertCallback(latex);
  } else {
    const el = $('editorContainer');
    el.focus();
    if (mathInsertMode === 'inline') {
      document.execCommand('insertHTML', false,
        `<span class="math-inline" data-latex="${escapeAttr(latex)}" contenteditable="false">${renderMathInline(latex)}</span>&nbsp;`);
    } else {
      document.execCommand('insertHTML', false,
        `<div class="math-block" data-latex="${escapeAttr(latex)}" contenteditable="false">${renderMathBlock(latex)}</div><p><br></p>`);
    }
  }
  closeMathModal();
  updatePreview();
}

function renderMathInline(latex) {
  if (typeof katex !== 'undefined') {
    try { return katex.renderToString(latex, { throwOnError: false }); }
    catch(e) { return `<code>${latex}</code>`; }
  }
  return `$${latex}$`;
}

function renderMathBlock(latex) {
  if (typeof katex !== 'undefined') {
    try { return katex.renderToString(latex, { displayMode: true, throwOnError: false }); }
    catch(e) { return `<code>${latex}</code>`; }
  }
  return `$$${latex}$$`;
}

function escapeAttr(s) { return s.replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

function updateMathPreview() {
  const latex = $('mathLatexInput').value.trim();
  if (!latex) { $('mathPreview').innerHTML = '<span style="color:var(--text-muted)">Type LaTeX to see preview</span>'; return; }
  $('mathPreview').innerHTML = renderMathBlock(latex);
}

/* ─── Symbol Picker ───────────────────────────────────────── */
const SYMBOLS = [
  '∀','∃','∈','∉','⊂','⊆','∪','∩','∅','¬','∧','∨','→','↔',
  '≤','≥','≠','≈','≡','∞','∑','∏','∫','√','×','÷','·','…',
  'α','β','γ','δ','ε','θ','λ','μ','σ','π','ω','φ',
  '⊕','⊗','⊥','⊤','⊢','⊨','↦','锎','⊇','⊃','∖','△',
  '0','1','2','3','4','5','6','7','8','9',
  'ⁿ','ₙ','₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'
];

function initSymbolPicker() {
  const grid = $('symbolGrid');
  grid.innerHTML = SYMBOLS.map(s => `<button class="sym-btn" data-sym="${s}">${s}</button>`).join('');
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.sym-btn');
    if (!btn) return;
    const sym = btn.dataset.sym;
    const ta = $('mathLatexInput');
    const start = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + sym + ta.value.substring(end);
    ta.focus();
    ta.setSelectionRange(start + sym.length, start + sym.length);
    updateMathPreview();
  });
}

/* ─── Options Editor ──────────────────────────────────────── */
function initOptionsEditor() {
  updateOptionVisibility();

  $('typeSelect').addEventListener('change', () => {
    updateOptionVisibility();
    updatePreview();
  });

  document.querySelectorAll('.type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $('typeSelect').value = tab.dataset.type;
      updateOptionVisibility();
      updatePreview();
    });
  });

  document.querySelectorAll('input[name="correctAnswer"]').forEach(r => {
    r.addEventListener('change', updatePreview);
  });

  document.querySelectorAll('.option-input').forEach(inp => {
    inp.addEventListener('input', updatePreview);
  });

  $('addOptionBtn').addEventListener('click', addOption);
}

function getCurrentType() {
  const active = document.querySelector('.type-tab.active');
  return active ? active.dataset.type : 'MCQ';
}

function updateOptionVisibility() {
  const type = getCurrentType();
  $('optionsSection').classList.toggle('hidden', type === 'NAT');
  $('natSection').classList.toggle('hidden', type !== 'NAT');
}

function addOption() {
  const editor = $('optionsEditor');
  const count = editor.querySelectorAll('.option-row').length;
  if (count >= 8) { showToast('Max 8 options', 'error'); return; }
  const letter = String.fromCharCode(65 + count);
  const row = document.createElement('div');
  row.className = 'option-row';
  row.dataset.idx = count;
  row.innerHTML = `
    <span class="option-letter">${letter}</span>
    <input type="text" class="option-input" placeholder="Option ${letter}">
    <label class="correct-check" title="Correct answer">
      <input type="radio" name="correctAnswer" value="${count}"><span>✓</span>
    </label>`;
  editor.appendChild(row);
  row.querySelector('.option-input').addEventListener('input', updatePreview);
  row.querySelector('input[type="radio"]').addEventListener('change', updatePreview);
}

function getOptions() {
  const type = getCurrentType();
  if (type === 'NAT') return null;
  return Array.from(document.querySelectorAll('.option-input')).map(i => i.value.trim()).filter(Boolean);
}

function getCorrectAnswer() {
  const type = getCurrentType();
  if (type === 'NAT') return $('natAnswerInput').value.trim();
  if (type === 'MSQ') {
    const checks = document.querySelectorAll('.correct-check input:checked');
    return Array.from(checks).map(c => {
      const row = c.closest('.option-row');
      return row.querySelector('.option-input').value.trim();
    }).filter(Boolean);
  }
  const checked = document.querySelector('input[name="correctAnswer"]:checked');
  if (!checked) return '';
  const row = checked.closest('.option-row');
  return row.querySelector('.option-input').value.trim();
}

/* ─── Symbol Shortcodes → Unicode ─────────────────────────── */
function convertSymbolShortcodes(text) {
  return text
    .replace(/\\forall/g, '∀').replace(/\\exists/g, '∃')
    .replace(/\\in/g, ' ∈ ').replace(/\\notin/g, ' ∉ ')
    .replace(/\\subset/g, ' ⊂ ').replace(/\\subseteq/g, ' ⊆ ')
    .replace(/\\cup/g, ' ∪ ').replace(/\\cap/g, ' ∩ ')
    .replace(/\\emptyset/g, '∅').replace(/\\empty/g, '∅')
    .replace(/\\land/g, ' ∧ ').replace(/\\lor/g, ' ∨ ')
    .replace(/\\lnot/g, '¬').replace(/\\neg/g, '¬')
    .replace(/\\to/g, ' → ').replace(/\\rightarrow/g, ' → ')
    .replace(/\\leftrightarrow/g, ' ↔ ')
    .replace(/\\oplus/g, '⊕').replace(/\\otimes/g, '⊗')
    .replace(/\\leq/g, '≤').replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠').replace(/\\approx/g, '≈')
    .replace(/\\infty/g, '∞').replace(/\\times/g, '×')
    .replace(/\\div/g, '÷').replace(/\\cdot/g, '·')
    .replace(/\\ldots/g, '…').replace(/\\sum/g, 'Σ')
    .replace(/\\prod/g, 'Π').replace(/\\sqrt/g, '√')
    .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ').replace(/\\delta/g, 'δ')
    .replace(/\\epsilon/g, 'ε').replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ').replace(/\\sigma/g, 'σ')
    .replace(/\\pi/g, 'π').replace(/\\theta/g, 'θ')
    .replace(/\\omega/g, 'ω').replace(/\\phi/g, 'φ');
}

/* ─── Live Preview ────────────────────────────────────────── */
function updatePreview() {
  const type = getCurrentType();
  const year = $('yearSelect').value;
  const subject = $('subjectSelect').value;
  const marks = $('marksSelect').value;

  // Meta badges
  $('previewMeta').innerHTML = `
    <span class="q-subject" style="padding:3px 10px;border-radius:999px;font-size:0.75rem;font-weight:500;background:rgba(108,99,255,0.15);color:var(--accent-purple)">${subject}</span>
    <span class="q-marks" style="padding:3px 10px;border-radius:999px;font-size:0.75rem;font-weight:500;background:rgba(72,207,173,0.12);color:var(--accent-teal)">${marks} mark${marks > 1 ? 's' : ''}</span>
    <span class="q-year" style="padding:3px 10px;border-radius:999px;font-size:0.75rem;font-weight:500;background:rgba(255,169,77,0.12);color:var(--accent-orange)">GATE ${year}</span>
    <span class="q-type" style="padding:3px 10px;border-radius:999px;font-size:0.75rem;font-weight:500;background:rgba(255,107,157,0.12);color:var(--accent-pink)">${type}</span>`;

  // Question text
  const rawHTML = getEditorHTML();
  const questionText = rawHTML
    .replace(/<div class="math-inline" data-latex="([^"]*)"[^>]*>[^<]*<\/div>/g, (m, latex) => `$${decodeAttr(latex)}$`)
    .replace(/<div class="math-block" data-latex="([^"]*)"[^>]*>[^<]*<\/div>/g, (m, latex) => `$$${decodeAttr(latex)}$$`)
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<p[^>]*>/g, '')
    .replace(/<\/p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  $('previewQuestion').textContent = questionText || '(No question text)';

  // Diagram
  const diag = $('diagramPreview');
  $('previewDiagram').innerHTML = diag.innerHTML || '';

  // Options
  const options = getOptions();
  const correct = getCorrectAnswer();
  if (type === 'NAT') {
    $('previewOptions').innerHTML = `<div class="preview-option"><strong>NAT Answer:</strong> ${$('natAnswerInput').value || '(not set)'}</div>`;
  } else if (options && options.length > 0) {
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $('previewOptions').innerHTML = options.map((opt, i) => {
      const isCorrect = type === 'MSQ' ? (Array.isArray(correct) && correct.includes(opt)) : (opt === correct);
      return `<div class="preview-option ${isCorrect ? 'correct' : ''}">
        <strong>${labels[i]}.</strong> ${escapeHtml(opt)} ${isCorrect ? '✓' : ''}
      </div>`;
    }).join('');
  } else {
    $('previewOptions').innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">(No options set)</div>';
  }

  // Explanation
  const exp = $('explanationInput').value.trim();
  $('previewExplanation').innerHTML = exp
    ? `<strong style="color:var(--accent-purple)">Explanation:</strong> ${convertSymbolShortcodes(escapeHtml(exp))}`
    : '<span style="color:var(--text-muted)">(No explanation)</span>';
}

function decodeAttr(s) { return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&'); }
function escapeHtml(text) { const d = document.createElement('div'); d.appendChild(document.createTextNode(text)); return d.innerHTML; }

/* ─── Save Question ───────────────────────────────────────── */
function saveQuestion() {
  const type = getCurrentType();
  const subject = $('subjectSelect').value;
  const year = $('yearSelect').value;
  const topic = $('topicInput').value.trim();
  const marks = $('marksSelect').value;

  if (!topic) { showToast('Enter a topic', 'error'); return; }

  const rawHTML = getEditorHTML();
  const questionClean = rawHTML
    .replace(/<div class="math-inline" data-latex="([^"]*)"[^>]*>[^<]*<\/div>/g, (m, latex) => `$${decodeAttr(latex)}$`)
    .replace(/<div class="math-block" data-latex="([^"]*)"[^>]*>[^<]*<\/div>/g, (m, latex) => `$$${decodeAttr(latex)}$$`)
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<p[^>]*>/g, '')
    .replace(/<\/p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  if (!questionClean || questionClean.length < 10) {
    showToast('Question text too short (min 10 chars)', 'error');
    return;
  }

  const options = getOptions();
  const answer = getCorrectAnswer();

  if (type !== 'NAT' && (!options || options.length < 2)) {
    showToast('Add at least 2 options', 'error'); return;
  }
  if (!answer || (Array.isArray(answer) && answer.length === 0)) {
    showToast('Select the correct answer', 'error'); return;
  }

  const id = `${getSubjectCode(subject)}_${year}_${String(QB.questions.length + 1).padStart(3, '0')}`;

  const q = {
    id,
    year: parseInt(year),
    subject,
    topic,
    type,
    marks: parseInt(marks),
    question: questionClean,
    options: type === 'NAT' ? null : options,
    answer,
    explanation: $('explanationInput').value.trim() || 'No explanation provided.',
    diagram: QB.currentDiagram || null,
  };

  QB.questions.push(q);
  $('questionCountBadge').textContent = `${QB.questions.length} saved`;
  showToast(`Saved: ${id}`);
  clearForm();
}

function clearForm() {
  setEditorHTML('<p><br></p>');
  $('topicInput').value = '';
  $('explanationInput').value = '';
  $('natAnswerInput').value = '';
  document.querySelectorAll('.option-input').forEach(i => i.value = '');
  document.querySelectorAll('input[name="correctAnswer"]').forEach(r => r.checked = false);
  QB.currentDiagram = null;
  $('diagramArea').classList.add('hidden');
  $('diagramPreview').innerHTML = '';
  $('diagramCaption').value = '';
  updatePreview();
}

/* ─── Export ──────────────────────────────────────────────── */
function exportQuestions() {
  if (QB.questions.length === 0) { showToast('No questions to export', 'error'); return; }

  const js = `// GATE CS Question Bank — Auto-generated by Question Builder
// Generated: ${new Date().toISOString()}
const GATE_QUESTIONS = ${JSON.stringify(QB.questions, null, 2)};
`;

  const blob = new Blob([js], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'questions-generated.js'; a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${QB.questions.length} questions`);
}

function getSubjectCode(subject) {
  const map = {
    'Discrete Mathematics': 'DM', 'Algorithms': 'AL', 'Data Structures': 'DS',
    'Operating Systems': 'OS', 'Theory of Computation': 'TOC', 'DBMS': 'DB',
    'Computer Networks': 'CN', 'Computer Organization': 'COA', 'Compiler Design': 'CD',
    'Digital Logic': 'DL', 'Programming': 'PR', 'Engineering Mathematics': 'EM'
  };
  return map[subject] || 'XX';
}

/* ─── Load JSON ───────────────────────────────────────────── */
function loadFromJSON() {
  const raw = $('jsonLoadInput').value.trim();
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    const arr = Array.isArray(data) ? data : [data];
    let loaded = 0;
    arr.forEach(q => {
      if (q.question && q.answer) {
        if (!q.id) q.id = `${getSubjectCode(q.subject || 'XX')}_${q.year || 2023}_${String(QB.questions.length + 1).padStart(3, '0')}`;
        QB.questions.push(q);
        loaded++;
      }
    });
    $('questionCountBadge').textContent = `${QB.questions.length} saved`;
    $('loadJsonModal').classList.add('hidden');
    showToast(`Loaded ${loaded} questions`);
  } catch(e) { showToast('Invalid JSON: ' + e.message, 'error'); }
}

/* ─── Diagram Editors ─────────────────────────────────────── */

// ── Graph Editor (simple visual) ──
function openGraphEditor(existing) {
  const modal = $('diagramEditorModal');
  modal.classList.remove('hidden');
  $('diagramTypeLabel').textContent = 'Graph Editor';

  let nodes = existing?.data?.nodes || [];
  let edges = existing?.data?.edges || [];
  let directed = existing?.data?.directed || false;

  const container = $('diagramEditorContent');
  container.innerHTML = `
    <div class="graph-toolbar">
      <label><input type="checkbox" id="graphDirected" ${directed ? 'checked' : ''}> Directed Graph</label>
      <button class="btn-small" id="graphAddNode">+ Add Node</button>
      <button class="btn-small" id="graphAddEdge">+ Add Edge</button>
      <button class="btn-small" id="graphAutoLayout">⚡ Auto Layout</button>
      <button class="btn-primary" id="graphDone" style="margin-left:auto;">Done</button>
      <button class="btn-outline" id="graphCancel">Cancel</button>
    </div>
    <div id="graphNodeList" style="margin:12px 0;"></div>
    <div id="graphEdgeList" style="margin:12px 0;"></div>
    <div id="graphSvgPreview" style="margin-top:16px;"></div>
  `;

  function renderLists() {
    $('graphNodeList').innerHTML = '<strong style="font-size:0.82rem;color:var(--text-muted)">NODES:</strong>' +
      nodes.map((n, i) => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;margin:4px;border-radius:6px;background:var(--bg-tertiary);border:1px solid var(--border);font-size:0.82rem;">
        <input value="${n.label}" style="width:40px;background:transparent;border:none;color:var(--text-primary);font-weight:700;text-align:center;" data-idx="${i}" class="node-label-input">
        <button onclick="QB.graphRemoveNode(${i})" style="background:none;border:none;color:var(--wrong);cursor:pointer;font-size:0.9rem;">✕</button>
      </span>`).join('');

    $('graphEdgeList').innerHTML = '<strong style="font-size:0.82rem;color:var(--text-muted)">EDGES:</strong>' +
      edges.map((e, i) => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;margin:4px;border-radius:6px;background:var(--bg-tertiary);border:1px solid var(--border);font-size:0.82rem;">
        ${e.from}→${e.to}${e.label ? ' (' + e.label + ')' : ''}
        <button onclick="QB.graphRemoveEdge(${i})" style="background:none;border:none;color:var(--wrong);cursor:pointer;font-size:0.9rem;">✕</button>
      </span>`).join('');

    // Render preview using diagram-renderer
    const w = 480, h = 280;
    if (window.DR && nodes.length > 0) {
      $('graphSvgPreview').innerHTML = DR.renderGraph({
        nodes: nodes.map((n, i) => ({ id: String(i), label: n.label, x: n.x || 0, y: n.y || 0 })),
        edges: edges.map(e => ({ from: String(e.fromIdx), to: String(e.toIdx), label: e.label })),
        directed, width: w, height: h
      });
    }
  }

  $('graphAddNode').addEventListener('click', () => {
    const label = prompt('Node label:', String(nodes.length + 1));
    if (label === null) return;
    const angle = (nodes.length / 8) * 2 * Math.PI;
    nodes.push({ label, x: 240 + 100 * Math.cos(angle), y: 140 + 100 * Math.sin(angle) });
    renderLists();
  });

  QB.graphRemoveNode = (i) => { nodes.splice(i, 1); renderLists(); };
  QB.graphRemoveEdge = (i) => { edges.splice(i, 1); renderLists(); };

  $('graphAddEdge').addEventListener('click', () => {
    if (nodes.length < 2) { showToast('Add at least 2 nodes first', 'error'); return; }
    const nodeLabels = nodes.map((n, i) => `${i}: ${n.label}`).join(', ');
    const fromStr = prompt(`From node (index: ${nodeLabels}):`);
    const toStr = prompt(`To node (index: ${nodeLabels}):`);
    const label = prompt('Edge label (optional):');
    if (fromStr === null || toStr === null) return;
    const fromIdx = parseInt(fromStr), toIdx = parseInt(toStr);
    if (isNaN(fromIdx) || isNaN(toIdx) || !nodes[fromIdx] || !nodes[toIdx]) {
      showToast('Invalid node index', 'error'); return;
    }
    edges.push({ fromIdx, toIdx, from: nodes[fromIdx].label, to: nodes[toIdx].label, label: label || undefined });
    renderLists();
  });

  $('graphAutoLayout').addEventListener('click', () => {
    const w = 480, h = 280, cx = w/2, cy = h/2, r = Math.min(w,h)*0.35;
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * 2 * Math.PI - Math.PI/2;
      n.x = Math.round(cx + r * Math.cos(a));
      n.y = Math.round(cy + r * Math.sin(a));
    });
    renderLists();
  });

  $('graphDone').addEventListener('click', () => {
    directed = $('graphDirected').checked;
    // Update node labels from inputs
    container.querySelectorAll('.node-label-input').forEach(inp => {
      const idx = parseInt(inp.dataset.idx);
      nodes[idx].label = inp.value;
    });
    QB.currentDiagram = {
      type: 'graph',
      data: { nodes, edges: edges.map(e => ({ from: String(e.fromIdx), to: String(e.toIdx), label: e.label })), directed, width: 480, height: 280 },
      caption: ''
    };
    renderDiagramArea();
    modal.classList.add('hidden');
  });

  $('graphCancel').addEventListener('click', () => modal.classList.add('hidden'));

  // Add initial nodes if empty
  if (nodes.length === 0) {
    nodes = [
      { label: '1', x: 120, y: 80 },
      { label: '2', x: 360, y: 80 },
      { label: '3', x: 120, y: 200 },
      { label: '4', x: 360, y: 200 }
    ];
  }
  renderLists();
}

// ── DFA Editor ──
function openDFAEditor(existing) {
  const modal = $('diagramEditorModal');
  modal.classList.remove('hidden');

  let states = existing?.data?.states || [
    { id: 'q0', label: 'q₀', start: true, accepting: false, x: 80, y: 110 },
    { id: 'q1', label: 'q₁', start: false, accepting: false, x: 240, y: 110 },
    { id: 'q2', label: 'q₂', start: false, accepting: true, x: 400, y: 110 }
  ];
  let transitions = existing?.data?.transitions || [];

  const container = $('diagramEditorContent');
  container.innerHTML = `
    <div class="dfa-toolbar">
      <button class="btn-small" id="dfaAddState">+ State</button>
      <button class="btn-small" id="dfaAddTrans">+ Transition</button>
      <button class="btn-primary" id="dfaDone" style="margin-left:auto;">Done</button>
      <button class="btn-outline" id="dfaCancel">Cancel</button>
    </div>
    <div id="dfaStatesList" style="margin:12px 0;"></div>
    <div id="dfaTransList" style="margin:12px 0;"></div>
    <div id="dfaPreview" style="margin-top:16px;"></div>
  `;

  function render() {
    $('dfaStatesList').innerHTML = '<strong style="font-size:0.82rem;color:var(--text-muted)">STATES:</strong> ' +
      states.map((s, i) => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;margin:4px;border-radius:6px;background:${s.accepting ? 'rgba(72,207,173,0.15)' : 'var(--bg-tertiary)'};border:1px solid ${s.start ? 'var(--accent-teal)' : s.accepting ? 'var(--correct)' : 'var(--border)'};font-size:0.82rem;font-weight:600;">
        ${s.label} ${s.start ? '→' : ''} ${s.accepting ? '_DOUBLE' : ''}
        <button onclick="QB.dfaToggleAccept(${i})" style="background:none;border:none;color:var(--accent-orange);cursor:pointer;font-size:0.75rem;" title="Toggle accepting">◯</button>
        <button onclick="QB.dfaToggleStart(${i})" style="background:none;border:none;color:var(--accent-teal);cursor:pointer;font-size:0.75rem;" title="Toggle start">▶</button>
        <button onclick="QB.dfaRemoveState(${i})" style="background:none;border:none;color:var(--wrong);cursor:pointer;font-size:0.9rem;">✕</button>
      </span>`).join('');

    $('dfaTransList').innerHTML = '<strong style="font-size:0.82rem;color:var(--text-muted)">TRANSITIONS:</strong> ' +
      transitions.map((t, i) => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;margin:4px;border-radius:6px;background:var(--bg-tertiary);border:1px solid var(--border);font-size:0.82rem;">
        ${t.from} —[${t.label}]→ ${t.to}
        <button onclick="QB.dfaRemoveTrans(${i})" style="background:none;border:none;color:var(--wrong);cursor:pointer;font-size:0.9rem;">✕</button>
      </span>`).join('');

    if (window.DR && states.length > 0) {
      $('dfaPreview').innerHTML = DR.renderAutomaton({ states, transitions, width: 560, height: 240 });
    }
  }

  QB.dfaToggleAccept = (i) => { states[i].accepting = !states[i].accepting; render(); };
  QB.dfaToggleStart = (i) => { states.forEach((s, j) => s.start = (j === i)); render(); };
  QB.dfaRemoveState = (i) => { states.splice(i, 1); render(); };
  QB.dfaRemoveTrans = (i) => { transitions.splice(i, 1); render(); };

  $('dfaAddState').addEventListener('click', () => {
    const id = prompt('State ID (e.g. q3):', `q${states.length}`);
    if (!id) return;
    const label = prompt('Display label:', id.replace('q', 'q'));
    const x = 80 + states.length * 160;
    states.push({ id, label: label || id, start: false, accepting: false, x, y: 110 });
    render();
  });

  $('dfaAddTrans').addEventListener('click', () => {
    const from = prompt('From state (e.g. q0):');
    const to = prompt('To state (e.g. q1):');
    const label = prompt('Input symbol (e.g. 0):');
    if (from && to && label !== null) {
      transitions.push({ from, to, label });
      render();
    }
  });

  $('dfaDone').addEventListener('click', () => {
    QB.currentDiagram = { type: 'automaton', data: { states, transitions, width: 560, height: 240 } };
    renderDiagramArea();
    modal.classList.add('hidden');
  });
  $('dfaCancel').addEventListener('click', () => modal.classList.add('hidden'));
  render();
}

// ── K-Map Editor ──
function openKMapEditor(existing) {
  const modal = $('diagramEditorModal');
  modal.classList.remove('hidden');

  const numVars = existing?.data?.vars?.length || 4;
  let minterms = existing?.data?.minterms || [];
  let dontcares = existing?.data?.dontcares || [];

  const gray2 = [0,1,3,2];

  function render() {
    let html = `<div class="kmap-builder-controls">
      <label>Variables:</label>
      <select id="kmapVars" style="padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);">
        <option value="2" ${numVars===2?'selected':''}>2 (A,B)</option>
        <option value="3" ${numVars===3?'selected':''}>3 (A,B,C)</option>
        <option value="4" ${numVars===4?'selected':''}>4 (A,B,C,D)</option>
      </select>
      <button class="btn-small" id="kmapClear">Clear All</button>
      <button class="btn-primary" id="kmapDone">Done</button>
      <button class="btn-outline" id="kmapCancel">Cancel</button>
    </div>
    <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;">Click cells to cycle: 0 → 1 → X (don't-care) → 0</p>
    <div class="kmap-builder-grid">`;

    if (numVars === 4) {
      html += '<table class="kmap-builder-table"><tr><th class="kmap-builder-header">AB\\CD</th>';
      gray2.forEach(c => { html += `<th class="kmap-builder-header">${c.toString(2).padStart(2,'0')}</th>`; });
      html += '</tr>';
      gray2.forEach(row => {
        html += `<tr><th class="kmap-builder-header">${row.toString(2).padStart(2,'0')}</th>`;
        gray2.forEach(col => {
          const m = (row << 2) | col;
          const is1 = minterms.includes(m);
          const isX = dontcares.includes(m);
          const cls = is1 ? 'val-1' : isX ? 'val-X' : '';
          html += `<td class="kmap-builder-cell ${cls}" data-m="${m}" data-val="${is1 ? '1' : isX ? 'X' : '0'}">${is1 ? '1' : isX ? 'X' : '0'}</td>`;
        });
        html += '</tr>';
      });
    } else if (numVars === 3) {
      html += '<table class="kmap-builder-table"><tr><th class="kmap-builder-header">A\\BC</th>';
      gray2.forEach(c => { html += `<th class="kmap-builder-header">${c.toString(2).padStart(2,'0')}</th>`; });
      html += '</tr>';
      [0,1].forEach(row => {
        html += `<tr><th class="kmap-builder-header">${row}</th>`;
        gray2.forEach(col => {
          const m = (row << 2) | col;
          const is1 = minterms.includes(m);
          const isX = dontcares.includes(m);
          const cls = is1 ? 'val-1' : isX ? 'val-X' : '';
          html += `<td class="kmap-builder-cell ${cls}" data-m="${m}" data-val="${is1 ? '1' : isX ? 'X' : '0'}">${is1 ? '1' : isX ? 'X' : '0'}</td>`;
        });
        html += '</tr>';
      });
    } else {
      html += '<table class="kmap-builder-table"><tr><th class="kmap-builder-header">A\\B</th><th class="kmap-builder-header">0</th><th class="kmap-builder-header">1</th></tr>';
      [0,1].forEach(row => {
        html += `<tr><th class="kmap-builder-header">${row}</th>`;
        [0,1].forEach(col => {
          const m = (row << 1) | col;
          const is1 = minterms.includes(m);
          const isX = dontcares.includes(m);
          const cls = is1 ? 'val-1' : isX ? 'val-X' : '';
          html += `<td class="kmap-builder-cell ${cls}" data-m="${m}" data-val="${is1 ? '1' : isX ? 'X' : '0'}">${is1 ? '1' : isX ? 'X' : '0'}</td>`;
        });
        html += '</tr>';
      });
    }
    html += '</table></div>';

    container.innerHTML = html;

    // Cell click handler
    container.querySelectorAll('.kmap-builder-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const m = parseInt(cell.dataset.m);
        const cur = cell.dataset.val;
        let next, nextVal;
        if (cur === '0') { next = '1'; nextVal = '1'; }
        else if (cur === '1') { next = 'X'; nextVal = 'X'; }
        else { next = '0'; nextVal = '0'; }
        cell.dataset.val = nextVal;
        cell.className = `kmap-builder-cell ${nextVal === '1' ? 'val-1' : nextVal === 'X' ? 'val-X' : ''}`;
        cell.textContent = next;

        // Update arrays
        minterms = minterms.filter(x => x !== m);
        dontcares = dontcares.filter(x => x !== m);
        if (nextVal === '1') minterms.push(m);
        else if (nextVal === 'X') dontcares.push(m);
      });
    });

    container.querySelector('#kmapVars')?.addEventListener('change', (e) => {
      // Reopen with new var count
      const nv = parseInt(e.target.value);
      container._numVars = nv;
      // Recreate
      openKMapEditor({ data: { vars: Array(nv).fill(''), minterms: [], dontcares: [] } });
    });

    container.querySelector('#kmapClear')?.addEventListener('click', () => {
      minterms = []; dontcares = [];
      container.querySelectorAll('.kmap-builder-cell').forEach(c => {
        c.dataset.val = '0'; c.className = 'kmap-builder-cell'; c.textContent = '0';
      });
    });

    container.querySelector('#kmapDone')?.addEventListener('click', () => {
      const vars = numVars === 4 ? ['A','B','C','D'] : numVars === 3 ? ['A','B','C'] : ['A','B'];
      QB.currentDiagram = { type: 'kmap', data: { vars, minterms, dontcares } };
      renderDiagramArea();
      modal.classList.add('hidden');
    });

    container.querySelector('#kmapCancel')?.addEventListener('click', () => modal.classList.add('hidden'));
  }

  render();
}

// ── Code Editor (simple textarea with syntax preview) ──
function openCodeEditor(existing) {
  const modal = $('diagramEditorModal');
  modal.classList.remove('hidden');

  let language = existing?.data?.language || 'c';
  let code = existing?.data?.code || '#include <stdio.h>\n\nint main() {\n    printf("Hello, GATE!\\n");\n    return 0;\n}';
  let highlightLines = existing?.data?.highlightLines || [];
  const container = $('diagramEditorContent');

  container.innerHTML = `
    <div class="code-builder-controls">
      <label>Language:</label>
      <select id="codeLang" style="padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);">
        <option value="c" ${language==='c'?'selected':''}>C</option>
        <option value="python" ${language==='python'?'selected':''}>Python</option>
        <option value="java" ${language==='java'?'selected':''}>Java</option>
      </select>
      <label>Highlight lines (comma-separated):</label>
      <input type="text" id="codeHighlight" value="${highlightLines.join(',')}" style="width:120px;padding:6px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);">
      <button class="btn-primary" id="codeDone" style="margin-left:auto;">Done</button>
      <button class="btn-outline" id="codeCancel">Cancel</button>
    </div>
    <textarea id="codeTextarea" class="code-textarea">${code}</textarea>
  `;

  container.querySelector('#codeDone').addEventListener('click', () => {
    language = container.querySelector('#codeLang').value;
    code = container.querySelector('#codeTextarea').value;
    highlightLines = container.querySelector('#codeHighlight').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    QB.currentDiagram = { type: 'code', data: { language, code, highlightLines } };
    renderDiagramArea();
    modal.classList.add('hidden');
  });

  container.querySelector('#codeCancel').addEventListener('click', () => modal.classList.add('hidden'));
}

// ── Image Upload ──
function openImageEditor(existing) {
  const modal = $('diagramEditorModal');
  modal.classList.remove('hidden');
  let imageData = existing?.imageBase64 || null;
  const container = $('diagramEditorContent');

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <strong style="color:var(--text-secondary)">Upload Image</strong>
      <div style="display:flex;gap:8px;">
        <button class="btn-primary" id="imgDone" ${!imageData ? 'disabled style="opacity:0.5"' : ''}>Done</button>
        <button class="btn-outline" id="imgCancel">Cancel</button>
      </div>
    </div>
    <div class="image-drop-zone" id="imgDropZone">
      ${imageData ? `<img src="${imageData}" id="imgPreview">` : '<p>Drop an image here or click to upload</p><input type="file" id="imgFileInput" accept="image/*" style="display:none;">'}
    </div>
    <input type="text" id="imgCaption" class="diagram-caption-input" style="margin-top:12px;" placeholder="Caption (optional)" value="${existing?.caption || ''}">
  `;

  const dz = container.querySelector('#imgDropZone');
  const fi = container.querySelector('#imgFileInput');

  dz.addEventListener('click', () => fi?.click());
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault(); dz.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });
  fi?.addEventListener('change', (e) => { if (e.target.files[0]) readFile(e.target.files[0]); });

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      imageData = e.target.result;
      dz.innerHTML = `<img src="${imageData}" id="imgPreview" style="max-width:100%;max-height:400px;border-radius:8px;">`;
      container.querySelector('#imgDone').disabled = false;
      container.querySelector('#imgDone').style.opacity = '1';
    };
    reader.readAsDataURL(file);
  }

  container.querySelector('#imgDone').addEventListener('click', () => {
    QB.currentDiagram = { type: 'image', imageBase64: imageData, caption: container.querySelector('#imgCaption').value };
    renderDiagramArea();
    modal.classList.add('hidden');
  });
  container.querySelector('#imgCancel').addEventListener('click', () => modal.classList.add('hidden'));
}

// ── Table Editor ──
function openTableEditor(existing) {
  const modal = $('diagramEditorModal');
  modal.classList.remove('hidden');

  let headers = existing?.data?.headers || ['Col1', 'Col2', 'Col3'];
  let rows = existing?.data?.rows || [['', '', ''], ['', '', '']];
  const container = $('diagramEditorContent');

  function render() {
    let html = `
      <div class="table-builder-controls">
        <label>Columns: <input type="number" id="tblCols" value="${headers.length}" min="1" max="10"></label>
        <label>Rows: <input type="number" id="tblRows" value="${rows.length}" min="1" max="20"></label>
        <button class="btn-primary" id="tblDone">Done</button>
        <button class="btn-outline" id="tblCancel">Cancel</button>
      </div>
      <table class="table-editable"><thead><tr>`;
    headers.forEach((h, i) => { html += `<th><input value="${h}" data-col="${i}" class="tbl-header-input"></th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach((row, ri) => {
      html += '<tr>';
      row.forEach((cell, ci) => { html += `<td><input value="${cell}" data-row="${ri}" data-col="${ci}" class="tbl-cell-input"></td>`; });
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;

    container.querySelector('#tblCols').addEventListener('change', (e) => {
      const n = parseInt(e.target.value);
      while (headers.length < n) headers.push(`Col${headers.length + 1}`);
      while (headers.length > n) headers.pop();
      rows.forEach(r => { while (r.length < n) r.push(''); while (r.length > n) r.pop(); });
      render();
    });
    container.querySelector('#tblRows').addEventListener('change', (e) => {
      const n = parseInt(e.target.value);
      while (rows.length < n) rows.push(headers.map(() => ''));
      while (rows.length > n) rows.pop();
      render();
    });
    container.querySelector('#tblDone').addEventListener('click', () => {
      container.querySelectorAll('.tbl-header-input').forEach(inp => { headers[parseInt(inp.dataset.col)] = inp.value; });
      container.querySelectorAll('.tbl-cell-input').forEach(inp => { rows[parseInt(inp.dataset.row)][parseInt(inp.dataset.col)] = inp.value; });
      QB.currentDiagram = { type: 'table', data: { headers, rows, highlight: [] } };
      renderDiagramArea();
      modal.classList.add('hidden');
    });
    container.querySelector('#tblCancel').addEventListener('click', () => modal.classList.add('hidden'));
  }
  render();
}

// ── Gantt Chart Editor ──
function openGanttEditor(existing) {
  const modal = $('diagramEditorModal');
  modal.classList.remove('hidden');
  let processes = existing?.data?.processes || [
    { name: 'P1', start: 0, end: 3, color: '#6c63ff' },
    { name: 'P2', start: 3, end: 6, color: '#48cfad' },
    { name: 'P3', start: 6, end: 9, color: '#ffa94d' }
  ];
  let totalTime = existing?.data?.totalTime || 20;
  const container = $('diagramEditorContent');

  function render() {
    let html = `
      <div class="gantt-controls">
        <button class="btn-small" id="ganttAdd">+ Process</button>
        <label>Total time: <input type="number" id="ganttTotal" value="${totalTime}" min="1" max="100" style="width:60px;padding:4px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);text-align:center;"></label>
        <button class="btn-primary" id="ganttDone" style="margin-left:auto;">Done</button>
        <button class="btn-outline" id="ganttCancel">Cancel</button>
      </div>
      <div id="ganttProcessList"></div>
      <div id="ganttPreview" style="margin-top:16px;"></div>`;
    container.innerHTML = html;

    container.querySelector('#ganttProcessList').innerHTML = processes.map((p, i) =>
      `<div class="gantt-process-row">
        <input value="${p.name}" placeholder="Name" style="width:60px;" class="gantt-name" data-idx="${i}">
        <label>Start: <input type="number" value="${p.start}" min="0" style="width:50px;" class="gantt-start" data-idx="${i}"></label>
        <label>End: <input type="number" value="${p.end}" min="1" style="width:50px;" class="gantt-end" data-idx="${i}"></label>
        <input type="color" value="${p.color}" class="gantt-color" data-idx="${i}" style="width:30px;height:28px;border:none;background:none;cursor:pointer;">
        <button onclick="QB.ganttRemove(${i})" style="background:none;border:none;color:var(--wrong);cursor:pointer;">✕</button>
      </div>`
    ).join('');

    if (window.DR) {
      container.querySelector('#ganttPreview').innerHTML = DR.renderGantt({ processes, totalTime, width: 520 });
    }

    container.querySelectorAll('.gantt-name').forEach(inp => inp.addEventListener('input', (e) => { processes[parseInt(e.target.dataset.idx)].name = e.target.value; }));
    container.querySelectorAll('.gantt-start').forEach(inp => inp.addEventListener('input', (e) => { processes[parseInt(e.target.dataset.idx)].start = parseInt(e.target.value) || 0; }));
    container.querySelectorAll('.gantt-end').forEach(inp => inp.addEventListener('input', (e) => { processes[parseInt(e.target.dataset.idx)].end = parseInt(e.target.value) || 1; }));
    container.querySelectorAll('.gantt-color').forEach(inp => inp.addEventListener('input', (e) => { processes[parseInt(e.target.dataset.idx)].color = e.target.value; }));

    container.querySelector('#ganttAdd').addEventListener('click', () => {
      const colors = ['#6c63ff','#48cfad','#ffa94d','#ff6b9d','#4ecdc4','#b044ff','#ff6b6b'];
      processes.push({ name: `P${processes.length + 1}`, start: processes.length * 3, end: (processes.length + 1) * 3, color: colors[processes.length % colors.length] });
      render();
    });

    container.querySelector('#ganttDone').addEventListener('click', () => {
      totalTime = parseInt(container.querySelector('#ganttTotal').value) || 20;
      QB.currentDiagram = { type: 'gantt', data: { processes, totalTime, width: 520 } };
      renderDiagramArea();
      modal.classList.add('hidden');
    });
    container.querySelector('#ganttCancel').addEventListener('click', () => modal.classList.add('hidden'));
  }
  QB.ganttRemove = (i) => { processes.splice(i, 1); render(); };
  render();
}

// ── Circuit Editor ──
function openCircuitEditor(existing) {
  const modal = $('diagramEditorModal');
  modal.classList.remove('hidden');
  let gates = existing?.data?.gates || [
    { type: 'AND', x: 100, y: 80, label: 'G1' },
    { type: 'NOT', x: 100, y: 140, label: 'G2' },
    { type: 'OR', x: 250, y: 110, label: 'G3' }
  ];
  let wires = existing?.data?.wires || [
    { points: [[50,60],[100,70]] },
    { points: [[50,100],[100,90]] },
    { points: [[50,140],[100,140]] },
    { points: [[150,80],[250,100]] },
    { points: [[140,140],[250,120]] }
  ];
  let inputs = existing?.data?.inputs || [{ label: 'A', x: 20, y: 60 }, { label: 'B', x: 20, y: 100 }, { label: 'C', x: 20, y: 140 }];
  let outputs = existing?.data?.outputs || [{ label: 'F', x: 310, y: 110 }];
  const container = $('diagramEditorContent');

  const GATE_TYPES = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'];

  function render() {
    let html = `
      <div class="gantt-controls">
        <button class="btn-small" id="circuitAddGate">+ Gate</button>
        <button class="btn-small" id="circuitAddWire">+ Wire</button>
        <button class="btn-primary" id="circuitDone" style="margin-left:auto;">Done</button>
        <button class="btn-outline" id="circuitCancel">Cancel</button>
      </div>
      <div id="circuitGatesList" style="margin:8px 0;"></div>
      <div id="circuitPreview" style="margin-top:16px;"></div>`;
    container.innerHTML = html;

    container.querySelector('#circuitGatesList').innerHTML = '<strong style="font-size:0.82rem;color:var(--text-muted)">GATES:</strong> ' +
      gates.map((g, i) => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;margin:4px;border-radius:6px;background:var(--bg-tertiary);border:1px solid var(--border);font-size:0.82rem;">
        ${g.type} (${g.label}) at (${g.x},${g.y})
        <button onclick="QB.circuitRemoveGate(${i})" style="background:none;border:none;color:var(--wrong);cursor:pointer;">✕</button>
      </span>`).join('');

    if (window.DR) {
      container.querySelector('#circuitPreview').innerHTML = DR.renderCircuit({ gates, wires, inputs, outputs, width: 400, height: 200 });
    }

    container.querySelector('#circuitAddGate').addEventListener('click', () => {
      const type = prompt('Gate type (AND/OR/NOT/NAND/NOR/XOR):', 'AND');
      if (!type || !GATE_TYPES.includes(type.toUpperCase())) return;
      const label = prompt('Label:', `G${gates.length + 1}`);
      gates.push({ type: type.toUpperCase(), x: 80 + gates.length * 120, y: 100, label: label || `G${gates.length}` });
      render();
    });

    container.querySelector('#circuitDone').addEventListener('click', () => {
      QB.currentDiagram = { type: 'circuit', data: { gates, wires, inputs, outputs, width: 400, height: 200 } };
      renderDiagramArea();
      modal.classList.add('hidden');
    });
    container.querySelector('#circuitCancel').addEventListener('click', () => modal.classList.add('hidden'));
  }
  QB.circuitRemoveGate = (i) => { gates.splice(i, 1); render(); };
  render();
}

// ── Memory Layout Editor ──
function openMemoryEditor(existing) {
  const modal = $('diagramEditorModal');
  modal.classList.remove('hidden');
  let segments = existing?.data?.segments || [
    { label: 'Code', size: 1, color: 'rgba(108,99,255,0.5)' },
    { label: 'Data', size: 1, color: 'rgba(72,207,173,0.4)' },
    { label: 'Heap', size: 2, color: 'rgba(255,169,77,0.4)' },
    { label: 'Stack', size: 1, color: 'rgba(255,107,107,0.4)' }
  ];
  const container = $('diagramEditorContent');

  function render() {
    let html = `
      <div class="gantt-controls">
        <button class="btn-small" id="memAddSegment">+ Segment</button>
        <button class="btn-primary" id="memDone" style="margin-left:auto;">Done</button>
        <button class="btn-outline" id="memCancel">Cancel</button>
      </div>
      <div id="memSegList"></div>
      <div id="memPreview" style="margin-top:16px;"></div>`;
    container.innerHTML = html;

    container.querySelector('#memSegList').innerHTML = segments.map((s, i) =>
      `<div class="gantt-process-row">
        <input value="${s.label}" placeholder="Label" style="width:80px;" class="mem-label" data-idx="${i}">
        <label>Size: <input type="number" value="${s.size}" min="1" max="10" style="width:50px;" class="mem-size" data-idx="${i}"></label>
        <input type="color" value="${s.color.match(/#[0-9a-f]+/)?.[0] || '#6c63ff'}" class="mem-color" data-idx="${i}" style="width:30px;height:28px;border:none;background:none;cursor:pointer;">
        <button onclick="QB.memRemove(${i})" style="background:none;border:none;color:var(--wrong);cursor:pointer;">✕</button>
      </div>`
    ).join('');

    if (window.DR) {
      container.querySelector('#memPreview').innerHTML = DR.renderMemory({ segments, width: 500 });
    }

    container.querySelectorAll('.mem-label').forEach(inp => inp.addEventListener('input', (e) => { segments[parseInt(e.target.dataset.idx)].label = e.target.value; }));
    container.querySelectorAll('.mem-size').forEach(inp => inp.addEventListener('input', (e) => { segments[parseInt(e.target.dataset.idx)].size = parseInt(e.target.value) || 1; }));
    container.querySelectorAll('.mem-color').forEach(inp => inp.addEventListener('input', (e) => {
      const c = e.target.value;
      segments[parseInt(e.target.dataset.idx)].color = c + '80';
    }));

    container.querySelector('#memAddSegment').addEventListener('click', () => {
      segments.push({ label: `Seg${segments.length + 1}`, size: 1, color: 'rgba(176,68,255,0.4)' });
      render();
    });
    container.querySelector('#memDone').addEventListener('click', () => {
      QB.currentDiagram = { type: 'memory', data: { segments, width: 500 } };
      renderDiagramArea();
      modal.classList.add('hidden');
    });
    container.querySelector('#memCancel').addEventListener('click', () => modal.classList.add('hidden'));
  }
  QB.memRemove = (i) => { segments.splice(i, 1); render(); };
  render();
}

/* ─── Render Diagram Area ─────────────────────────────────── */
function renderDiagramArea() {
  if (!QB.currentDiagram) {
    $('diagramArea').classList.add('hidden');
    return;
  }
  $('diagramArea').classList.remove('hidden');
  const d = QB.currentDiagram;
  $('diagramTypeLabel').textContent = d.type.toUpperCase();

  if (window.DR && d.type !== 'image') {
    DR.renderDiagram(d, $('diagramPreview'));
  } else if (d.type === 'image' && d.imageBase64) {
    $('diagramPreview').innerHTML = `<img src="${d.imageBase64}" style="max-width:100%;max-height:300px;border-radius:8px;">`;
  }
  updatePreview();
}

/* ─── Wire Events ─────────────────────────────────────────── */
function initEvents() {
  initEditor();
  initOptionsEditor();
  initSymbolPicker();

  // Math modal
  $('insertInlineMath').addEventListener('click', () => openMathModal('inline'));
  $('insertBlockMath').addEventListener('click', () => openMathModal('block'));
  $('insertSymbol').addEventListener('click', () => $('symbolModal').classList.remove('hidden'));
  $('closeMathModal').addEventListener('click', closeMathModal);
  $('cancelMathBtn').addEventListener('click', closeMathModal);
  $('insertMathBtn').addEventListener('click', insertMath);
  $('mathLatexInput').addEventListener('input', updateMathPreview);
  $('closeSymbolModal').addEventListener('click', () => $('symbolModal').classList.add('hidden'));
  document.querySelectorAll('.math-modal-overlay').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
  });
  document.querySelectorAll('.math-btn').forEach(btn => {
    if (btn.dataset.sym) btn.addEventListener('click', () => {
      const ta = $('mathLatexInput');
      const s = btn.dataset.sym;
      const start = ta.selectionStart;
      ta.value = ta.value.substring(0, start) + s + ta.value.substring(ta.selectionEnd);
      ta.focus(); ta.setSelectionRange(start + s.length, start + s.length);
      updateMathPreview();
    });
  });

  // Math symbols in modal
  document.querySelectorAll('.sym-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ta = $('mathLatexInput');
      if (!ta) return;
      const s = btn.dataset.sym;
      const start = ta.selectionStart;
      ta.value = ta.value.substring(0, start) + s + ta.value.substring(ta.selectionEnd);
      ta.focus(); ta.setSelectionRange(start + s.length, start + s.length);
      updateMathPreview();
    });
  });

  // Diagram palette
  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.diagram;
      switch(type) {
        case 'graph': openGraphEditor(QB.currentDiagram?.type === 'graph' ? QB.currentDiagram : null); break;
        case 'tree': openTreeEditorSimple(QB.currentDiagram?.type === 'tree' ? QB.currentDiagram : null); break;
        case 'automaton': openDFAEditor(QB.currentDiagram?.type === 'automaton' ? QB.currentDiagram : null); break;
        case 'kmap': openKMapEditor(QB.currentDiagram?.type === 'kmap' ? QB.currentDiagram : null); break;
        case 'table': openTableEditor(QB.currentDiagram?.type === 'table' ? QB.currentDiagram : null); break;
        case 'code': openCodeEditor(QB.currentDiagram?.type === 'code' ? QB.currentDiagram : null); break;
        case 'gantt': openGanttEditor(QB.currentDiagram?.type === 'gantt' ? QB.currentDiagram : null); break;
        case 'image': openImageEditor(QB.currentDiagram?.type === 'image' ? QB.currentDiagram : null); break;
        case 'circuit': openCircuitEditor(QB.currentDiagram?.type === 'circuit' ? QB.currentDiagram : null); break;
        case 'memory': openMemoryEditor(QB.currentDiagram?.type === 'memory' ? QB.currentDiagram : null); break;
        default: showToast(`${type} editor coming soon`, 'info');
      }
    });
  });

  // Edit/Remove diagram
  $('editDiagramBtn')?.addEventListener('click', () => {
    if (!QB.currentDiagram) return;
    const btn = document.querySelector(`.palette-btn[data-diagram="${QB.currentDiagram.type}"]`);
    if (btn) btn.click();
  });
  $('removeDiagramBtn')?.addEventListener('click', () => {
    QB.currentDiagram = null;
    renderDiagramArea();
  });

  // Diagram caption
  $('diagramCaption')?.addEventListener('input', (e) => {
    if (QB.currentDiagram) QB.currentDiagram.caption = e.target.value;
  });

  // Save
  $('saveBtn').addEventListener('click', saveQuestion);
  $('exportBtn').addEventListener('click', exportQuestions);

  // Load JSON
  $('loadJsonBtn').addEventListener('click', () => $('loadJsonModal').classList.remove('hidden'));
  $('closeLoadModal').addEventListener('click', () => $('loadJsonModal').classList.add('hidden'));
  $('loadJsonCancel').addEventListener('click', () => $('loadJsonModal').classList.add('hidden'));
  $('loadJsonConfirm').addEventListener('click', loadFromJSON);

  // Preview toggle
  $('togglePreview').addEventListener('click', () => {
    $('previewBody').classList.toggle('hidden');
  });

  // Explanation update
  $('explanationInput').addEventListener('input', updatePreview);
  $('natAnswerInput').addEventListener('input', updatePreview);

  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    }
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.add('hidden');
    });
  });
}

/* ─── Simple Tree Editor ──────────────────────────────────── */
function openTreeEditorSimple(existing) {
  const modal = $('diagramEditorModal');
  modal.classList.remove('hidden');

  let root = existing?.data?.root || {
    label: '50', children: [
      { label: '30', children: [{ label: '20', children: [] }, { label: '40', children: [] }] },
      { label: '70', children: [{ label: '60', children: [] }, { label: '80', children: [] }] }
    ]
  };

  const container = $('diagramEditorContent');

  function render() {
    let html = `
      <div class="tree-toolbar">
        <button class="btn-small" id="treeAddChild">+ Add Child to Selected</button>
        <button class="btn-small" id="treeRemoveChild">- Remove Selected</button>
        <button class="btn-primary" id="treeDone" style="margin-left:auto;">Done</button>
        <button class="btn-outline" id="treeCancel">Cancel</button>
      </div>
      <div id="treePreview" style="margin-top:16px;"></div>
      <div id="treeNodeList" style="margin-top:12px;"></div>`;

    container.innerHTML = html;

    // Flatten tree for node list
    function flatten(node, path = '') {
      let items = [{ label: node.label, path }];
      (node.children || []).forEach((c, i) => {
        items = items.concat(flatten(c, `${path}${i}`));
      });
      return items;
    }

    const allNodes = flatten(root);
    container.querySelector('#treeNodeList').innerHTML = '<strong style="font-size:0.82rem;color:var(--text-muted)">NODES (click to select):</strong> ' +
      allNodes.map((n, i) => `<span class="tree-node-btn" data-path="${n.path}" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;margin:4px;border-radius:6px;background:var(--bg-tertiary);border:1px solid var(--border);font-size:0.82rem;cursor:pointer;${i === 0 ? 'border-color:var(--accent-purple);' : ''}">${n.label}</span>`).join('');

    // Preview
    if (window.DR) {
      container.querySelector('#treePreview').innerHTML = DR.renderTree({
        root, width: 480, nodeRadius: 20, levelHeight: 60
      });
    }

    let selectedPath = '0';
    container.querySelectorAll('.tree-node-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tree-node-btn').forEach(b => b.style.borderColor = 'var(--border)');
        btn.style.borderColor = 'var(--accent-purple)';
        selectedPath = btn.dataset.path;
      });
    });

    function getNodeByPath(path) {
      let node = root;
      for (let i = 0; i < path.length; i++) {
        node = node.children[parseInt(path[i])];
      }
      return node;
    }

    container.querySelector('#treeAddChild').addEventListener('click', () => {
      const node = getNodeByPath(selectedPath);
      if (!node.children) node.children = [];
      const label = prompt('Child label:');
      if (label) { node.children.push({ label, children: [] }); render(); }
    });

    container.querySelector('#treeRemoveChild').addEventListener('click', () => {
      if (selectedPath.length <= 1) { showToast('Cannot remove root', 'error'); return; }
      const parentPath = selectedPath.slice(0, -1);
      const idx = parseInt(selectedPath.slice(-1));
      const parent = getNodeByPath(parentPath);
      parent.children.splice(idx, 1);
      selectedPath = parentPath;
      render();
    });

    container.querySelector('#treeDone').addEventListener('click', () => {
      QB.currentDiagram = { type: 'tree', data: { root, width: 480, nodeRadius: 20, levelHeight: 60 } };
      renderDiagramArea();
      modal.classList.add('hidden');
    });
    container.querySelector('#treeCancel').addEventListener('click', () => modal.classList.add('hidden'));
  }
  render();
}

/* ─── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  updatePreview();

  // Load from localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('gateBuilderQuestions') || '[]');
    QB.questions = saved;
    $('questionCountBadge').textContent = `${QB.questions.length} saved`;
  } catch(e) {}

  // Auto-save
  setInterval(() => {
    localStorage.setItem('gateBuilderQuestions', JSON.stringify(QB.questions));
  }, 10000);
});
