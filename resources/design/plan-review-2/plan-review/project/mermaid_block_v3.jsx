/* global React, mermaid */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

let mmReady = false;
function ensureMermaid() {
  if (mmReady) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    fontFamily: 'inherit',
    themeVariables: {
      background: '#ffffff',
      primaryColor: '#fbfaf6',
      primaryTextColor: '#1a1714',
      primaryBorderColor: '#d8d2c7',
      lineColor: '#9a948c',
      secondaryColor: '#efece5',
      tertiaryColor: '#f7f5f0',
      fontFamily: 'inherit',
      fontSize: '13px',
    },
    flowchart: { curve: 'basis', htmlLabels: true, padding: 14 },
    sequence: { mirrorActors: false, actorMargin: 60, boxMargin: 8 },
  });
  mmReady = true;
}

// ── Role + kind detection ─────────────────────────────────────────────
const ROLE_RULES = [
  { role: 'decision', re: /\b([A-Za-z0-9_]+)\s*\{\{?[^}]+\}\}?/g },
  { role: 'start',    re: /\b([A-Za-z0-9_]+)\s*\(\(\s*(start|begin|init)[^)]*\)\)/gi },
  { role: 'end',      re: /\b([A-Za-z0-9_]+)\s*\(\(\s*(end|done|finish|complete)[^)]*\)\)/gi },
  { role: 'start',    re: /\b([A-Za-z0-9_]+)\s*\(\[\s*(start|begin|incoming|request)[^\]]*\]\)/gi },
  { role: 'end',      re: /\b([A-Za-z0-9_]+)\s*\(\[\s*(end|done|finish|complete)[^\]]*\]\)/gi },
  { role: 'error',    re: /\b([A-Za-z0-9_]+)\s*\[[^\]]*\b(error|fail|abort|reject|invalid|missing|orphan)[^\]]*\]/gi },
  { role: 'io',       re: /\b([A-Za-z0-9_]+)\s*\[[\/\\][^\]]+[\/\\]\]/g },
];

function detectRoles(source) {
  const roles = {};
  for (const { role, re } of ROLE_RULES) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(source)) !== null) if (!roles[m[1]]) roles[m[1]] = role;
  }
  return roles;
}

function detectKind(source) {
  const first = source.trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (first.startsWith('sequence')) return 'sequence';
  if (first.startsWith('classdiagram')) return 'class';
  if (first.startsWith('statediagram')) return 'state';
  if (first.startsWith('erdiagram')) return 'er';
  if (first.startsWith('gantt')) return 'gantt';
  return 'flowchart';
}

function highlightMermaid(src) {
  const kwRe = /\b(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|participant|actor|note|loop|alt|else|end|subgraph|TB|TD|BT|LR|RL)\b/g;
  const arrowRe = /(-->|---|-\.->|==>|<-->|<--|--x|--o)/g;
  const nodeRe = /(\b[A-Za-z_][A-Za-z0-9_]*)(?=\s*[\[\(\{])/g;
  const labelRe = /(\[[^\]]+\]|\{\{?[^}]+\}\}?|\(\([^)]+\)\)|\([^)]+\))/g;
  return src.split('\n').map(line => {
    let s = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/(%%.*$)/, '<span class="tk-comment">$1</span>');
    s = s.replace(labelRe, m => `<span class="tk-label">${m}</span>`);
    s = s.replace(arrowRe, '<span class="tk-arrow">$1</span>');
    s = s.replace(kwRe, '<span class="tk-kw">$1</span>');
    s = s.replace(nodeRe, '<span class="tk-node">$1</span>');
    return s;
  }).join('\n');
}

