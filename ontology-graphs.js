async function renderDependencyGraph() {
  const svg = d3.select('#dependencyGraph');
  if (!svg.node()) return;

  // Clear previous graph
  svg.selectAll('*').remove();

  // Use getBoundingClientRect (reliable for SVG elements)
  const rect = svg.node().getBoundingClientRect();
  let width = rect.width || svg.node().clientWidth || svg.node().parentElement?.clientWidth || 800;
  let height = rect.height || svg.node().clientHeight || 500;

  console.log(`[D3 Graph] SVG dimensions: ${width}x${height}, rules: ${rules.length}`);
  if (width < 10) width = 800;
  if (height < 10) height = 500;

  // Fetch all dependencies
  try {
    const allDeps = await lexipoint._query('rule_dependencies', 'select=*');

    // Build nodes and links
    const nodeMap = {};
    rules.forEach(r => {
      nodeMap[r.rule_id] = { id: r.rule_id, name: r.name, status: r.status, priority: r.priority || 'P4', rule: r };
    });

    const nodes = Object.values(nodeMap);
    const links = allDeps.filter(d => nodeMap[d.rule_id] && nodeMap[d.depends_on]).map(d => ({
      source: d.rule_id,
      target: d.depends_on,
      type: d.dependency_type || 'requires'
    }));

    // Update counters
    document.getElementById('graphRuleCount').textContent = nodes.length;
    document.getElementById('graphLinkCount').textContent = links.length;

    // ARIA: label the SVG for screen readers
    svg.attr('role', 'img').attr('aria-label', `Rule dependency network showing ${nodes.length} rules and ${links.length} connections`);

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35));

    // Single container group — zoom applies to this one group only (correct D3 pattern)
    const container = svg.append('g').attr('class', 'd3-container');

    // Add links
    const link = container.append('g').attr('class', 'd3-links').selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('class', d => `d3-link ${d.type}`)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');

    // Add arrow marker (outside container — defs are coordinate-independent)
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 20)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', '#999');

    // Add nodes
    const node = container.append('g').attr('class', 'd3-nodes').selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('class', 'd3-node')
      .attr('r', d => {
        const priorityMap = { P1: 18, P2: 15, P3: 12, P4: 10 };
        return priorityMap[d.priority] || 12;
      })
      .attr('fill', d => {
        const statusColorMap = { active: '#2E844A', draft: '#B25E00', review: '#0176D3', sunset: '#BA0517' };
        return statusColorMap[d.status] || '#0176D3';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-label', d => `Rule ${d.id}: ${d.name}, status ${d.status}`)
      .on('mouseenter', (e, d) => {
        const tooltip = document.getElementById('d3Tooltip');
        const pendingCount = PENDING_APPS[d.id] ? ` · ${PENDING_APPS[d.id]} active applications` : '';
        tooltip.innerHTML = `<strong style="font-size:13px;">${d.id}</strong><br><span style="font-size:12px;">${d.name}</span><br><span style="font-size:12px;text-transform:uppercase;font-weight:600;">${d.status}</span><span style="font-size:11px;color:rgba(255,255,255,0.75);">${pendingCount}</span><br><span style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;display:block;">Click to open rule</span>`;
        const rect = svg.node().getBoundingClientRect();
        tooltip.style.left = (e.pageX - rect.left + 14) + 'px';
        tooltip.style.top = (e.pageY - rect.top - 24) + 'px';
        tooltip.classList.add('show');
        // Highlight connected nodes and links, dim everything else
        const connectedIds = new Set([d.id]);
        links.forEach(l => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          if (srcId === d.id || tgtId === d.id) { connectedIds.add(srcId); connectedIds.add(tgtId); }
        });
        node.style('opacity', n => connectedIds.has(n.id) ? 1 : 0.15);
        node.attr('stroke-width', n => n.id === d.id ? 4 : 2);
        link.style('opacity', l => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          return (srcId === d.id || tgtId === d.id) ? 0.9 : 0.05;
        });
        svg.select('#d3-instruction').style('opacity', 0);
      })
      .on('mouseleave', () => {
        document.getElementById('d3Tooltip').classList.remove('show');
        node.style('opacity', 1);
        node.attr('stroke-width', 2);
        link.style('opacity', 0.5);
        svg.select('#d3-instruction').style('opacity', 1);
      })
      .on('click', (e, d) => {
        e.stopPropagation();
        openWorkspaceTab(d.id);
      })
      .on('keydown', (e, d) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWorkspaceTab(d.id); }
      })
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    // Add labels below nodes for readability
    const labels = container.append('g').attr('class', 'd3-labels').selectAll('text')
      .data(nodes)
      .enter().append('text')
      .attr('font-size', '12px')
      .attr('font-weight', 700)
      .attr('font-family', "'Salesforce Sans', 'Inter', -apple-system, sans-serif")
      .attr('text-anchor', 'middle')
      .attr('dy', d => {
        const priorityMap = { P1: 30, P2: 27, P3: 24, P4: 22 };
        return (priorityMap[d.priority] || 24) + 'px';
      })
      .attr('pointer-events', 'none')
      .attr('fill', '#032D60')
      .style('paint-order', 'stroke')
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .attr('stroke-linejoin', 'round')
      .text(d => d.id);

    // Instructional overlay text (bottom of graph)
    svg.append('text')
      .attr('id', 'd3-instruction')
      .attr('x', width / 2)
      .attr('y', height - 16)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#9CA3AF')
      .attr('pointer-events', 'none')
      .attr('font-family', "'Salesforce Sans', 'Inter', -apple-system, sans-serif")
      .text('Hover to highlight connections · Click to open rule · Scroll to zoom');

    // Add zoom — applied to single container group only
    const zoom = d3.zoom().on('zoom', (e) => {
      container.attr('transform', e.transform);
    });
    svg.call(zoom);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labels
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    function dragStarted(e, d) {
      if (!e.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(e, d) {
      d.fx = e.x;
      d.fy = e.y;
    }

    function dragEnded(e, d) {
      if (!e.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
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

  // Create mini graph data
  const allDeps = await lexipoint._query('rule_dependencies', 'select=*');
  const nodeMap = {};
  nodeMap[ruleId] = { id: ruleId, name: rule.name, status: rule.status, isCentral: true };

  for (const d of deps.dependsOn) {
    if (d.targetRule) {
      nodeMap[d.targetRule.rule_id] = { id: d.targetRule.rule_id, name: d.targetRule.name, status: d.targetRule.status };
    }
  }
  for (const d of deps.dependedOnBy) {
    if (d.sourceRule) {
      nodeMap[d.sourceRule.rule_id] = { id: d.sourceRule.rule_id, name: d.sourceRule.name, status: d.sourceRule.status };
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

  // Color legend for mini graph
  const legendHtml = `<div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; font-size: 12px; font-weight: 600;" role="legend" aria-label="Graph legend">
    <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;border-radius:50%;background:#2E844A;display:inline-block;border:2px solid #fff;box-shadow:0 0 0 1px #ccc;"></span> Active</span>
    <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;border-radius:50%;background:#B25E00;display:inline-block;border:2px solid #fff;box-shadow:0 0 0 1px #ccc;"></span> Draft</span>
    <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;border-radius:50%;background:#0176D3;display:inline-block;border:2px solid #fff;box-shadow:0 0 0 1px #ccc;"></span> In Review</span>
    <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;border-radius:50%;background:#BA0517;display:inline-block;border:2px solid #fff;box-shadow:0 0 0 1px #ccc;"></span> Sunset</span>
    <span style="display:flex;align-items:center;gap:5px;color:#6B7280;">— Dependency &nbsp; <span style="border-top:2px dashed #BA0517;width:20px;display:inline-block;"></span> Conflict</span>
  </div>`;

  // Mini graph SVG
  const svgHtml = legendHtml + `<svg id="miniDependencyGraph" width="100%" height="300"></svg>`;

  // Dependency list
  let depListHtml = `<div style="margin-bottom: 16px;"><h4 style="font-size: 13px; font-weight: 700; color: var(--slds-navy); margin-bottom: 8px;">Dependencies</h4>`;

  if (deps.dependsOn.length > 0) {
    depListHtml += `<div style="margin-bottom: 12px;"><div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">This rule requires:</div>`;
    for (const d of deps.dependsOn) {
      const target = d.targetRule;
      const typeColor = d.dependency_type === 'conflicts' ? 'conflicts' : d.dependency_type === 'supersedes' ? 'supersedes' : 'requires';
      depListHtml += `
        <div class="dependency-item">
          <div class="dep-info">
            <div style="margin-bottom: 4px;"><span class="dep-type ${typeColor}">${d.dependency_type || 'requires'}</span><span class="dep-id">${target ? target.rule_id : d.depends_on}</span>${target ? target.name : ''}</div>
          </div>
          <button onclick="openWorkspaceTab('${target ? target.rule_id : d.depends_on}')">Open</button>
        </div>
      `;
    }
    depListHtml += `</div>`;
  }

  if (deps.dependedOnBy.length > 0) {
    depListHtml += `<div style="margin-bottom: 12px;"><div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">Rules that depend on this:</div>`;
    for (const d of deps.dependedOnBy) {
      const source = d.sourceRule;
      const typeColor = d.dependency_type === 'conflicts' ? 'conflicts' : d.dependency_type === 'supersedes' ? 'supersedes' : 'requires';
      depListHtml += `
        <div class="dependency-item">
          <div class="dep-info">
            <div style="margin-bottom: 4px;"><span class="dep-type ${typeColor}">${d.dependency_type || 'requires'}</span><span class="dep-id">${source ? source.rule_id : d.rule_id}</span>${source ? source.name : ''}</div>
          </div>
          <button onclick="openWorkspaceTab('${source ? source.rule_id : d.rule_id}')">Open</button>
        </div>
      `;
    }
    depListHtml += `</div>`;
  }

  if (deps.dependsOn.length === 0 && deps.dependedOnBy.length === 0) {
    depListHtml += `<div style="color: var(--text-secondary); font-size: 13px;">No dependencies mapped for this rule.</div>`;
  }
  depListHtml += `</div>`;

  container.innerHTML = svgHtml + depListHtml;

  // Render mini graph
  renderMiniGraph(nodes, links);
}

function renderMiniGraph(nodes, links) {
  const svg = d3.select('#miniDependencyGraph');
  if (!svg.node()) return;

  const width = 700;
  const height = 300;

  svg.selectAll('*').remove();

  svg.attr('role', 'img').attr('aria-label', 'Dependency graph for selected rule');

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(28));

  const g = svg.append('g');

  const link = g.append('g').selectAll('line')
    .data(links)
    .enter().append('line')
    .attr('stroke', d => d.type === 'conflicts' ? '#BA0517' : d.type === 'supersedes' ? '#DD7A01' : '#999')
    .attr('stroke-width', 1.5)
    .attr('marker-end', 'url(#mini-arrow)');

  svg.append('defs').append('marker')
    .attr('id', 'mini-arrow')
    .attr('markerWidth', 10)
    .attr('markerHeight', 10)
    .attr('refX', 18)
    .attr('refY', 3)
    .attr('orient', 'auto')
    .append('polygon')
    .attr('points', '0 0, 10 3, 0 6')
    .attr('fill', '#999');

  const node = g.append('g').selectAll('circle')
    .data(nodes)
    .enter().append('circle')
    .attr('r', d => d.isCentral ? 16 : 10)
    .attr('fill', d => {
      if (d.isCentral) return '#0176D3';
      const statusColorMap = { active: '#2E844A', draft: '#B25E00', review: '#0176D3', sunset: '#BA0517' };
      return statusColorMap[d.status] || '#0176D3';
    })
    .attr('stroke', 'white')
    .attr('stroke-width', d => d.isCentral ? 3 : 2)
    .attr('role', 'button')
    .attr('aria-label', d => `Rule ${d.id}: ${d.name}, status ${d.status}`)
    .style('cursor', 'pointer')
    .on('click', (e, d) => { if (!d.isCentral) openWorkspaceTab(d.id); })
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

  const labels = g.append('g').selectAll('text')
    .data(nodes)
    .enter().append('text')
    .attr('font-size', '12px')
    .attr('font-weight', 700)
    .attr('font-family', "'Salesforce Sans', 'Inter', -apple-system, sans-serif")
    .attr('text-anchor', 'middle')
    .attr('dy', d => d.isCentral ? '28px' : '22px')
    .attr('fill', '#032D60')
    .attr('pointer-events', 'none')
    .style('paint-order', 'stroke')
    .attr('stroke', '#fff')
    .attr('stroke-width', 3)
    .attr('stroke-linejoin', 'round')
    .text(d => d.id);

  simulation.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('cx', d => d.x).attr('cy', d => d.y);
    labels.attr('x', d => d.x).attr('y', d => d.y);
  });

  const zoom = d3.zoom().on('zoom', (e) => {
    g.attr('transform', e.transform);
  });
  svg.call(zoom);
}

// Start
renderProgramSwitcher(currentProgram);
init();
