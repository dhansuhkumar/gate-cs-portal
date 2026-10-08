/* Generates pdf-manifest.json from pdfs/ folder and appends new entries to study-content.json */
'use strict';
const fs = require('fs');
const path = require('path');

const PDFS_DIR = path.join(__dirname, '..', 'pdfs');
const MANIFEST_OUT = path.join(__dirname, '..', 'pdf-manifest.json');
const CONTENT_FILE = path.join(__dirname, '..', 'study-content.json');

const SUBJECT_BY_FOLDER = {
  '01_Algorithm': 'Algorithms',
  '01_Official_GATE_Papers': 'Official GATE Papers',
  '02_C_Programming': 'C Programming',
  '03_Data_Structure': 'Data Structures',
  '04_Computer_Network': 'Computer Networks',
  '05_Computer_Organization': 'Computer Organization',
  '06_Compiler_Design': 'Compiler Design',
  '07_DBMS': 'DBMS',
  '08_Digital_Logic': 'Digital Logic',
  '09_Discrete_Mathematics': 'Discrete Mathematics',
  '10_Engineering_Mathematics': 'Engineering Mathematics',
  '11_Operating_System': 'Operating System',
  '12_Theory_of_Computation': 'Theory of Computation',
  '13_Syllabus': 'Syllabus & Revision',
  '14_Mock_Tests_Links': 'Mock Tests',
  '15_PYQs_Links': 'PYQs'
};

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) out.push(full);
  }
  return out;
}

function prettify(name) {
  return name
    .replace(/\.pdf$/i, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 1. Manifest: filename -> relative path (first occurrence wins, but prefer non-data-structure for Programming DS)
const files = walk(PDFS_DIR).map(f => path.relative(PDFS_DIR, f).replace(/\\/g, '/'));
const manifest = {};
const sorted = files.sort((a, b) => {
  const pa = a.includes('03_Data_Structure') && a.includes('MadeEasy_Programming') ? 1 : 0;
  const pb = b.includes('03_Data_Structure') && b.includes('MadeEasy_Programming') ? 1 : 0;
  return pa - pb;
});
for (const rel of sorted) {
  const name = path.basename(rel);
  if (!manifest[name]) manifest[name] = rel;
}
fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest entries:', Object.keys(manifest).length);

// 2. Append new study-content entries for files not already referenced
const content = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
const existing = new Set(content.map(ch => ch.sourcePDF));
let added = 0;
const seen = new Set();
for (const rel of files.sort()) {
  const name = path.basename(rel);
  if (existing.has(name) || seen.has(name)) continue;
  seen.add(name);
  const folder = rel.split('/')[0];
  const subject = SUBJECT_BY_FOLDER[folder];
  if (!subject) { console.log('no subject for', rel); continue; }
  content.push({
    subject,
    chapter: prettify(name),
    sourcePDF: name,
    pageStart: 1,
    pageEnd: 1,
    content: '',
    keyFormulas: []
  });
  added++;
}
fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 1) + '\n');
console.log('study-content entries added:', added, '| total:', content.length);
