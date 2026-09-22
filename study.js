/* GATE CS Study Notes Viewer — study.js */
'use strict';

let studyContent = [];
let pdfDoc = null;
let currentPdfPath = '';
let currentPage = 1;
let studyReturnScreen = 'home';

const IS_PRODUCTION = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const PDF_BASE_URL = IS_PRODUCTION
  ? 'https://github.com/dhansuhkumar/gate-cs-portal/releases/download/study-pdfs'
  : './pdfs';

const PDF_PATH_MAP = {
  'Algorithm_RBR_Notes.pdf': `${PDF_BASE_URL}/01_Algorithm/Algorithm_RBR_Notes.pdf`,
  'Algorithm_AppliedCourse_Notes.pdf': `${PDF_BASE_URL}/01_Algorithm/Algorithm_AppliedCourse_Notes.pdf`,
  'Algorithm_Madeeasy_Notes.pdf': `${PDF_BASE_URL}/01_Algorithm/Algorithm_Madeeasy_Notes.pdf`,
  'C_Programming_AppliedCourse_Notes.pdf': `${PDF_BASE_URL}/02_C_Programming/C_Programming_AppliedCourse_Notes.pdf`,
  'C_Programming_Madeeasy_Notes.pdf': `${PDF_BASE_URL}/02_C_Programming/C_Programming_Madeeasy_Notes.pdf`,
  'DataStructure_RBR_Notes.pdf': `${PDF_BASE_URL}/03_Data_Structure/DataStructure_RBR_Notes.pdf`,
  'DataStructure_AppliedCourse_Notes.pdf': `${PDF_BASE_URL}/03_Data_Structure/DataStructure_AppliedCourse_Notes.pdf`,
  'ComputerNetwork_RBR_Notes.pdf': `${PDF_BASE_URL}/04_Computer_Network/ComputerNetwork_RBR_Notes.pdf`,
  'ComputerNetwork_Madeeasy_Notes.pdf': `${PDF_BASE_URL}/04_Computer_Network/ComputerNetwork_Madeeasy_Notes.pdf`,
  'ComputerNetwork_AppliedCourse_1.pdf': `${PDF_BASE_URL}/04_Computer_Network/ComputerNetwork_AppliedCourse_1.pdf`,
  'ComputerNetwork_AppliedCourse_2.pdf': `${PDF_BASE_URL}/04_Computer_Network/ComputerNetwork_AppliedCourse_2.pdf`,
  'ComputerOrg_Madeeasy_Notes.pdf': `${PDF_BASE_URL}/05_Computer_Organization/ComputerOrg_Madeeasy_Notes.pdf`,
  'ComputerOrg_AppliedCourse_Notes.pdf': `${PDF_BASE_URL}/05_Computer_Organization/ComputerOrg_AppliedCourse_Notes.pdf`,
  'CompilerDesign_Madeeasy_Notes.pdf': `${PDF_BASE_URL}/06_Compiler_Design/CompilerDesign_Madeeasy_Notes.pdf`,
  'CompilerDesign_IGATE_Notes.pdf': `${PDF_BASE_URL}/06_Compiler_Design/CompilerDesign_IGATE_Notes.pdf`,
  'DBMS_RBR_Notes.pdf': `${PDF_BASE_URL}/07_DBMS/DBMS_RBR_Notes.pdf`,
  'DBMS_Madeeasy_Notes.pdf': `${PDF_BASE_URL}/07_DBMS/DBMS_Madeeasy_Notes.pdf`,
  'DBMS_AppliedCourse_Notes.pdf': `${PDF_BASE_URL}/07_DBMS/DBMS_AppliedCourse_Notes.pdf`,
  'DigitalLogic_RBR_Notes.pdf': `${PDF_BASE_URL}/08_Digital_Logic/DigitalLogic_RBR_Notes.pdf`,
  'DigitalLogic_Madeeasy_Notes.pdf': `${PDF_BASE_URL}/08_Digital_Logic/DigitalLogic_Madeeasy_Notes.pdf`,
  'SetTheory_RBR_Notes.pdf': `${PDF_BASE_URL}/09_Discrete_Mathematics/SetTheory_RBR_Notes.pdf`,
  'GraphTheory_RBR_Notes.pdf': `${PDF_BASE_URL}/09_Discrete_Mathematics/GraphTheory_RBR_Notes.pdf`,
  'Combinatorics_RBR_Notes.pdf': `${PDF_BASE_URL}/09_Discrete_Mathematics/Combinatorics_RBR_Notes.pdf`,
  'GATE_CSE_2026_Syllabus.pdf': `${PDF_BASE_URL}/13_Syllabus/GATE_CSE_2026_Syllabus.pdf`,
  'GATE_General_Aptitude_2026_Syllabus.pdf': `${PDF_BASE_URL}/13_Syllabus/GATE_General_Aptitude_2026_Syllabus.pdf`
};

function openStudy() {
  if (typeof showScreen !== 'function') { console.error('app.js not loaded'); return; }
  showScreen('study');
  if (!studyContent.length) loadStudyContent();
  else renderStudySidebar();
}

function closeStudy() { showScreen(studyReturnScreen || 'home'); }

function loadStudyContent() {
  fetch('study-content.json')
    .then(r => r.json())
    .then(data => {
      studyContent = data;
      renderStudySidebar();
    })
    .catch(err => {
      $('studySidebar').innerHTML = '<p style="color:var(--wrong);padding:16px">⚠️ study-content.json not found or blocked by CORS. Serve over http: `python -m http.server 8080` from D:\\Gate and open /web-app/.</p>';
    });
}

