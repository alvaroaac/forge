/* global React, mermaid */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── Mermaid bootstrap ─────────────────────────────────────────────────────
let mermaidReady = false;
function ensureMermaid() {
  if (mermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    fontFamily: 'inherit',
    themeVariables: {
      // These are overridden by CSS post-render, but provide a sensible base.
      background: '#1a1a2e',
      primaryColor: '#16213e',
      primaryTextColor: '#e0e0e0',
      primaryBorderColor: '#3a3a5a',
      lineColor: '#3a3a5a',
      secondaryColor: '#0f3460',
      tertiaryColor: '#16213e',
      fontFamily: 'inherit',
      fontSize: '14px',
    },
    flowchart: { curve: 'basis', htmlLabels: true, padding: 16 },
    sequence: { mirrorActors: false },
  });
  mermaidReady = true;
}

// ── Role detection — tag nodes by shape + label pattern ───────────────────
// Mermaid's classDef is the canonical way, but we infer from source so the
// plan author doesn't have to add classDefs themselves.

const ROLE_RULES = [
  // Decision: {label} or {{label}}
  { role: 'decision', re: /\b([A-Za-z0-9_]+)\s*\{\{?[^}]+\}\}?/g },
  // Start/end: stadium ([label]) or circle ((label))
  { role: 'start',    re: /\b([A-Za-z0-9_]+)\s*\(\(\s*(start|begin|init)[^)]*\)\)/gi },
  { role: 'end',      re: /\b([A-Za-z0-9_]+)\s*\(\(\s*(end|done|finish|complete)[^)]*\)\)/gi },
  { role: 'start',    re: /\b([A-Za-z0-9_]+)\s*\(\[\s*(start|begin)[^\]]*\]\)/gi },
  { role: 'end',      re: /\b([A-Za-z0-9_]+)\s*\(\[\s*(end|done|finish)[^\]]*\]\)/gi },
  // Error: label contains error/fail/abort
  { role: 'error',    re: /\b([A-Za-z0-9_]+)\s*\[[^\]]*\b(error|fail|abort|reject|invalid)[^\]]*\]/gi },
  // I/O: parallelogram [/label/] or [\label\]
  { role: 'io',       re: /\b([A-Za-z0-9_]+)\s*\[[\/\\][^\]]+[\/\\]\]/g },
];

function detectRoles(source) {
  const roles = {};
  for (const { role, re } of ROLE_RULES) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(source)) !== null) {
      if (!roles[m[1]]) roles[m[1]] = role;
    }
  }
  // Anything left is "process"
  return roles;
}

function detectKind(source) {
  const first = source.trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (first.startsWith('sequence')) return 'sequence';
  if (first.startsWith('classdiagram') || first === 'classdiagram') return 'class';
  if (first.startsWith('statediagram') || first === 'statediagram') return 'state';
  if (first.startsWith('erdiagram')) return 'er';
  if (first.startsWith('gantt')) return 'gantt';
  if (first.startsWith('pie')) return 'pie';
  if (first.startsWith('journey')) return 'journey';
  return 'flowchart';
}

// ── Syntax highlighter for the source view ───────────────────────────────
function highlightMermaid(src) {
  const lines = src.split('\n');
  const kwRe = /\b(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|participant|actor|note|loop|alt|else|end|subgraph|classDef|class|direction|TB|TD|BT|LR|RL)\b/g;
  const arrowRe = /(-->|---|-\.->|-\.\.->|==>|===|<-->|<--|o--o|x--x|--x|--o|-->\|[^|]+\|)/g;
  const nodeRe = /(\b[A-Za-z_][A-Za-z0-9_]*)(?=\s*[\[\(\{])/g;
  const labelRe = /(\[[^\]]+\]|\{\{?[^}]+\}\}?|\(\([^)]+\)\)|\([^)]+\))/g;
  const commentRe = /(%%.*$)/;

  return lines.map(line => {
    // Escape HTML
    let safe = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    safe = safe.replace(commentRe, '<span class="tk-comment">$1</span>');
    safe = safe.replace(labelRe, m => `<span class="tk-label">${m}</span>`);
    safe = safe.replace(arrowRe, '<span class="tk-arrow">$1</span>');
    safe = safe.replace(kwRe, '<span class="tk-kw">$1</span>');
    safe = safe.replace(nodeRe, '<span class="tk-node">$1</span>');
    return safe;
  }).join('\n');
}

