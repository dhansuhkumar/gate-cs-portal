/* ============================================================
   diagram-renderer.js
   Handles rendering of all visual question elements:
   - Math formulas (KaTeX)
   - Graphs (SVG node+edge)
   - Finite Automata (SVG with curved transitions)
   - Binary Trees (SVG recursive layout)
   - K-maps (HTML grid with grouping highlights)
   - Truth Tables / DP Tables (HTML)
   - Code blocks (syntax highlighted)
   - Logic gates (SVG)
   - Gantt charts (SVG)
   - Memory / Packet layout diagrams (SVG)
   ============================================================ */

'use strict';

// Local escapeHtml (also defined in app.js, but DR loads first)
function escapeHtml(text) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(text)));
  return d.innerHTML;
}

// ─── KaTeX math rendering ─────────────────────────────────────
const DR = {

  /**
   * Render a question's text (with inline math) + diagram
   * Replaces $...$ with KaTeX, renders diagram below.
   */
  renderQuestion(q, container) {
    // 1. Render question text with math
    const textEl = container.querySelector('.question-text');
    if (textEl) {
      textEl.innerHTML = DR.renderMath(q.question);
    }

    // 2. Render diagram if present
    const diagContainer = container.querySelector('.question-diagram');
    if (q.diagram) {
      diagContainer.innerHTML = '';
      diagContainer.classList.remove('hidden');
      DR.renderDiagram(q.diagram, diagContainer);
    } else {
      if (diagContainer) diagContainer.classList.add('hidden');
    }

    // 3. Render options with math
    if (q.options) {
      container.querySelectorAll('.option-text').forEach((el, i) => {
        if (q.options[i]) el.innerHTML = DR.renderMath(q.options[i]);
      });
    }
  },

  /**
   * Convert $...$ and $$...$$ patterns to KaTeX HTML
   * Also handles Unicode symbol shortcodes like \forall, \exists etc.
   */
  renderMath(text) {
    if (!text) return '';
    
    // First: Convert markdown images ![alt](url) to <img> tags BEFORE escaping
    let result = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="question-image" loading="lazy">`;
    });
    
    // Then escape remaining HTML
    result = escapeHtml(result);
    
    // Restore the <img> tags (they got escaped)
    result = result.replace(/<img src="([^&]+)" alt="([^&]+)" class="question-image" loading="lazy">/g,
      '<img src="$1" alt="$2" class="question-image" loading="lazy">');

    // If KaTeX is loaded, render math
    if (typeof katex !== 'undefined') {
      // Display math: $$...$$
      result = result.replace(/\$\$(.+?)\$\$/gs, (_, math) => {
        try {
          return katex.renderToString(math, { displayMode: true, throwOnError: false });
        } catch(e) { return `<code>${math}</code>`; }
      });
      // Inline math: $...$
      result = result.replace(/\$(.+?)\$/g, (_, math) => {
        try {
          return katex.renderToString(math, { displayMode: false, throwOnError: false });
        } catch(e) { return `<code>${math}</code>`; }
      });
    }

    // Convert common symbol shortcodes even without KaTeX
    result = result
      .replace(/\\forall/g, '∀').replace(/\\exists/g, '∃')
      .replace(/\\in/g, '∈').replace(/\\notin/g, '∉')
      .replace(/\\subset/g, '⊂').replace(/\\subseteq/g, '⊆')
      .replace(/\\cup/g, '∪').replace(/\\cap/g, '∩')
      .replace(/\\empty/g, '∅').replace(/\\emptyset/g, '∅')
      .replace(/\\land/g, '∧').replace(/\\lor/g, '∨')
      .replace(/\\lnot/g, '¬').replace(/\\neg/g, '¬')
      .replace(/\\to/g, '→').replace(/\\rightarrow/g, '→')
      .replace(/\\leftrightarrow/g, '↔').replace(/\\iff/g, '↔')
      .replace(/\\oplus/g, '⊕').replace(/\\otimes/g, '⊗')
      .replace(/\\leq/g, '≤').replace(/\\geq/g, '≥')
      .replace(/\\neq/g, '≠').replace(/\\approx/g, '≈')
      .replace(/\\infty/g, '∞').replace(/\\sum/g, 'Σ')
      .replace(/\\prod/g, 'Π').replace(/\\sqrt/g, '√')
      .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ').replace(/\\delta/g, 'δ')
      .replace(/\\epsilon/g, 'ε').replace(/\\lambda/g, 'λ')
      .replace(/\\mu/g, 'μ').replace(/\\sigma/g, 'σ')
      .replace(/\\pi/g, 'π').replace(/\\theta/g, 'θ')
      .replace(/\\Sigma/g, 'Σ').replace(/\\Delta/g, 'Δ')
      .replace(/\\times/g, '×').replace(/\\div/g, '÷')
      .replace(/\\cdot/g, '·').replace(/\\ldots/g, '…')
      // superscripts/subscripts with ^ and _
      .replace(/\^(\{[^}]+\}|[A-Za-z0-9])/g, (_, s) => `<sup>${s.replace(/[{}]/g,'')}</sup>`)
      .replace(/_(\{[^}]+\}|[A-Za-z0-9])/g, (_, s) => `<sub>${s.replace(/[{}]/g,'')}</sub>`);

    // Convert \n to <br>
    result = result.replace(/\\n/g, '<br>');
    return result;
  },

  /**
   * Main diagram dispatcher
   */
  renderDiagram(diagram, container) {
    const { type, data, caption } = diagram;
    let content;

    switch(type) {
      case 'graph':    content = DR.renderGraph(data); break;
      case 'tree':     content = DR.renderTree(data); break;
      case 'automaton':content = DR.renderAutomaton(data); break;
      case 'kmap':     content = DR.renderKmap(data); break;
      case 'table':    content = DR.renderTable(data); break;
      case 'code':     content = DR.renderCode(data); break;
      case 'gantt':    content = DR.renderGantt(data); break;
      case 'circuit':  content = DR.renderCircuit(data); break;
      case 'memory':   content = DR.renderMemory(data); break;
      case 'svg':      content = data.svg; break; // raw SVG
      default: content = `<p style="color:var(--text-muted)">[Diagram: ${type}]</p>`;
    }

    container.innerHTML = content;
    if (caption) {
      container.innerHTML += `<div class="diagram-caption">${DR.renderMath(caption)}</div>`;
    }
  },

  // ─── Graph (directed or undirected) ──────────────────────────
  renderGraph({ nodes, edges, directed = false, width = 500, height = 300, layout = 'auto' }) {
    // Auto-layout nodes in a circle if no positions given
    const n = nodes.length;
    const cx = width / 2, cy = height / 2;
    const r = Math.min(width, height) * 0.35;

    nodes = nodes.map((node, i) => ({
      ...node,
      x: node.x !== undefined ? node.x : cx + r * Math.cos((2 * Math.PI * i / n) - Math.PI/2),
      y: node.y !== undefined ? node.y : cy + r * Math.sin((2 * Math.PI * i / n) - Math.PI/2),
    }));

    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
    const nodeR = 22;
    const arrowId = `arrow_${Math.random().toString(36).slice(2)}`;

    let edgeSvg = '';
    edges.forEach(e => {
      const from = nodeMap[e.from], to = nodeMap[e.to];
      if (!from || !to) return;
      const isSelf = e.from === e.to;
      const color = e.color || 'rgba(108,99,255,0.7)';

      if (isSelf) {
        // Self-loop
        const lx = from.x + nodeR, ly = from.y - nodeR;
        edgeSvg += `
          <path d="M ${from.x+nodeR} ${from.y} Q ${from.x+60} ${from.y-60} ${from.x} ${from.y-nodeR}"
            fill="none" stroke="${color}" stroke-width="1.8"
            ${directed ? `marker-end="url(#${arrowId})"` : ''}/>`;
        if (e.label) edgeSvg += `<text x="${from.x+54}" y="${from.y-54}" class="edge-label">${DR.renderMath(e.label)}</text>`;
        return;
      }

      // Angle between nodes
      const dx = to.x - from.x, dy = to.y - from.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const ux = dx/dist, uy = dy/dist;

      // Start and end points (at circle border)
      const sx = from.x + ux * nodeR, sy = from.y + uy * nodeR;
      const ex = to.x - ux * nodeR, ey = to.y - uy * nodeR;

      // Check for reverse edge (bidirectional → curve)
      const hasReverse = edges.some(e2 => e2.from === e.to && e2.to === e.from);
      let pathD;
      if (hasReverse) {
        const perp = 25;
        const mx = (sx+ex)/2 - uy*perp, my = (sy+ey)/2 + ux*perp;
        pathD = `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
      } else {
        pathD = `M ${sx} ${sy} L ${ex} ${ey}`;
      }

      edgeSvg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.8"
        ${directed ? `marker-end="url(#${arrowId})"` : ''}/>`;

      if (e.label) {
        const midX = (sx+ex)/2, midY = (sy+ey)/2;
        const offset = hasReverse ? 20 : -12;
        edgeSvg += `<text x="${midX - uy*offset}" y="${midY + ux*offset}" class="edge-label">${DR.renderMath(e.label)}</text>`;
      }
    });

    let nodeSvg = nodes.map(node => {
      const fill = node.fill || 'rgba(108,99,255,0.2)';
      const stroke = node.stroke || '#6c63ff';
      const textColor = node.textColor || 'var(--text-primary)';
      return `
        <circle cx="${node.x}" cy="${node.y}" r="${nodeR}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <text x="${node.x}" y="${node.y+1}" class="node-label" fill="${textColor}">${DR.renderMath(String(node.label))}</text>
      `;
    }).join('');

    return `<svg class="diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="${arrowId}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(108,99,255,0.7)"/>
        </marker>
      </defs>
      <style>
        .node-label { text-anchor:middle; dominant-baseline:middle; font-size:13px; font-family:'Inter',sans-serif; font-weight:600; }
        .edge-label { text-anchor:middle; dominant-baseline:middle; font-size:11px; font-family:'Inter',sans-serif; fill:var(--accent-teal); }
      </style>
      ${edgeSvg}
      ${nodeSvg}
    </svg>`;
  },

  // ─── Binary / General Tree ────────────────────────────────────
  renderTree({ root, width = 480, nodeRadius = 20, levelHeight = 60 }) {
    const nodes = [], edges = [];
    let maxDepth = 0;

    // Compute positions
    function layout(node, depth, left, right) {
      if (!node) return;
      maxDepth = Math.max(maxDepth, depth);
      const x = (left + right) / 2;
      const y = depth * levelHeight + nodeRadius + 10;
      const id = `n${nodes.length}`;
      nodes.push({ id, label: node.label, x, y,
        fill: node.fill || 'rgba(108,99,255,0.2)',
        stroke: node.stroke || '#6c63ff',
        highlight: node.highlight || false
      });
      const myIdx = nodes.length - 1;
      const children = node.children || [];
      const step = (right - left) / (children.length || 1);
      children.forEach((child, i) => {
        const childId = `n${nodes.length}`;
        layout(child, depth + 1, left + i * step, left + (i+1) * step);
        edges.push({ from: myIdx, to: nodes.findIndex(n => n.id === childId), label: child.edgeLabel || '' });
      });
    }
    layout(root, 0, 0, width);

    const height = (maxDepth + 1) * levelHeight + nodeRadius * 2 + 20;

    let edgeSvg = edges.map(e => {
      const f = nodes[e.from], t = nodes[e.to];
      if (!f || !t) return '';
      const dx = t.x - f.x, dy = t.y - f.y, dist = Math.sqrt(dx*dx+dy*dy);
      const ux = dx/dist, uy = dy/dist;
      const sx = f.x + ux*nodeRadius, sy = f.y + uy*nodeRadius;
      const ex = t.x - ux*nodeRadius, ey = t.y - uy*nodeRadius;
      return `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="rgba(108,99,255,0.5)" stroke-width="1.8"/>
              ${e.label ? `<text x="${(sx+ex)/2+5}" y="${(sy+ey)/2}" class="edge-label">${e.label}</text>` : ''}`;
    }).join('');

    let nodeSvg = nodes.map(n => {
      const stroke = n.highlight ? '#48cfad' : n.stroke;
      const fill = n.highlight ? 'rgba(72,207,173,0.25)' : n.fill;
      return `<circle cx="${n.x}" cy="${n.y}" r="${nodeRadius}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
              <text x="${n.x}" y="${n.y+1}" class="node-label">${DR.renderMath(String(n.label))}</text>`;
    }).join('');

    return `<svg class="diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .node-label { text-anchor:middle; dominant-baseline:middle; font-size:12px; font-family:'Inter',sans-serif; font-weight:600; fill:var(--text-primary); }
        .edge-label { text-anchor:middle; font-size:10px; font-family:'Inter',sans-serif; fill:var(--accent-teal); }
      </style>
      ${edgeSvg}${nodeSvg}
    </svg>`;
  },

  // ─── Finite Automaton (DFA/NFA) ───────────────────────────────
  renderAutomaton({ states, transitions, width = 560, height = 280 }) {
    const n = states.length;
    const cx = width/2, cy = height/2;
    const r = Math.min(width, height) * 0.33;
    const stateR = 26;
    const arrowId = `fa_${Math.random().toString(36).slice(2)}`;

    // Auto-layout in a circle
    states = states.map((s, i) => ({
      ...s,
      x: s.x !== undefined ? s.x : cx + r * Math.cos((2*Math.PI*i/n) - Math.PI/2),
      y: s.y !== undefined ? s.y : cy + r * Math.sin((2*Math.PI*i/n) - Math.PI/2),
    }));
    const stateMap = Object.fromEntries(states.map(s => [s.id, s]));

    // Group transitions by (from,to) for label stacking
    const transMap = {};
    transitions.forEach(t => {
      const key = `${t.from}->${t.to}`;
      if (!transMap[key]) transMap[key] = { from: t.from, to: t.to, labels: [] };
      transMap[key].labels.push(t.label);
    });

    let edgeSvg = '';
    Object.values(transMap).forEach(({ from, to, labels }) => {
      const f = stateMap[from], t = stateMap[to];
      if (!f || !t) return;
      const label = labels.join(',');
      const isSelf = from === to;
      const hasReverse = transMap[`${to}->${from}`];

      if (isSelf) {
        edgeSvg += `
          <path d="M ${f.x+stateR} ${f.y} Q ${f.x+70} ${f.y-70} ${f.x} ${f.y-stateR}"
            fill="none" stroke="rgba(72,207,173,0.8)" stroke-width="1.8" marker-end="url(#${arrowId})"/>
          <text x="${f.x+60}" y="${f.y-55}" class="edge-label">${label}</text>`;
        return;
      }

      const dx = t.x-f.x, dy = t.y-f.y, dist = Math.sqrt(dx*dx+dy*dy);
      const ux = dx/dist, uy = dy/dist;
      const sx = f.x + ux*stateR, sy = f.y + uy*stateR;
      const ex = t.x - ux*(stateR+4), ey = t.y - uy*(stateR+4);

      let pathD, labelX, labelY;
      if (hasReverse) {
        const perp = 30;
        const mx = (sx+ex)/2 - uy*perp, my = (sy+ey)/2 + ux*perp;
        pathD = `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
        labelX = mx; labelY = my;
      } else {
        pathD = `M ${sx} ${sy} L ${ex} ${ey}`;
        labelX = (sx+ex)/2 - uy*15; labelY = (sy+ey)/2 + ux*15;
      }
      edgeSvg += `<path d="${pathD}" fill="none" stroke="rgba(72,207,173,0.8)" stroke-width="1.8" marker-end="url(#${arrowId})"/>
                  <text x="${labelX}" y="${labelY}" class="edge-label">${label}</text>`;
    });

    // Start arrow
    const startState = states.find(s => s.start);
    let startArrow = '';
    if (startState) {
      startArrow = `<line x1="${startState.x - stateR - 30}" y1="${startState.y}"
        x2="${startState.x - stateR - 4}" y2="${startState.y}"
        stroke="rgba(72,207,173,0.8)" stroke-width="1.8" marker-end="url(#${arrowId})"/>`;
    }

    let stateSvg = states.map(s => {
      const fill = s.fill || (s.accepting ? 'rgba(72,207,173,0.15)' : 'rgba(108,99,255,0.15)');
      const stroke = s.stroke || (s.accepting ? '#48cfad' : '#6c63ff');
      const innerCircle = s.accepting
        ? `<circle cx="${s.x}" cy="${s.y}" r="${stateR-5}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`
        : '';
      return `
        <circle cx="${s.x}" cy="${s.y}" r="${stateR}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        ${innerCircle}
        <text x="${s.x}" y="${s.y+1}" class="node-label" fill="var(--text-primary)">${s.label}</text>
      `;
    }).join('');

    return `<svg class="diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="${arrowId}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(72,207,173,0.8)"/>
        </marker>
      </defs>
      <style>
        .node-label { text-anchor:middle; dominant-baseline:middle; font-size:13px; font-family:'Inter',sans-serif; font-weight:700; }
        .edge-label { text-anchor:middle; dominant-baseline:middle; font-size:11px; font-family:'JetBrains Mono',monospace; fill:var(--accent-orange); font-weight:500; }
      </style>
      ${startArrow}${edgeSvg}${stateSvg}
    </svg>`;
  },

  // ─── K-Map (2,3,4 variable) ───────────────────────────────────
  renderKmap({ vars, minterms, dontcares = [], groups = [] }) {
    const n = vars.length;
    if (n === 2) return DR._kmap2(vars, minterms, dontcares, groups);
    if (n === 3) return DR._kmap3(vars, minterms, dontcares, groups);
    if (n === 4) return DR._kmap4(vars, minterms, dontcares, groups);
    return '<p>Unsupported K-map size</p>';
  },

  _kmapCell(val, isDC, groups, color = '#6c63ff') {
    const content = isDC ? 'X' : val;
    const inGroup = groups && groups.some(g => g.cells.includes(parseInt(val === 'X' ? -1 : val)));
    return { content, inGroup };
  },

  _kmap4(vars, minterms, dontcares, groups) {
    // 4-var kmap: rows = AB (00,01,11,10), cols = CD (00,01,11,10)
    const gray2 = [0,1,3,2];
    const groupColors = ['rgba(255,107,107,0.25)','rgba(72,207,173,0.25)','rgba(255,169,77,0.25)','rgba(108,99,255,0.25)','rgba(176,68,255,0.25)'];

    let html = `<div class="kmap-wrap"><table class="kmap-table">`;
    // Header
    html += `<tr><th class="kmap-header">${vars[0]}${vars[1]}\\${vars[2]}${vars[3]}</th>`;
    gray2.forEach(c => {
      const b = c.toString(2).padStart(2,'0');
      html += `<th class="kmap-header">${b}</th>`;
    });
    html += `</tr>`;

    gray2.forEach(row => {
      const rb = row.toString(2).padStart(2,'0');
      html += `<tr><th class="kmap-header">${rb}</th>`;
      gray2.forEach(col => {
        const minterm = (row << 2) | col;
        const isDC = dontcares.includes(minterm);
        const isMin = minterms.includes(minterm);

        // Find group color
        let bgColor = '';
        groups.forEach((g, gi) => {
          if (g.cells.includes(minterm)) bgColor = groupColors[gi % groupColors.length];
        });

        html += `<td class="kmap-cell" style="${bgColor ? 'background:'+bgColor+';' : ''}">
          <span class="kmap-val">${isDC ? 'X' : isMin ? '1' : '0'}</span>
          <span class="kmap-idx">${minterm}</span>
        </td>`;
      });
      html += `</tr>`;
    });
    html += `</table></div>`;
    return html;
  },

  _kmap3(vars, minterms, dontcares, groups) {
    const gray2 = [0,1,3,2];
    const groupColors = ['rgba(255,107,107,0.25)','rgba(72,207,173,0.25)','rgba(255,169,77,0.25)','rgba(108,99,255,0.25)'];
    let html = `<div class="kmap-wrap"><table class="kmap-table">`;
    html += `<tr><th class="kmap-header">${vars[0]}\\${vars[1]}${vars[2]}</th>`;
    gray2.forEach(c => {
      html += `<th class="kmap-header">${c.toString(2).padStart(2,'0')}</th>`;
    });
    html += `</tr>`;
    [0,1].forEach(row => {
      html += `<tr><th class="kmap-header">${row}</th>`;
      gray2.forEach(col => {
        const minterm = (row << 2) | col;
        const isDC = dontcares.includes(minterm);
        const isMin = minterms.includes(minterm);
        let bgColor = '';
        groups.forEach((g, gi) => {
          if (g.cells.includes(minterm)) bgColor = groupColors[gi % groupColors.length];
        });
        html += `<td class="kmap-cell" style="${bgColor ? 'background:'+bgColor+';' : ''}">
          <span class="kmap-val">${isDC ? 'X' : isMin ? '1' : '0'}</span>
          <span class="kmap-idx">${minterm}</span>
        </td>`;
      });
      html += `</tr>`;
    });
    html += `</table></div>`;
    return html;
  },

  _kmap2(vars, minterms, dontcares, groups) {
    let html = `<div class="kmap-wrap"><table class="kmap-table">`;
    html += `<tr><th class="kmap-header">${vars[0]}\\${vars[1]}</th><th class="kmap-header">0</th><th class="kmap-header">1</th></tr>`;
    [0,1].forEach(row => {
      html += `<tr><th class="kmap-header">${row}</th>`;
      [0,1].forEach(col => {
        const minterm = (row << 1) | col;
        const isDC = dontcares.includes(minterm), isMin = minterms.includes(minterm);
        html += `<td class="kmap-cell"><span class="kmap-val">${isDC ? 'X' : isMin ? '1' : '0'}</span><span class="kmap-idx">${minterm}</span></td>`;
      });
      html += `</tr>`;
    });
    html += `</table></div>`;
    return html;
  },

  // ─── Table ───────────────────────────────────────────────────
  renderTable({ headers, rows, caption, highlight = [] }) {
    let html = `<div class="diagram-table-wrap"><table class="diagram-table">`;
    if (headers && headers.length) {
      html += `<thead><tr>${headers.map(h => `<th>${DR.renderMath(String(h))}</th>`).join('')}</tr></thead>`;
    }
    html += `<tbody>`;
    rows.forEach((row, ri) => {
      const isHighlighted = highlight.includes(ri);
      html += `<tr ${isHighlighted ? 'class="highlighted-row"' : ''}>`;
      row.forEach(cell => {
        const val = String(cell);
        const isBold = val.startsWith('**') && val.endsWith('**');
        const inner = DR.renderMath(isBold ? val.slice(2,-2) : val);
        html += `<td ${isBold ? 'style="font-weight:700;color:var(--accent-teal)"' : ''}>${inner}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    if (caption) html += `<div class="diagram-caption">${DR.renderMath(caption)}</div>`;
    html += `</div>`;
    return html;
  },

  // ─── Code Block ──────────────────────────────────────────────
  renderCode({ language = 'c', code, highlightLines = [] }) {
    const escaped = code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Simple C/Python syntax highlighting
    let highlighted = escaped
      .replace(/\b(int|float|double|char|void|return|if|else|for|while|do|break|continue|struct|typedef|include|define|printf|scanf|NULL|true|false|bool)\b/g,
        '<span class="kw">$1</span>')
      .replace(/\b(def|class|import|from|in|not|and|or|is|pass|lambda|yield|with|as|try|except|finally|raise|global|nonlocal|print|len|range|None|True|False)\b/g,
        '<span class="kw">$1</span>')
      .replace(/(\/\/[^\n]*|#[^\n]*)/g, '<span class="cmt">$1</span>')
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="str">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$1</span>');

    const lines = highlighted.split('\n');
    const lineNumbers = lines.map((line, i) => {
      const ln = i + 1;
      const isHL = highlightLines.includes(ln);
      return `<div class="code-line ${isHL ? 'code-line-hl' : ''}">` +
        `<span class="ln">${ln}</span>${line}</div>`;
    }).join('');

    return `<div class="code-block">
      <div class="code-lang">${language.toUpperCase()}</div>
      <pre class="code-pre"><code>${lineNumbers}</code></pre>
    </div>`;
  },

  // ─── Gantt Chart (process scheduling) ────────────────────────
  renderGantt({ processes, totalTime, width = 520 }) {
    const colors = ['#6c63ff','#48cfad','#ffa94d','#ff6b9d','#4ecdc4','#b044ff','#ff6b6b'];
    const barH = 30, paddingY = 40, tickH = 16;
    const svgH = paddingY + barH + tickH + 24;
    const svgW = width;
    const scale = (svgW - 60) / totalTime;

    let bars = '', ticks = '', labels = '';

    processes.forEach((p, i) => {
      const x = 40 + p.start * scale;
      const w = (p.end - p.start) * scale;
      const color = p.color || colors[i % colors.length];
      bars += `
        <rect x="${x}" y="${paddingY}" width="${w}" height="${barH}"
          fill="${color}" opacity="0.85" rx="4"/>
        <text x="${x + w/2}" y="${paddingY + barH/2 + 1}" text-anchor="middle"
          dominant-baseline="middle" font-size="12" font-weight="700" fill="white"
          font-family="Inter,sans-serif">${p.name}</text>`;
    });

    // Time ticks
    for (let t = 0; t <= totalTime; t++) {
      const x = 40 + t * scale;
      ticks += `<line x1="${x}" y1="${paddingY+barH}" x2="${x}" y2="${paddingY+barH+tickH/2}"
        stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
        <text x="${x}" y="${paddingY+barH+tickH+4}" text-anchor="middle"
          font-size="10" fill="rgba(255,255,255,0.5)" font-family="Inter,sans-serif">${t}</text>`;
    }

    return `<svg class="diagram-svg gantt-svg" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
      <text x="4" y="${paddingY+barH/2+1}" dominant-baseline="middle" font-size="11"
        fill="rgba(255,255,255,0.5)" font-family="Inter,sans-serif">CPU</text>
      ${bars}${ticks}
    </svg>`;
  },

  // ─── Memory / Packet Layout ───────────────────────────────────
  renderMemory({ segments, width = 480 }) {
    const totalSize = segments.reduce((sum, s) => sum + (s.size || 1), 0);
    const svgH = 70;
    const startX = 10, endX = width - 10;
    const barW = endX - startX, barH = 34, barY = 18;
    const colors = ['rgba(108,99,255,0.5)','rgba(72,207,173,0.4)','rgba(255,169,77,0.4)',
                    'rgba(255,107,107,0.4)','rgba(176,68,255,0.4)','rgba(78,205,196,0.4)'];

    let rects = '', texts = '', borders = '';
    let curX = startX;
    segments.forEach((seg, i) => {
      const w = (seg.size / totalSize) * barW;
      const color = seg.color || colors[i % colors.length];
      rects += `<rect x="${curX}" y="${barY}" width="${w}" height="${barH}"
        fill="${color}" rx="0" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>`;
      texts += `<text x="${curX + w/2}" y="${barY + barH/2 + 1}" text-anchor="middle"
        dominant-baseline="middle" font-size="11" font-family="Inter,sans-serif"
        fill="var(--text-primary)" font-weight="600">${seg.label}</text>`;

      // Bit/byte markers
      if (seg.bits !== undefined) {
        texts += `<text x="${curX + w/2}" y="${barY + barH + 12}" text-anchor="middle"
          font-size="9" fill="rgba(255,255,255,0.4)" font-family="Inter,sans-serif">${seg.bits} bits</text>`;
      }
      curX += w;
    });

    return `<svg class="diagram-svg" viewBox="0 0 ${width} ${svgH}" xmlns="http://www.w3.org/2000/svg">
      ${rects}${texts}
    </svg>`;
  },

  // ─── Simple Logic Circuit (gate symbols) ─────────────────────
  renderCircuit({ gates, wires, inputs, outputs, width = 500, height = 200 }) {
    // Basic gate SVG symbols
    const gateShapes = {
      AND:  (x,y) => `<path d="M${x},${y-20} L${x},${y+20} Q${x+40},${y+20} ${x+40},${y} Q${x+40},${y-20} ${x},${y-20} Z" fill="rgba(108,99,255,0.15)" stroke="#6c63ff" stroke-width="2"/>`,
      OR:   (x,y) => `<path d="M${x},${y-20} Q${x+15},${y} ${x},${y+20} Q${x+30},${y+20} ${x+40},${y} Q${x+30},${y-20} ${x},${y-20} Z" fill="rgba(72,207,173,0.15)" stroke="#48cfad" stroke-width="2"/>`,
      NOT:  (x,y) => `<path d="M${x},${y-16} L${x+32},${y} L${x},${y+16} Z" fill="rgba(255,169,77,0.15)" stroke="#ffa94d" stroke-width="2"/><circle cx="${x+36}" cy="${y}" r="4" fill="none" stroke="#ffa94d" stroke-width="2"/>`,
      NAND: (x,y) => `<path d="M${x},${y-20} L${x},${y+20} Q${x+36},${y+20} ${x+36},${y} Q${x+36},${y-20} ${x},${y-20} Z" fill="rgba(255,107,107,0.15)" stroke="#ff6b6b" stroke-width="2"/><circle cx="${x+40}" cy="${y}" r="4" fill="none" stroke="#ff6b6b" stroke-width="2"/>`,
      NOR:  (x,y) => `<path d="M${x},${y-20} Q${x+15},${y} ${x},${y+20} Q${x+30},${y+20} ${x+36},${y} Q${x+30},${y-20} ${x},${y-20} Z" fill="rgba(176,68,255,0.15)" stroke="#b044ff" stroke-width="2"/><circle cx="${x+40}" cy="${y}" r="4" fill="none" stroke="#b044ff" stroke-width="2"/>`,
      XOR:  (x,y) => `<path d="M${x+5},${y-20} Q${x+20},${y} ${x+5},${y+20} Q${x+35},${y+20} ${x+45},${y} Q${x+35},${y-20} ${x+5},${y-20} Z" fill="rgba(78,205,196,0.15)" stroke="#4ecdc4" stroke-width="2"/><path d="M${x},${y-20} Q${x+15},${y} ${x},${y+20}" fill="none" stroke="#4ecdc4" stroke-width="2"/>`,
    };

    let svg = `<svg class="diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .gate-label { font-size:10px; font-family:'Inter',sans-serif; fill:rgba(255,255,255,0.6); text-anchor:middle; }
        .io-label { font-size:12px; font-family:'JetBrains Mono',monospace; fill:var(--text-primary); font-weight:600; }
      </style>`;

    // Draw wires
    if (wires) {
      wires.forEach(w => {
        svg += `<polyline points="${w.points.map(p => p.join(',')).join(' ')}"
          fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>`;
      });
    }

    // Draw gates
    if (gates) {
      gates.forEach(g => {
        const shape = gateShapes[g.type];
        if (shape) {
          svg += shape(g.x, g.y);
          svg += `<text x="${g.x+20}" y="${g.y+30}" class="gate-label">${g.type}</text>`;
          if (g.label) svg += `<text x="${g.x+20}" y="${g.y+42}" class="gate-label" style="fill:var(--accent-purple)">${g.label}</text>`;
        }
      });
    }

    // Labels
    if (inputs) inputs.forEach(inp => {
      svg += `<text x="${inp.x}" y="${inp.y}" class="io-label">${inp.label}</text>`;
    });
    if (outputs) outputs.forEach(out => {
      svg += `<text x="${out.x}" y="${out.y}" class="io-label">${out.label}</text>`;
    });

    svg += `</svg>`;
    return svg;
  }
};

// Export for use in app.js
window.DR = DR;