function renderStudySidebar() {
  const sidebar = $('studySidebar');
  const subjects = {};
  studyContent.forEach(ch => {
    if (!subjects[ch.subject]) subjects[ch.subject] = [];
    subjects[ch.subject].push(ch);
  });
  const names = Object.keys(subjects);
  if (names.length === 0) {
    sidebar.innerHTML = '<p class="empty-state">Loading study content...</p>';
    return;
  }
  sidebar.innerHTML = names.map(subj => `
    <div class="study-subject-block">
      <h4 class="study-subject-title" onclick="toggleStudySubject('${subj.replace(/'/g, "\\'")}')">${subj} ▸</h4>
      <div class="study-chapter-list" id="chapList_${subj.replace(/\s+/g, '_')}">
        ${subjects[subj].map(ch => `
          <div class="study-chapter-item" onclick="openChapterFromSidebar(${studyContent.indexOf(ch)})">
            <span class="study-chapter-name">${ch.chapter}</span>
            <span class="study-chapter-pages">p.${ch.pageStart}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function toggleStudySubject(subj) {
  const key = 'chapList_' + subj.replace(/\s+/g, '_');
  const el = document.getElementById(key);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function openChapterFromSidebar(idx) {
  const ch = studyContent[idx];
  if (ch) openChapter(ch);
}

function openChapter(ch) {
  const pdfPath = PDF_PATH_MAP[ch.sourcePDF];
  if (!pdfPath) {
    $('studyPlaceholder').innerHTML = `<p>No PDF mapping for ${ch.sourcePDF}.</p>`;
    $('studyPlaceholder').classList.remove('hidden');
    $('pdfViewerContainer').classList.add('hidden');
    return;
  }
  $('studyPlaceholder').classList.add('hidden');
  $('pdfViewerContainer').classList.remove('hidden');
  $('pdfViewerTitle').textContent = `${ch.subject} > ${ch.chapter}`;
  loadPDF(pdfPath, ch.pageStart);
}

function openNotesFromQuestion(pdfFile, pageNum) {
  openStudy();
  const found = studyContent.find(ch => ch.sourcePDF === pdfFile);
  if (found) {
    openChapter(found);
    return;
  }
  const path = PDF_PATH_MAP[pdfFile];
  if (path) {
    $('studyPlaceholder').classList.add('hidden');
    $('pdfViewerContainer').classList.remove('hidden');
    $('pdfViewerTitle').textContent = pdfFile;
    loadPDF(path, pageNum || 1);
  } else {
    loadStudyContent();
    const t = setInterval(() => {
      const ch2 = studyContent.find(c => c.sourcePDF === pdfFile);
      if (ch2) { openChapter(ch2); clearInterval(t); }
    }, 300);
    setTimeout(() => clearInterval(t), 5000);
  }
}

async function loadPDF(path, pageNumber = 1) {
  currentPdfPath = path;
  currentPage = pageNumber;
  try {
    // pdf.js handles cross-origin if server sends CORS headers
    // GitHub releases: Access-Control-Allow-Origin: *
    const loadingTask = pdfjsLib.getDocument({ url: path, cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/', cMapPacked: true });
    pdfDoc = await loadingTask.promise;
    renderPage(currentPage);
  } catch (err) {
    console.error('PDF load error:', err);
    $('pdfViewerTitle').textContent = `⚠️ Could not load PDF: ${err.message}. Path: ${path}`;
  }
}

function renderPage(pageNum) {
  if (!pdfDoc) return;
  pdfDoc.getPage(pageNum).then(page => {
    const container = $('pdfCanvasContainer');
    const scale = 1.2;
    const viewport = page.getViewport({ scale });
    let canvas = container.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      container.appendChild(canvas);
    }
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    page.render({ canvasContext: ctx, viewport }).promise.then(() => {
      $('pdfPageLabel').textContent = `Page ${currentPage} / ${pdfDoc.numPages}`;
    });
  });
}

function nextPage() {
  if (pdfDoc && currentPage < pdfDoc.numPages) {
    currentPage++;
    renderPage(currentPage);
  }
}

function prevPage() {
  if (pdfDoc && currentPage > 1) {
    currentPage--;
    renderPage(currentPage);
  }
}

function searchStudy(query) {
  const q = query.toLowerCase().trim();
  if (!q) { renderStudySidebar(); return; }
  const matches = studyContent.filter(ch => (ch.chapter + ' ' + ch.content).toLowerCase().includes(q)).slice(0, 15);
  if (matches.length === 0) {
    $('studySidebar').innerHTML = '<p class="empty-state">No matches found.</p>';
    return;
  }
  $('studySidebar').innerHTML = matches.map(ch => `
    <div class="study-chapter-item" onclick="openChapterFromSidebar(${studyContent.indexOf(ch)})">
      <span class="study-chapter-name">${ch.subject} &gt; ${ch.chapter}</span>
      <span class="study-chapter-pages">p.${ch.pageStart}</span>
    </div>
  `).join('');
}

// Wire UI events after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const input = $('studySearchInput');
  if (input) input.addEventListener('input', e => searchStudy(e.target.value));
  const closeBtn = $('closeStudyBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeStudy);
  const studyBtn = document.getElementById('studyBtn');
  if (studyBtn) studyBtn.addEventListener('click', e => { e.preventDefault(); openStudy(); });
});