// ── Icon set ──────────────────────────────────────────────────────────────
const Icon = {
  ZoomIn: () => (<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>),
  ZoomOut: () => (<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></svg>),
  Fit: () => (<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>),
  Expand: () => (<svg viewBox="0 0 24 24"><path d="M4 10V4h6M20 10V4h-6M4 14v6h6M20 14v6h-6"/></svg>),
  Collapse: () => (<svg viewBox="0 0 24 24"><path d="M10 4v6H4M14 4v6h6M10 20v-6H4M14 20v-6h6"/></svg>),
  Code: () => (<svg viewBox="0 0 24 24"><path d="m9 17-5-5 5-5M15 7l5 5-5 5M14 4l-4 16"/></svg>),
  Copy: () => (<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>),
  Download: () => (<svg viewBox="0 0 24 24"><path d="M12 4v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg>),
  Comment: () => (<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5A8.5 8.5 0 1 1 21 11.5z"/></svg>),
  Check: () => (<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>),
};

// ── Role application post-render ──────────────────────────────────────────
function applyRoles(svgEl, roles, source) {
  if (!svgEl) return;
  const nodes = svgEl.querySelectorAll('g.node');
  nodes.forEach(g => {
    const id = g.id || '';
    // mermaid ids look like: flowchart-A-0 or graph-div-A-1
    let key = null;
    for (const k of Object.keys(roles)) {
      const re = new RegExp(`(^|-)${k}(-|$)`);
      if (re.test(id)) { key = k; break; }
    }
    if (key) g.setAttribute('data-role', roles[key]);
    else {
      // Infer from shape
      if (g.querySelector('polygon')) g.setAttribute('data-role', 'decision');
      else g.setAttribute('data-role', 'process');
    }
  });

  // Tag edges that originate from decision nodes so the branch arrows
  // inherit the decision color.
  const decisionIds = Array.from(nodes)
    .filter(n => n.getAttribute('data-role') === 'decision')
    .map(n => n.id);
  svgEl.querySelectorAll('.edgePath, g.edgePath, path.flowchart-link').forEach(edge => {
    const id = edge.id || '';
    for (const did of decisionIds) {
      // edge ids look like: L-A-B-0 or L_A_B_0
      const re = new RegExp(`L[-_]${did}[-_]`);
      if (re.test(id)) {
        edge.classList.add('edge-from-decision');
        break;
      }
    }
  });
}

// ── Parse YES/NO edge labels from source ──────────────────────────────────
// Returns { "A-B-0": "yes" | "no" | null } keyed by edge id fragment.
function parseBranchLabels(source) {
  // Matches:  A -->|Yes| B   or   A -->|no, fallback| B
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*(?:-->|---|==>|-\.->)\s*\|([^|]+)\|\s*([A-Za-z_][A-Za-z0-9_]*)/g;
  const out = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    const label = m[2].trim().toLowerCase();
    let branch = null;
    if (/^(yes|true|ok|success|pass|1)$/i.test(label)) branch = 'yes';
    else if (/^(no|false|fail|error|reject|0)$/i.test(label)) branch = 'no';
    out.push({ from: m[1], to: m[3], branch, label: m[2].trim() });
  }
  return out;
}

function applyBranchEdges(svgEl, branches) {
  if (!svgEl) return;
  branches.forEach(b => {
    if (!b.branch) return;
    // Edge-path ids: L_A_B_0 or L-A-B-0
    const edges = svgEl.querySelectorAll(`[id*="_${b.from}_${b.to}_"], [id*="-${b.from}-${b.to}-"]`);
    edges.forEach(e => e.classList.add(`edge-${b.branch}`));
    // Edge labels: .edgeLabels contain text matching the label
    svgEl.querySelectorAll('.edgeLabel, g.edgeLabel').forEach(lbl => {
      const txt = (lbl.textContent || '').trim().toLowerCase();
      if (txt === b.label.toLowerCase()) lbl.classList.add(`edge-${b.branch}-label`);
    });
  });
}

// Tag sequence-diagram actors with an index so CSS can paint each a different color
function applyActorIndices(svgEl) {
  if (!svgEl) return;
  // Mermaid sequence actors render as <rect class="actor"> and <g class="actor">
  const actorBoxes = Array.from(svgEl.querySelectorAll('rect.actor, g.actor rect.actor, rect.actor-box'));
  const seen = new Map();
  let idx = 0;
  actorBoxes.forEach(r => {
    // Deduplicate by x-position — mermaid renders two boxes per actor (top & bottom)
    const x = Math.round(parseFloat(r.getAttribute('x') || '0'));
    if (!seen.has(x)) seen.set(x, idx++);
    const i = seen.get(x) % 6;
    r.setAttribute('data-actor-idx', i);
    if (r.parentElement && r.parentElement.classList.contains('actor')) {
      r.parentElement.setAttribute('data-actor-idx', i);
    }
  });
  // Lifelines
  const lines = svgEl.querySelectorAll('line.actor-line');
  lines.forEach((l, i) => l.setAttribute('data-actor-idx', i % 6));
}

// Add a hover chrome (dashed outline + comment pill) inside each node so it
// reads as clickable/commentable.
function addNodeChrome(svgEl, commentedIds = new Set()) {
  if (!svgEl) return;
  const nodes = svgEl.querySelectorAll('g.node');
  let hadZeroBBox = false;
  nodes.forEach(g => {
    // Remove any existing chrome (safe re-entry)
    g.querySelectorAll(':scope > .node-chrome').forEach(c => c.remove());
    let bbox;
    try { bbox = g.getBBox(); } catch { return; }
    if (!bbox || bbox.width === 0 || bbox.height === 0) { hadZeroBBox = true; return; }
    const pad = 6;
    const x = bbox.x - pad, y = bbox.y - pad;
    const w = bbox.width + pad * 2, h = bbox.height + pad * 2;
    const svgns = 'http://www.w3.org/2000/svg';
    const chrome = document.createElementNS(svgns, 'g');
    chrome.setAttribute('class', 'node-chrome');
    const outline = document.createElementNS(svgns, 'rect');
    outline.setAttribute('class', 'node-outline');
    outline.setAttribute('x', x); outline.setAttribute('y', y);
    outline.setAttribute('width', w); outline.setAttribute('height', h);
    outline.setAttribute('rx', 8);
    chrome.appendChild(outline);
    const pill = document.createElementNS(svgns, 'circle');
    pill.setAttribute('class', 'comment-pill');
    pill.setAttribute('cx', x + w - 2);
    pill.setAttribute('cy', y + 2);
    pill.setAttribute('r', 9);
    chrome.appendChild(pill);
    const glyph = document.createElementNS(svgns, 'text');
    glyph.setAttribute('class', 'comment-pill-glyph');
    glyph.setAttribute('x', x + w - 2);
    glyph.setAttribute('y', y + 3);
    glyph.textContent = '+';
    chrome.appendChild(glyph);
    g.appendChild(chrome);
    // Mark commented nodes — match by label text OR by id fragment
    const labelText = (g.querySelector('foreignObject span, text')?.textContent || '').trim();
    const idFrags = (g.id || '').split(/[-_]/);
    const isCommented = Array.from(commentedIds).some(cid =>
      idFrags.includes(cid) || labelText.toLowerCase().includes(cid.toLowerCase()) ||
      (cid === 'ErrorNode' && /auth failure/i.test(labelText)) ||
      (cid === 'CheckToken' && /valid token/i.test(labelText))
    );
    if (isCommented) g.classList.add('node-commented');
    else g.classList.remove('node-commented');
  });
  return { hadZeroBBox };
}

// ── The component ─────────────────────────────────────────────────────────
function MermaidBlock({ source, title, chrome = 'labeled', showLegend = true, onComment, commentedNodes = [] }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nodePopover, setNodePopover] = useState(null); // { x, y, nodeId, quote }
  const [draftComment, setDraftComment] = useState('');
  const [localCommented, setLocalCommented] = useState(new Set(commentedNodes));
  const surfaceRef = useRef(null);
  const overlayRef = useRef(null);
  const idRef = useRef(`mm-${Math.random().toString(36).slice(2, 9)}`);

  const roles = useMemo(() => detectRoles(source), [source]);
  const kind = useMemo(() => detectKind(source), [source]);
  const branches = useMemo(() => parseBranchLabels(source), [source]);

  // Count nodes for the meta badge
  const nodeCount = useMemo(() => {
    const ids = new Set();
    const re = /(^|\s)([A-Za-z_][A-Za-z0-9_]*)\s*[\[\(\{]/g;
    let m;
    while ((m = re.exec(source))) ids.add(m[2]);
    return ids.size;
  }, [source]);

  // Render diagram
  useEffect(() => {
    let cancelled = false;
    ensureMermaid();
    mermaid.render(idRef.current, source).then(({ svg }) => {
      if (!cancelled) { setSvg(svg); setError(null); }
    }).catch(err => {
      if (!cancelled) setError(String(err.message || err));
    });
    return () => { cancelled = true; };
  }, [source]);

  // Apply role coloring after SVG is injected
  useEffect(() => {
    if (!svg || !surfaceRef.current) return;
    const svgEl = surfaceRef.current.querySelector('svg');
    if (!svgEl) return;
    applyRoles(svgEl, roles, source);
    applyBranchEdges(svgEl, branches);
    applyActorIndices(svgEl);
    const run = () => {
      const result = addNodeChrome(svgEl, localCommented);
      if (result && result.hadZeroBBox) {
        // SVG not yet laid out — retry
        setTimeout(run, 30);
      }
    };
    run();
    // Wire click handler
    svgEl.querySelectorAll('g.node').forEach(g => {
      g.onclick = (e) => {
        e.stopPropagation();
        const text = (g.querySelector('foreignObject span, text')?.textContent || '').trim();
        const nid = (g.id || '').split(/[-_]/).slice(-2, -1)[0] || g.id;
        const rect = g.getBoundingClientRect();
        const viewportRect = surfaceRef.current.getBoundingClientRect();
        setNodePopover({
          x: rect.left - viewportRect.left + rect.width / 2 - 130,
          y: rect.bottom - viewportRect.top + 10,
          nodeId: nid,
          quote: text,
        });
        svgEl.querySelectorAll('g.node.node-selected').forEach(n => n.classList.remove('node-selected'));
        g.classList.add('node-selected');
      };
    });
  }, [svg, roles, source, branches, localCommented]);

  // Apply to overlay clone too
  useEffect(() => {
    if (!fullscreen || !overlayRef.current) return;
    const svgEl = overlayRef.current.querySelector('svg');
    if (!svgEl) return;
    applyRoles(svgEl, roles, source);
    applyBranchEdges(svgEl, branches);
    applyActorIndices(svgEl);
    const run = () => {
      const result = addNodeChrome(svgEl, localCommented);
      if (result && result.hadZeroBBox) setTimeout(run, 30);
    };
    run();
  }, [fullscreen, svg, roles, source, branches, localCommented]);

  // Rebuild commented set if props change
  useEffect(() => {
    setLocalCommented(new Set(commentedNodes));
  }, [commentedNodes.join(',')]);

  const submitNodeComment = () => {
    if (!nodePopover || !draftComment.trim()) return;
    setLocalCommented(prev => new Set(prev).add(nodePopover.nodeId));
    onComment?.({ nodeId: nodePopover.nodeId, quote: nodePopover.quote, text: draftComment.trim() });
    setDraftComment('');
    setNodePopover(null);
  };

  const copySource = useCallback(() => {
    navigator.clipboard?.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [source]);

  const downloadSvg = useCallback(() => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'diagram'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svg, title]);

  // Active roles in this diagram (for the legend)
  const activeRoles = useMemo(() => {
    const set = new Set(Object.values(roles));
    if (Object.values(roles).length === 0) return [];
    // If there's any detected role, "process" is implicitly there too.
    set.add('process');
    return Array.from(set);
  }, [roles]);

  const kindLabel = {
    flowchart: 'Flowchart',
    sequence: 'Sequence',
    class: 'Class',
    state: 'State',
    er: 'ER',
    gantt: 'Gantt',
    pie: 'Pie',
    journey: 'Journey',
  }[kind] || 'Diagram';

  const toolbar = (
    <div className="mermaid-toolbar" role="toolbar" aria-label="Diagram controls">
      <button className="tb-btn" onClick={() => setZoom(z => Math.max(0.4, z - 0.2))} title="Zoom out" aria-label="Zoom out"><Icon.ZoomOut /></button>
      <span className="tb-btn zoom-readout">{Math.round(zoom * 100)}%</span>
      <button className="tb-btn" onClick={() => setZoom(z => Math.min(3, z + 0.2))} title="Zoom in" aria-label="Zoom in"><Icon.ZoomIn /></button>
      <button className="tb-btn" onClick={() => setZoom(1)} title="Fit to view" aria-label="Fit"><Icon.Fit /></button>
      <span className="tb-sep" />
      <button className={`tb-btn ${sourceOpen ? 'active' : ''}`} onClick={() => setSourceOpen(s => !s)} title="Toggle source" aria-label="Toggle source" aria-pressed={sourceOpen}><Icon.Code /></button>
      <button className="tb-btn" onClick={copySource} title={copied ? 'Copied!' : 'Copy source'} aria-label="Copy source">
        {copied ? <Icon.Check /> : <Icon.Copy />}
      </button>
      <button className="tb-btn" onClick={downloadSvg} title="Download SVG" aria-label="Download SVG"><Icon.Download /></button>
      <span className="tb-sep" />
      {onComment && (
        <button className="tb-btn" onClick={onComment} title="Comment on this diagram" aria-label="Comment"><Icon.Comment /></button>
      )}
      <button className="tb-btn" onClick={() => setFullscreen(true)} title="Expand" aria-label="Expand"><Icon.Expand /></button>
    </div>
  );

  return (
    <>
      <div
        className={`mermaid-block ${sourceOpen ? 'source-open' : ''}`}
        data-chrome={chrome}
      >
        <div className="mermaid-header">
          {chrome !== 'minimal' && <span className="mermaid-kind-badge">{kindLabel}</span>}
          {chrome === 'labeled' && title && <span className="mermaid-title">{title}</span>}
          {chrome === 'terminal' && <span className="mermaid-title">{title || `${kind}.mmd`}</span>}
          {chrome !== 'minimal' && nodeCount > 0 && kind !== 'sequence' && (
            <span className="mermaid-node-count">{nodeCount} nodes</span>
          )}
          {toolbar}
        </div>

        <div className="mermaid-viewport fit" style={{ position: 'relative' }} onClick={() => setNodePopover(null)}>
          {error ? (
            <div style={{ color: 'var(--danger)', fontFamily: 'monospace', fontSize: 12, padding: 20 }}>
              ⚠ Mermaid parse error: {error}
            </div>
          ) : (
            <div
              ref={surfaceRef}
              className="mermaid-surface"
              style={{ transform: `scale(${zoom})` }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
          <div className="node-hint">Click any node to comment</div>
          {nodePopover && (
            <div
              className="node-popover"
              style={{ left: Math.max(10, nodePopover.x), top: nodePopover.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="np-label">Comment on node</div>
              <div className="np-quote">{nodePopover.quote}</div>
              <textarea
                autoFocus
                placeholder="What's worth flagging about this node?"
                value={draftComment}
                onChange={e => setDraftComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitNodeComment(); }}
              />
              <div className="np-actions">
                <button className="np-cancel" onClick={() => { setDraftComment(''); setNodePopover(null); }}>Cancel</button>
                <button className="np-add" onClick={submitNodeComment}>Add comment</button>
              </div>
              <div className="np-hint">⌘⏎ to submit</div>
            </div>
          )}
        </div>

        {showLegend && activeRoles.length > 0 && chrome !== 'minimal' && (
          <div className="mermaid-legend">
            {activeRoles.includes('start') && <Legend color="var(--role-start)" label="Start" />}
            {activeRoles.includes('process') && <Legend color="var(--role-process)" label="Process" />}
            {activeRoles.includes('decision') && <Legend color="var(--role-decision)" label="Decision" />}
            {activeRoles.includes('io') && <Legend color="var(--role-io)" label="Input / Output" />}
            {activeRoles.includes('error') && <Legend color="var(--role-error)" label="Error" />}
            {activeRoles.includes('end') && <Legend color="var(--role-end)" label="End" />}
          </div>
        )}

        <div className="mermaid-source" aria-hidden={!sourceOpen}>
          <div>
            <div className="src-header">
              <span>Source · mermaid</span>
              <button onClick={copySource}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <pre dangerouslySetInnerHTML={{ __html: highlightMermaid(source) }} />
          </div>
        </div>
      </div>

      {fullscreen && (
        <div className="mermaid-overlay" onClick={(e) => { if (e.target.classList.contains('mermaid-overlay')) setFullscreen(false); }}>
          <div className="mo-header">
            <span className="mermaid-kind-badge">{kindLabel}</span>
            <span className="mermaid-title">{title || 'Diagram'}</span>
            <span className="mermaid-node-count">{nodeCount} nodes · zoom {Math.round(zoom * 100)}%</span>
            <div className="mermaid-toolbar" style={{ marginLeft: 'auto' }}>
              <button className="tb-btn" onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}><Icon.ZoomOut /></button>
              <button className="tb-btn" onClick={() => setZoom(z => Math.min(3, z + 0.2))}><Icon.ZoomIn /></button>
              <button className="tb-btn" onClick={() => setZoom(1)}><Icon.Fit /></button>
              <span className="tb-sep" />
              <button className="tb-btn" onClick={copySource} title="Copy source">{copied ? <Icon.Check /> : <Icon.Copy />}</button>
              <button className="tb-btn" onClick={downloadSvg} title="Download SVG"><Icon.Download /></button>
              <span className="tb-sep" />
              <button className="tb-btn" onClick={() => setFullscreen(false)} title="Close (Esc)"><Icon.Collapse /></button>
            </div>
          </div>
          <div className="mo-body">
            <div className="mo-diagram">
              <div
                ref={overlayRef}
                className="mermaid-surface"
                style={{ transform: `scale(${zoom * 1.3})` }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
            <div className="mo-source">
              <div className="sh">
                <span>Source</span>
                <button onClick={copySource}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <pre dangerouslySetInnerHTML={{ __html: highlightMermaid(source) }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Legend({ color, label }) {
  return (
    <span className="lg-item">
      <span className="lg-swatch" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, borderColor: color, color }} />
      {label}
    </span>
  );
}

// Keydown handler for Escape to close fullscreen — bound at root
window.MermaidBlock = MermaidBlock;
