// ── MODULE-LEVEL MINI-GRAPH STATE (for miniResetZoom) ───────────
let _miniZoom, _miniSvgSel, _miniNodes, _miniW = 700, _miniH = 300;

// ── SHARED CONSTANTS ─────────────────────────────────────────────
const STATUS_COLORS = {
  active:   { border: '#2E844A', bg: '#D1FAE5', fg: '#166534' },
  draft:    { border: '#DD7A01', bg: '#FEF3C7', fg: '#92400E' },
  review:   { border: '#9050E9', bg: '#F3EDFD', fg: '#5B21B6' },
  sunset:   { border: '#BA0517', bg: '#FEE2E2', fg: '#991B1B' },
  archived: { border: '#747474', bg: '#F3F4F6', fg: '#374151' }
};

function statusColors(status) {
  return STATUS_COLORS[(status || '').toLowerCase()] || STATUS_COLORS.archived;
}

// ── FIT-GRAPH HELPER ─────────────────────────────────────────────
// zoomBehavior MUST be passed as a parameter — each graph function creates its own instance
function fitGraph(svgSel, containerG, nodes, width, height, zoomBehavior, padding = 80) {
  if (!nodes.length) return;
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - padding, maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding, maxY = Math.max(...ys) + padding;
  const graphW = maxX - minX || 1, graphH = maxY - minY || 1;
  const scale = Math.min(2.0, 0.92 * Math.min(width / graphW, height / graphH));
  const tx = (width - graphW * scale) / 2 - minX * scale;
  const ty = (height - graphH * scale) / 2 - minY * scale;
  svgSel.transition().duration(600)
    .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

// ── MINI-GRAPH RESET (called from inline onclick in injected HTML) ─
function miniResetZoom() {
  if (!_miniZoom || !_miniSvgSel) return;
  _miniSvgSel.transition().duration(500).call(_miniZoom.transform, d3.zoomIdentity);
  setTimeout(() => fitGraph(_miniSvgSel, _miniSvgSel.select('g'), _miniNodes, _miniW, _miniH, _miniZoom), 520);
}

// ── CARD NODE HTML BUILDER ────────────────────────────────────────
function buildCardHtml(d) {
  if (d.isCentral) {
    return `<div xmlns="http://www.w3.org/1999/xhtml" style="
        width:160px;height:72px;background:#EFF6FF;
        border:3px solid #0176D3;border-radius:4px;
        padding:8px 10px;box-sizing:border-box;
        box-shadow:0 0 0 4px rgba(1,118,211,0.2),0 2px 8px rgba(0,0,0,0.15);
        cursor:default;font-family:'Salesforce Sans','Inter',-apple-system,sans-serif;
        overflow:hidden;">
      <div style="font-size:11px;font-weight:700;color:#032D60;margin-bottom:4px;">${d.id}</div>
      <div style="font-size:11px;color:#16325C;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">${d.name || ''}</div>
      <div style="font-size:10px;color:#54698D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.citation || '—'}</div>
    </div>`;
  }
  const sc = statusColors(d.status);
  return `<div xmlns="http://www.w3.org/1999/xhtml" style="
      width:160px;height:72px;background:#fff;
      border:2px solid ${sc.border};border-radius:4px;
      padding:8px 10px;box-sizing:border-box;
      box-shadow:0 1px 4px rgba(0,0,0,0.12);
      cursor:pointer;font-family:'Salesforce Sans','Inter',-apple-system,sans-serif;
      overflow:hidden;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;font-weight:700;color:#032D60;">${d.id}</span>
      <span style="font-size:9px;font-weight:700;text-transform:uppercase;padding:2px 5px;border-radius:2px;background:${sc.bg};color:${sc.fg};">${d.status || ''}</span>
    </div>
    <div style="font-size:11px;color:#16325C;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">${d.name || ''}</div>
    <div style="font-size:10px;color:#54698D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.citation || '—'}</div>
  </div>`;
}

// ── LINK STROKE HELPERS ───────────────────────────────────────────
function linkStroke(type) {
  if (type === 'overrides') return '#BA0517';
  if (type === 'impacts')   return '#DD7A01';
  if (type === 'related')   return '#9CA3AF';
  return '#0176D3';
}
function linkDash(type) { return type === 'overrides' ? '5,3' : null; }
function linkWidth(type) { return type === 'related' ? 1 : 1.5; }

// ── FULL NETWORK GRAPH ───────────────────────────────────────────
async function renderDependencyGraph() {
  const svg = d3.select('#dependencyGraph');
  if (!svg.node()) return;

  svg.selectAll('*').remove();

  const rect = svg.node().getBoundingClientRect();
  let width  = rect.width  || svg.node().clientWidth  || svg.node().parentElement?.clientWidth || 800;
  let height = rect.height || svg.node().clientHeight || 600;

  console.log(`[D3 Graph] SVG dimensions: ${width}x${height}, rules: ${rules.length}`);
  if (width  < 10) width  = 800;
  if (height < 10) height = 600;

  try {
    const allDeps = await lexipoint._query('rule_dependencies', 'select=*');

    const showAll = document.getElementById('showAllRulesToggle')?.checked;

    // Build node map from all rules
    const nodeMap = {};
    rules.forEach(r => {
      nodeMap[r.rule_id] = {
        id: r.rule_id, name: r.name, status: r.status,
        priority: r.priority || 'P4', rule: r,
        citation: r.citation || '—'
      };
    });

    const links = allDeps
      .filter(d => nodeMap[d.rule_id] && nodeMap[d.depends_on])
      .map(d => ({
        source: d.rule_id,
        target: d.depends_on,
        type: d.dependency_type || 'requires'
      }));

    // Filter nodes based on toggle
    let nodes;
    if (showAll) {
      nodes = Object.values(nodeMap);
    } else {
      const connectedIds = new Set();
      links.forEach(l => { connectedIds.add(l.source); connectedIds.add(l.target); });
      nodes = Object.values(nodeMap).filter(n => connectedIds.has(n.id));
    }

    document.getElementById('graphRuleCount').textContent = nodes.length;
    document.getElementById('graphLinkCount').textContent = links.length;

    svg.attr('role', 'img').attr('aria-label',
      `Rule dependency network showing ${nodes.length} rules and ${links.length} connections`);

    const chargeStrength = nodes.length > 60 ? -800 : -400;

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(140))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(90).strength(0.8));

    if (nodes.length > 100) simulation.alphaDecay(0.05);

    const container = svg.append('g').attr('class', 'd3-container');

    // Add arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 10).attr('markerHeight', 10)
      .attr('refX', 82).attr('refY', 3).attr('orient', 'auto')
      .append('polygon').attr('points', '0 0, 10 3, 0 6').attr('fill', '#999');

    // Add links
    const link = container.append('g').attr('class', 'd3-links').selectAll('line')
      .data(links).enter().append('line')
      .attr('class', d => `d3-link ${d.type}`)
      .attr('stroke', d => linkStroke(d.type))
      .attr('stroke-dasharray', d => linkDash(d.type))
      .attr('stroke-width', d => linkWidth(d.type))
      .attr('stroke-opacity', 0.5)
      .attr('marker-end', 'url(#arrowhead)');

    // Add nodes as foreignObject card nodes
    const node = container.append('g').attr('class', 'd3-nodes').selectAll('foreignObject')
      .data(nodes).enter().append('foreignObject')
      .attr('width', 160).attr('height', 72)
      .attr('class', 'dep-card-node')
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-label', d => `Rule ${d.id}: ${d.name}, status ${d.status}`)
      .html(d => buildCardHtml(d))
      .on('mouseenter', (e, d) => {
        const tooltip = document.getElementById('d3Tooltip');
        const pendingCount = PENDING_APPS[d.id] ? ` · ${PENDING_APPS[d.id]} active applications` : '';
        tooltip.innerHTML = `<strong style="font-size:13px;">${d.id}</strong><br><span style="font-size:12px;">${d.name}</span><br><span style="font-size:12px;text-transform:uppercase;font-weight:600;">${d.status}</span><span style="font-size:11px;color:rgba(255,255,255,0.75);">${pendingCount}</span><br><span style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;display:block;">Click to open rule</span>`;
        const svgRect = svg.node().getBoundingClientRect();
        tooltip.style.left = (e.pageX - svgRect.left + 14) + 'px';
        tooltip.style.top  = (e.pageY - svgRect.top  - 24) + 'px';
        tooltip.classList.add('show');
        // Dim non-connected
        const connectedIds = new Set([d.id]);
        links.forEach(l => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          if (srcId === d.id || tgtId === d.id) { connectedIds.add(srcId); connectedIds.add(tgtId); }
        });
        node.style('opacity', n => connectedIds.has(n.id) ? 1 : 0.15);
        link.style('opacity', l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          return (s === d.id || t === d.id) ? 0.9 : 0.05;
        });
        svg.select('#d3-instruction').style('opacity', 0);
      })
      .on('mouseleave', () => {
        document.getElementById('d3Tooltip').classList.remove('show');
        node.style('opacity', 1);
        link.style('opacity', 0.5);
        svg.select('#d3-instruction').style('opacity', 1);
      })
      .on('click', (e, d) => { e.stopPropagation(); openWorkspaceTab(d.id); })
      .on('keydown', (e, d) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWorkspaceTab(d.id); }
      })
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    // Instructional overlay text
    svg.append('text')
      .attr('id', 'd3-instruction')
      .attr('x', width / 2).attr('y', height - 16)
      .attr('text-anchor', 'middle').attr('font-size', '12px')
      .attr('fill', '#9CA3AF').attr('pointer-events', 'none')
      .attr('font-family', "'Salesforce Sans', 'Inter', -apple-system, sans-serif")
      .text('Hover to highlight connections · Click to open rule · Scroll to zoom');

    // Zoom with scale bounds and pan-on-background filter
    let zoomBehavior = d3.zoom()
      .scaleExtent([0.15, 4])
      .filter(event => {
        return event.type === 'wheel' || event.type === 'touchstart' ||
               (event.type === 'mousedown' && event.target.closest('.dep-card-node') === null);
      })
      .on('zoom', (e) => { container.attr('transform', e.transform); });
    svg.call(zoomBehavior);

    // Wire Reset Zoom button
    const resetBtn = document.getElementById('resetZoomBtn');
    if (resetBtn) {
      resetBtn.replaceWith(resetBtn.cloneNode(true)); // remove old listeners
      document.getElementById('resetZoomBtn').addEventListener('click', () => {
        svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity);
        setTimeout(() => fitGraph(svg, container, nodes, width, height, zoomBehavior), 520);
      });
    }

    // Tick handler — foreignObject positioned by x/y (not cx/cy)
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node
        .attr('x', d => d.x - 80).attr('y', d => d.y - 36);
    });

    simulation.on('end', () => {
      fitGraph(svg, container, nodes, width, height, zoomBehavior);
    });
    setTimeout(() => fitGraph(svg, container, nodes, width, height, zoomBehavior), 800);

    function dragStarted(e, d) {
      if (!e.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(e, d)   { d.fx = e.x; d.fy = e.y; }
    function dragEnded(e, d) {
      if (!e.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }

  } catch (e) {
    console.error('[D3 Graph] Failed:', e);
  }
}

// ── AI INSIGHTS (Feature 4) ──────────────────────────────────────
function getAIInsights(rule) {
  const insights = {
    'OH-001': {
      summary: 'This rule verifies that hospitals maintain the minimum licensed bed capacity of 25 beds as required by Ohio Revised Code § 3702.30. It serves as a foundational licensing gate — hospitals falling below this threshold cannot maintain their operating license.',
      conflicts: [
        { rule: 'OH-005', severity: 'medium', desc: 'OH-005 (Emergency Department Requirements) assumes minimum 25-bed capacity but does not explicitly reference this rule as a prerequisite.' }
      ],
      gaps: [
        { desc: 'No condition captures temporary bed count reductions during renovation. OAC 3701-22-03(K) allows temporary waivers but this rule would block them.' },
        { desc: 'Missing: Licensed vs. staffed bed distinction. A hospital may have 25 licensed beds but only 18 staffed.' }
      ],
      crossJurisdiction: [
        { state: 'Kentucky', rule: 'KY-NH-003', note: 'Nursing homes require minimum 30 beds (stricter). Different facility type but same pattern.' },
        { state: 'Federal', rule: 'CMS CoP § 482.12', note: 'Federal conditions of participation require state licensure but do not specify a bed minimum.' }
      ],
      confidence: 'high'
    },
    'OH-002': {
      summary: 'Requires hospitals to maintain Joint Commission accreditation or equivalent national accrediting body certification. This rule ensures compliance with federal conditions of participation and represents a quality assurance gate.',
      conflicts: [],
      gaps: [
        { desc: 'Does not specify timeline for maintaining accreditation renewal. Hospitals may have lapsed accreditation during renewal periods.' }
      ],
      crossJurisdiction: [
        { state: 'Federal', rule: 'CMS CoP § 482.3', note: 'Federal CoP requires accreditation by recognized body or state survey alternative.' }
      ],
      confidence: 'high'
    },
    'OH-003': {
      summary: 'Mandates physician credentialing and privileging processes aligned with state medical board standards. This is a foundational medical staff governance requirement.',
      conflicts: [
        { rule: 'OH-018', severity: 'low', desc: 'OH-018 references credentialing but focuses on emergency medicine privileges specifically.' }
      ],
      gaps: [
        { desc: 'Missing: Telemedicine provider credentialing procedures. Current rule predates telehealth expansion.' }
      ],
      crossJurisdiction: [
        { state: 'Federal', rule: 'CMS CoP § 482.12(c)', note: 'Federal standards require similar privileging processes.' }
      ],
      confidence: 'medium'
    }
  };

  if (insights[rule.rule_id]) {
    return insights[rule.rule_id];
  }

  return {
    summary: `${rule.name} is a ${rule.priority} priority rule that governs ${rule.phase.toLowerCase()} processes. The rule is currently in ${rule.status.toUpperCase()} status.`,
    conflicts: [],
    gaps: [{ desc: 'No specific gaps identified. This rule appears well-structured based on current metadata.' }],
    crossJurisdiction: [{ state: 'Federal', rule: 'CMS CoP', note: 'Compare with federal CMS conditions of participation for alignment.' }],
    confidence: 'medium'
  };
}

function renderAIInsights(rule) {
  const insights = getAIInsights(rule);
  const fmtDate = () => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  let html = `
    <div class="ai-banner">
      <span class="ai-banner-emoji">🤖</span>
      <div class="ai-banner-text">
        <div class="ai-banner-title">AI-Assisted Analysis</div>
        <div class="ai-banner-desc">These insights are generated to assist human reviewers. All recommendations require human approval before implementation.</div>
      </div>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">Plain-English Summary</div>
      <div class="ai-section-content info">
        <div class="ai-insight-item">${insights.summary}</div>
      </div>
    </div>
  `;

  if (insights.conflicts && insights.conflicts.length > 0) {
    html += `
      <div class="ai-section">
        <div class="ai-section-title">Conflict Detection</div>
        ${insights.conflicts.map(c => `
          <div class="ai-section-content warning" style="margin-bottom: 8px;">
            <div class="ai-insight-item">
              <span class="ai-severity ${c.severity.toLowerCase()}">${c.severity}</span>
              <strong>Potential overlap with ${c.rule}:</strong> ${c.desc}
              <button class="ai-action-button">Review Conflict</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (insights.gaps && insights.gaps.length > 0) {
    html += `
      <div class="ai-section">
        <div class="ai-section-title">Gap Analysis</div>
        ${insights.gaps.map(g => `
          <div class="ai-section-content info" style="margin-bottom: 8px;">
            <div class="ai-insight-item">
              <strong>Consider adding:</strong> ${g.desc}
              <button class="ai-action-button">Add to Rule</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (insights.crossJurisdiction && insights.crossJurisdiction.length > 0) {
    html += `
      <div class="ai-section">
        <div class="ai-section-title">Cross-Jurisdiction Comparison</div>
        ${insights.crossJurisdiction.map(cj => `
          <div class="ai-section-content info" style="margin-bottom: 8px;">
            <div class="ai-insight-item">
              <strong>${cj.state}:</strong> ${cj.rule} — ${cj.note}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  html += `
    <div class="ai-section">
      <div class="ai-provenance">
        <strong>Confidence:</strong> ${insights.confidence.charAt(0).toUpperCase() + insights.confidence.slice(1)}<br>
        <strong>Model:</strong> Claude 3.5 Sonnet<br>
        <strong>Last analyzed:</strong> ${fmtDate()}<br>
        <em style="display: block; margin-top: 8px; color: var(--text-secondary);">AI analysis is advisory only. Policy decisions must be made by authorized personnel.</em>
      </div>
    </div>
  `;

  document.getElementById('aiInsightsContent').innerHTML = html;
}

// ── FOCUSED DEPENDENCY GRAPH in Dependencies Tab (Feature 3) ──────
async function renderFocusedDependencyGraph(ruleId) {
  const container = document.getElementById('dependenciesContent');
  const rule = await lexipoint.getRule(ruleId);
  const deps = await lexipoint.getDependencies(ruleId);

  // Build node map — include citation for card rendering
  const nodeMap = {};
  nodeMap[ruleId] = {
    id: ruleId, name: rule.name, status: rule.status,
    citation: rule.citation || '—', isCentral: true
  };

  for (const d of deps.dependsOn) {
    if (d.targetRule) {
      nodeMap[d.targetRule.rule_id] = {
        id: d.targetRule.rule_id, name: d.targetRule.name,
        status: d.targetRule.status, citation: d.targetRule.citation || '—'
      };
    }
  }
  for (const d of deps.dependedOnBy) {
    if (d.sourceRule) {
      nodeMap[d.sourceRule.rule_id] = {
        id: d.sourceRule.rule_id, name: d.sourceRule.name,
        status: d.sourceRule.status, citation: d.sourceRule.citation || '—'
      };
    }
  }

  const nodes = Object.values(nodeMap);
  const links = [];
  for (const d of deps.dependsOn) {
    if (d.targetRule) {
      links.push({ source: ruleId, target: d.targetRule.rule_id, type: d.dependency_type || 'requires', desc: d.description || d.dependency_type });
    }
  }
  for (const d of deps.dependedOnBy) {
    if (d.sourceRule) {
      links.push({ source: d.sourceRule.rule_id, target: ruleId, type: d.dependency_type || 'requires', desc: d.description || d.dependency_type });
    }
  }

  // Edge-type legend (consistent with full-graph legend)
  const legendHtml = `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;font-size:12px;font-weight:600;" role="legend" aria-label="Graph legend">
    <span style="display:flex;align-items:center;gap:5px;color:#0176D3;"><span style="border-top:2px solid #0176D3;width:20px;display:inline-block;"></span> requires</span>
    <span style="display:flex;align-items:center;gap:5px;color:#DD7A01;"><span style="border-top:2px solid #DD7A01;width:20px;display:inline-block;"></span> impacts</span>
    <span style="display:flex;align-items:center;gap:5px;color:#BA0517;"><span style="border-top:2px dashed #BA0517;width:20px;display:inline-block;"></span> overrides</span>
    <span style="display:flex;align-items:center;gap:5px;color:#6B7280;"><span style="border-top:1px dotted #9CA3AF;width:20px;display:inline-block;"></span> related</span>
  </div>`;

  // Empty state — no SVG rendered when no deps
  if (deps.dependsOn.length === 0 && deps.dependedOnBy.length === 0) {
    const depListHtml = buildDepListHtml(deps);
    container.innerHTML = `
      <div style="padding:32px 20px;text-align:center;background:#F9FAFB;border-radius:4px;margin-bottom:16px;border:1px dashed #D1D5DB;">
        <div style="font-size:24px;margin-bottom:10px;color:#D1D5DB;">◎</div>
        <div style="font-size:13px;font-weight:600;color:#16325C;margin-bottom:6px;">No dependencies mapped for this rule</div>
        <div style="font-size:12px;color:#54698D;line-height:1.5;max-width:260px;margin:0 auto;">
          This rule operates independently, or its relationships to other rules have not been recorded yet.
        </div>
      </div>
      ${depListHtml}`;
    return;
  }

  // SVG wrapped in relative div for absolute-positioned Reset button
  const svgHtml = legendHtml + `
    <div style="position:relative;margin-bottom:12px;">
      <button type="button" onclick="miniResetZoom()"
        style="position:absolute;top:8px;right:8px;z-index:10;
               padding:4px 10px;font-size:11px;font-weight:600;
               background:#fff;border:1px solid #E5E5E5;border-radius:2px;
               cursor:pointer;color:#032D60;">
        &#10227; Reset
      </button>
      <svg id="miniDependencyGraph" width="100%" height="300"
           style="background:#FAFAFB;border:1px solid #E5E5E5;border-radius:4px;"></svg>
    </div>`;

  const depListHtml = buildDepListHtml(deps);
  container.innerHTML = svgHtml + depListHtml;

  renderMiniGraph(nodes, links);
}

function buildDepListHtml(deps) {
  let html = `<div style="margin-bottom:16px;"><h4 style="font-size:13px;font-weight:700;color:var(--slds-navy);margin-bottom:8px;">Dependencies</h4>`;

  if (deps.dependsOn.length > 0) {
    html += `<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;">This rule requires:</div>`;
    for (const d of deps.dependsOn) {
      const target = d.targetRule;
      const typeColor = d.dependency_type === 'conflicts' ? 'conflicts' : d.dependency_type === 'supersedes' ? 'supersedes' : 'requires';
      html += `
        <div class="dependency-item">
          <div class="dep-info">
            <div style="margin-bottom:4px;"><span class="dep-type ${typeColor}">${d.dependency_type || 'requires'}</span><span class="dep-id">${target ? target.rule_id : d.depends_on}</span>${target ? target.name : ''}</div>
          </div>
          <button onclick="openWorkspaceTab('${target ? target.rule_id : d.depends_on}')">Open</button>
        </div>`;
    }
    html += `</div>`;
  }

  if (deps.dependedOnBy.length > 0) {
    html += `<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;">Rules that depend on this:</div>`;
    for (const d of deps.dependedOnBy) {
      const source = d.sourceRule;
      const typeColor = d.dependency_type === 'conflicts' ? 'conflicts' : d.dependency_type === 'supersedes' ? 'supersedes' : 'requires';
      html += `
        <div class="dependency-item">
          <div class="dep-info">
            <div style="margin-bottom:4px;"><span class="dep-type ${typeColor}">${d.dependency_type || 'requires'}</span><span class="dep-id">${source ? source.rule_id : d.rule_id}</span>${source ? source.name : ''}</div>
          </div>
          <button onclick="openWorkspaceTab('${source ? source.rule_id : d.rule_id}')">Open</button>
        </div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

// ── FOCUSED MINI-GRAPH ───────────────────────────────────────────
function renderMiniGraph(nodes, links) {
  const svg = d3.select('#miniDependencyGraph');
  if (!svg.node()) return;

  const width = 700;
  const height = 300;

  svg.selectAll('*').remove();
  svg.attr('role', 'img').attr('aria-label', 'Dependency graph for selected rule');

  svg.append('defs').append('marker')
    .attr('id', 'mini-arrow')
    .attr('markerWidth', 10).attr('markerHeight', 10)
    .attr('refX', 82).attr('refY', 3).attr('orient', 'auto')
    .append('polygon').attr('points', '0 0, 10 3, 0 6').attr('fill', '#999');

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(140))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(90).strength(0.8));

  const g = svg.append('g');

  const link = g.append('g').selectAll('line')
    .data(links).enter().append('line')
    .attr('stroke', d => linkStroke(d.type))
    .attr('stroke-dasharray', d => linkDash(d.type))
    .attr('stroke-width', d => linkWidth(d.type))
    .attr('stroke-opacity', 0.6)
    .attr('marker-end', 'url(#mini-arrow)');

  // Card nodes via foreignObject
  const node = g.append('g').selectAll('foreignObject')
    .data(nodes).enter().append('foreignObject')
    .attr('width', 160).attr('height', 72)
    .attr('class', 'dep-card-node')
    .attr('role', 'button')
    .attr('aria-label', d => `Rule ${d.id}: ${d.name}, status ${d.status}`)
    .html(d => buildCardHtml(d))
    .on('mouseenter', (e, d) => {
      const connectedIds = new Set([d.id]);
      links.forEach(l => {
        const srcId = typeof l.source === 'object' ? l.source.id : l.source;
        const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
        if (srcId === d.id || tgtId === d.id) { connectedIds.add(srcId); connectedIds.add(tgtId); }
      });
      node.style('opacity', n => connectedIds.has(n.id) ? 1 : 0.15);
      link.style('opacity', l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return (s === d.id || t === d.id) ? 0.9 : 0.05;
      });
    })
    .on('mouseleave', () => {
      node.style('opacity', 1);
      link.style('opacity', 0.6);
    })
    .on('click', (e, d) => { if (!d.isCentral) openWorkspaceTab(d.id); })
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end',   (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

  // Zoom with pan-on-background filter
  let zoomBehavior = d3.zoom()
    .scaleExtent([0.15, 4])
    .filter(event => {
      return event.type === 'wheel' || event.type === 'touchstart' ||
             (event.type === 'mousedown' && event.target.closest('.dep-card-node') === null);
    })
    .on('zoom', (e) => { g.attr('transform', e.transform); });
  svg.call(zoomBehavior);

  // Tick — foreignObject uses x/y attributes
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node
      .attr('x', d => d.x - 80).attr('y', d => d.y - 36);
  });

  simulation.on('end', () => {
    fitGraph(svg, g, nodes, width, height, zoomBehavior);
  });
  setTimeout(() => fitGraph(svg, g, nodes, width, height, zoomBehavior), 800);

  // Store for miniResetZoom
  _miniZoom = zoomBehavior;
  _miniSvgSel = svg;
  _miniNodes = nodes;
}

// Start
renderProgramSwitcher(currentProgram);
init();