// ── Icons ─────────────────────────────────────────────────────────────
const I = {
  ZoomIn:  () => (<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>),
  ZoomOut: () => (<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></svg>),
  Fit:     () => (<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>),
  Expand:  () => (<svg viewBox="0 0 24 24"><path d="M4 10V4h6M20 10V4h-6M4 14v6h6M20 14v6h-6"/></svg>),
  Code:    () => (<svg viewBox="0 0 24 24"><path d="m9 17-5-5 5-5M15 7l5 5-5 5"/></svg>),
  Copy:    () => (<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>),
  Download:() => (<svg viewBox="0 0 24 24"><path d="M12 4v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg>),
  Check:   () => (<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>),
};

// Apply role classes to rendered svg
function applyRoles(svgEl, roles) {
  if (!svgEl) return;
  svgEl.querySelectorAll('g.node').forEach(g => {
    const id = g.id || '';
    let key = null;
    for (const k of Object.keys(roles)) {
      const re = new RegExp(`(^|[-_])${k}([-_]|$)`);
      if (re.test(id)) { key = k; break; }
    }
    if (key) g.setAttribute('data-role', roles[key]);
    else if (g.querySelector('polygon')) g.setAttribute('data-role', 'decision');
    else g.setAttribute('data-role', 'process');
  });
}

function applyActorIndices(svgEl) {
  if (!svgEl) return;
  const actorBoxes = Array.from(svgEl.querySelectorAll('rect.actor, g.actor rect.actor, rect.actor-box'));
  const seen = new Map();
  let idx = 0;
  actorBoxes.forEach(r => {
    const x = Math.round(parseFloat(r.getAttribute('x') || '0'));
    if (!seen.has(x)) seen.set(x, idx++);
    const i = seen.get(x) % 4;
    r.setAttribute('data-actor-idx', i);
    if (r.parentElement?.classList.contains('actor')) r.parentElement.setAttribute('data-actor-idx', i);
  });
  svgEl.querySelectorAll('line.actor-line').forEach((l, i) => l.setAttribute('data-actor-idx', i % 4));
}

// Add a dashed halo behind each node for hover affordance
function addHalos(svgEl, commentedSet) {
  if (!svgEl) return { retry: false };
  let retry = false;
  svgEl.querySelectorAll('g.node').forEach(g => {
    g.querySelectorAll(':scope > rect.mm-halo').forEach(c => c.remove());
    let bbox;
    try { bbox = g.getBBox(); } catch { return; }
    if (!bbox || bbox.width === 0) { retry = true; return; }
    const pad = 5;
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('class', 'mm-halo');
    r.setAttribute('x', bbox.x - pad);
    r.setAttribute('y', bbox.y - pad);
    r.setAttribute('width', bbox.width + pad * 2);
    r.setAttribute('height', bbox.height + pad * 2);
    r.setAttribute('rx', 8);
    g.insertBefore(r, g.firstChild);

    // Match commented nodes
    const labelText = (g.querySelector('foreignObject span, text')?.textContent || '').trim();
    const idFrags = (g.id || '').split(/[-_]/);
    const matched = Array.from(commentedSet).some(cid =>
      idFrags.includes(cid) ||
      labelText.toLowerCase().includes(cid.toLowerCase().replace(/_/g, ' '))
    );
    g.classList.toggle('has-comment', matched);
  });
  return { retry };
}

// Find node center coords in viewport-relative px for placing pins
function findNodePositions(svgEl, ids) {
  if (!svgEl) return {};
  const svgRect = svgEl.getBoundingClientRect();
  const positions = {};
  svgEl.querySelectorAll('g.node').forEach(g => {
    let bbox;
    try { bbox = g.getBoundingClientRect(); } catch { return; }
    const labelText = (g.querySelector('foreignObject span, text')?.textContent || '').trim();
    const idFrags = (g.id || '').split(/[-_]/);
    for (const id of ids) {
      if (positions[id]) continue;
      if (idFrags.includes(id) || labelText.toLowerCase().includes(id.toLowerCase().replace(/_/g, ' '))) {
        positions[id] = {
          x: bbox.left - svgRect.left + bbox.width / 2,
          y: bbox.top - svgRect.top + bbox.height / 2,
          quote: labelText,
        };
      }
    }
  });
  return positions;
}

// ── Component ────────────────────────────────────────────────────────
function MermaidBlock({
  source,
  title,
  kindLabel,
  threads = [],          // [{id, anchorId, ...}]
  onNodeClick,           // (nodeId, quote, x, y) =>
  onPinClick,            // (threadId) =>
  focusedThreadId,
  showLegend = true,
}) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [srcOpen, setSrcOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pinPositions, setPinPositions] = useState({});
  const surfaceRef = useRef(null);
  const viewportRef = useRef(null);
  const idRef = useRef(`mm-${Math.random().toString(36).slice(2, 9)}`);

  const roles = useMemo(() => detectRoles(source), [source]);
  const kind = useMemo(() => detectKind(source), [source]);

  const nodeCount = useMemo(() => {
    const ids = new Set();
    const re = /(^|\s)([A-Za-z_][A-Za-z0-9_]*)\s*[\[\(\{]/g;
    let m; while ((m = re.exec(source))) ids.add(m[2]);
    return ids.size;
  }, [source]);

  const kindLabels = { flowchart: 'Flowchart', sequence: 'Sequence', class: 'Class', state: 'State', er: 'ER', gantt: 'Gantt' };
  const kLabel = kindLabel || kindLabels[kind] || 'Diagram';

  const commentedSet = useMemo(() => new Set(threads.filter(t => !t.resolved && t.anchorId).map(t => t.anchorId)), [threads]);

  useEffect(() => {
    let cancelled = false;
    ensureMermaid();
    mermaid.render(idRef.current, source).then(({ svg }) => {
      if (!cancelled) { setSvg(svg); setError(null); }
    }).catch(err => { if (!cancelled) setError(String(err.message || err)); });
    return () => { cancelled = true; };
  }, [source]);

  useEffect(() => {
    if (!svg || !surfaceRef.current) return;
    const svgEl = surfaceRef.current.querySelector('svg');
    if (!svgEl) return;
    applyRoles(svgEl, roles);
    applyActorIndices(svgEl);
    const run = () => {
      const { retry } = addHalos(svgEl, commentedSet);
      if (retry) { setTimeout(run, 30); return; }
      // Compute pin positions for threads that have anchorId
      const ids = threads.filter(t => t.anchorId).map(t => t.anchorId);
      if (ids.length) {
        const pos = findNodePositions(svgEl, ids);
        setPinPositions(pos);
      } else {
        setPinPositions({});
      }
    };
    run();

    // Click handler
    svgEl.querySelectorAll('g.node').forEach(g => {
      g.onclick = (e) => {
        e.stopPropagation();
        const labelText = (g.querySelector('foreignObject span, text')?.textContent || '').trim();
        const idFrags = (g.id || '').split(/[-_]/);
        // Choose a stable anchor id: prefer label
        const slug = labelText.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || idFrags.slice(-2, -1)[0];
        const bbox = g.getBoundingClientRect();
        const svgRect = svgEl.getBoundingClientRect();
        onNodeClick?.(slug, labelText, bbox.left - svgRect.left + bbox.width / 2, bbox.top - svgRect.top + bbox.height / 2);
      };
    });
  }, [svg, roles, threads, commentedSet, zoom]);

  // Reposition pins on resize / zoom
  useEffect(() => {
    if (!surfaceRef.current) return;
    const svgEl = surfaceRef.current.querySelector('svg');
    if (!svgEl) return;
    const ids = threads.filter(t => t.anchorId).map(t => t.anchorId);
    if (ids.length) setPinPositions(findNodePositions(svgEl, ids));
  }, [zoom]);

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1100);
  }, [source]);

  const download = useCallback(() => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title || 'diagram'}.svg`; a.click();
    URL.revokeObjectURL(url);
  }, [svg, title]);

  const activeRoles = useMemo(() => {
    const set = new Set(Object.values(roles));
    if (set.size === 0) return [];
    set.add('process');
    return Array.from(set);
  }, [roles]);

  const pinsToRender = threads.filter(t => t.anchorId && pinPositions[t.anchorId]);

  return (
    <div className={`mm-block ${srcOpen ? 'src-open' : ''}`}>
      <div className="mm-head">
        <span className="mm-kind">{kLabel}</span>
        <span className="mm-title">{title}</span>
        {nodeCount > 0 && kind !== 'sequence' && <span className="mm-meta">{nodeCount} nodes</span>}
        <div className="mm-toolbar">
          <button className="mm-tb" onClick={() => setZoom(z => Math.max(0.5, z - 0.15))} title="Zoom out"><I.ZoomOut/></button>
          <span className="mm-tb readout">{Math.round(zoom * 100)}%</span>
          <button className="mm-tb" onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} title="Zoom in"><I.ZoomIn/></button>
          <button className="mm-tb" onClick={() => setZoom(1)} title="Fit"><I.Fit/></button>
          <span className="mm-sep"/>
          <button className={`mm-tb ${srcOpen ? 'active' : ''}`} onClick={() => setSrcOpen(s => !s)} title="Source"><I.Code/></button>
          <button className="mm-tb" onClick={copy} title={copied ? 'Copied' : 'Copy source'}>{copied ? <I.Check/> : <I.Copy/>}</button>
          <button className="mm-tb" onClick={download} title="Download SVG"><I.Download/></button>
        </div>
      </div>

      <div className="mm-viewport" ref={viewportRef}>
        {error ? (
          <div style={{ color: 'var(--rose)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>⚠ {error}</div>
        ) : (
          <div ref={surfaceRef} className="mm-surface" style={{ transform: `scale(${zoom})` }} dangerouslySetInnerHTML={{ __html: svg }} />
        )}
        {pinsToRender.map(t => {
          const pos = pinPositions[t.anchorId];
          // Adjust pos for surface scale (we stored unscaled px, surface scaled around center)
          return (
            <button
              key={t.id}
              className={`mm-pin ${t.resolved ? 'resolved' : ''}`}
              style={{ left: pos.x * zoom, top: pos.y * zoom, transform: 'translate(-50%, -50%)' }}
              onClick={(e) => { e.stopPropagation(); onPinClick?.(t.id); }}
              title={`Comment by ${t.comments[0]?.author}`}
            >
              {t.comments.length}
            </button>
          );
        })}
      </div>

      {showLegend && activeRoles.length > 0 && (
        <div className="mm-legend">
          {activeRoles.includes('start') && <Lg color="var(--role-start)" label="Start"/>}
          {activeRoles.includes('process') && <Lg color="var(--role-process)" label="Process"/>}
          {activeRoles.includes('decision') && <Lg color="var(--role-decision)" label="Decision"/>}
          {activeRoles.includes('io') && <Lg color="var(--role-io)" label="I/O"/>}
          {activeRoles.includes('error') && <Lg color="var(--role-error)" label="Error"/>}
          {activeRoles.includes('end') && <Lg color="var(--role-end)" label="End"/>}
        </div>
      )}

      <div className="mm-source">
        <div className="src-head">
          <span>Mermaid source</span>
          <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <pre dangerouslySetInnerHTML={{ __html: highlightMermaid(source) }} />
      </div>
    </div>
  );
}

function Lg({ color, label }) {
  return (
    <span className="lg">
      <span className="sw" style={{ background: `color-mix(in srgb, ${color} 14%, white)`, borderColor: color, color }} />
      {label}
    </span>
  );
}

window.MermaidBlock = MermaidBlock;
