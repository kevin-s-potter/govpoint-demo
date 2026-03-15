// Field definitions per program (extensible)
const CB_FIELDS = {
  'hosp-licensing': [
    { value: 'bed_count', label: 'Bed Count', type: 'number' },
    { value: 'licensed', label: 'Licensed', type: 'boolean' },
    { value: 'license_status', label: 'License Status', type: 'text' },
    { value: 'facility_type', label: 'Facility Type', type: 'text' },
    { value: 'accreditation_body', label: 'Accreditation Body', type: 'text' },
    { value: 'inspection_date', label: 'Last Inspection Date', type: 'date' },
    { value: 'compliance_score', label: 'Compliance Score', type: 'number' },
    { value: 'staff_ratio', label: 'Staff-to-Patient Ratio', type: 'number' },
    { value: 'emergency_capable', label: 'Emergency Capable', type: 'boolean' },
    { value: 'orc_chapter', label: 'ORC Chapter', type: 'text' },
    // ── Capacity Change Evaluation Fields (CAP-001, CAP-002, CAP-003) ──
    // These field names map directly to the evaluation context in the New Request form.
    // Editing conditions on CAP rules and saving immediately changes evaluation outcomes.
    { value: 'capital_expenditure',   label: 'Capital Expenditure ($)',    type: 'number' },
    { value: 'total_beds_proposed',   label: 'Total Beds Proposed',        type: 'number' },
    { value: 'net_bed_change',        label: 'Net Bed Change',             type: 'number' },
    { value: 'facility_class',        label: 'Facility Class',             type: 'text' },
    { value: 'involves_obstetric',    label: 'Involves Obstetric/Newborn', type: 'boolean' },
    { value: 'construction_required', label: 'Construction Required',      type: 'boolean' },
    { value: 'swing_bed_authorized',  label: 'Swing Bed Authorized',       type: 'boolean' }
  ],
  'snap': [
    { value: 'household_size', label: 'Household Size', type: 'number' },
    { value: 'gross_income', label: 'Gross Monthly Income', type: 'number' },
    { value: 'net_income', label: 'Net Monthly Income', type: 'number' },
    { value: 'resource_limit', label: 'Resource Limit', type: 'number' },
    { value: 'citizenship_status', label: 'Citizenship Status', type: 'text' },
    { value: 'work_requirement', label: 'Work Requirement Met', type: 'boolean' },
    { value: 'elderly_disabled', label: 'Elderly/Disabled Member', type: 'boolean' }
  ],
  'nursing-home': [
    { value: 'bed_count', label: 'Bed Count', type: 'number' },
    { value: 'licensed', label: 'Licensed', type: 'boolean' },
    { value: 'administrator_licensed', label: 'Administrator Licensed', type: 'boolean' },
    { value: 'nurse_staffing_ratio', label: 'Nurse Staffing Ratio', type: 'number' },
    { value: 'deficiency_count', label: 'Deficiency Count', type: 'number' },
    { value: 'fire_safety_compliant', label: 'Fire Safety Compliant', type: 'boolean' }
  ]
};

const CB_OPERATORS = {
  number: [
    { value: '>=', label: '>=' }, { value: '<=', label: '<=' },
    { value: '=', label: '=' }, { value: '!=', label: '!=' },
    { value: '>', label: '>' }, { value: '<', label: '<' }
  ],
  text: [
    { value: '=', label: 'equals' }, { value: '!=', label: 'not equals' },
    { value: 'contains', label: 'contains' }, { value: 'starts_with', label: 'starts with' }
  ],
  boolean: [
    { value: '=', label: 'is' }
  ],
  date: [
    { value: '>=', label: 'on or after' }, { value: '<=', label: 'on or before' },
    { value: '=', label: 'equals' }, { value: '>', label: 'after' }, { value: '<', label: 'before' }
  ]
};

// ── Initialize Condition Builder ────────────────────────────
function cbInitialize(conditions, rule, options = {}) {
  cbState.rule = rule;
  cbState.rawConditions = conditions;
  cbState.nextId = 1;
  cbState.aiSuggestions = [];
  cbState.testCases = [];
  cbState.lastTestResult = null;
  cbState.readOnly = options.readOnly === true;

  // Normalize DB operator/value_type values to UI-canonical values on load
  const opNorm  = { '==': '=', 'CONTAINS': 'contains' };
  const vtNorm  = { string: 'text', integer: 'number', decimal: 'number' };

  // Convert flat conditions into a single AND group
  if (conditions.length > 0) {
    cbState.groups = [{
      id: cbState.nextId++,
      logic: 'AND',
      conditions: conditions.map(c => ({
        id: cbState.nextId++,
        field: c.field,
        operator: opNorm[c.operator] ?? c.operator,
        value: c.value,
        valueType: vtNorm[c.value_type] ?? c.value_type ?? 'text',
        editing: false,
        source: 'db'
      }))
    }];
  } else {
    cbState.groups = [{
      id: cbState.nextId++,
      logic: 'AND',
      conditions: []
    }];
  }

  // Generate AI suggestions
  cbGenerateAISuggestions(rule, conditions);

  // Render
  cbRender();
  cbSwitchSidebarTab('suggestions');
}

// ── Main Render ─────────────────────────────────────────────
function cbRender() {
  const editor = document.getElementById('conditionEditor');
  const totalConditions = cbState.groups.reduce((sum, g) => sum + g.conditions.length, 0);
  document.getElementById('cbConditionCount').textContent = `${totalConditions} condition${totalConditions !== 1 ? 's' : ''} in ${cbState.groups.length} group${cbState.groups.length !== 1 ? 's' : ''}`;

  if (cbState.readOnly) {
    let html = `<div class="cb-readonly-notice">🔒 Conditions are read-only — <strong>${cbState.rule?.status}</strong>. Clone as New Version to propose changes.</div>`;
    const allConditions = (cbState.groups || []).flatMap(g => g.conditions);
    if (allConditions.length === 0) {
      html += `<div style="color:var(--text-secondary);font-size:12px;padding:16px;text-align:center;">No conditions defined for this rule.</div>`;
    } else {
      html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
      allConditions.forEach(c => {
        html += `<div style="padding:8px 12px;background:var(--slds-bg);border-radius:4px;font-size:12px;font-family:monospace;color:var(--text-dark);">${c.field} ${c.operator} ${c.value}</div>`;
      });
      html += `</div>`;
    }
    editor.innerHTML = html;
    document.querySelectorAll('.cb-toolbar button').forEach(b => b.style.display = 'none');
    return;
  }
  document.querySelectorAll('.cb-toolbar button').forEach(b => b.style.display = '');

  let html = '';
  cbState.groups.forEach((group, gi) => {
    const logicClass = group.logic === 'AND' ? 'cb-group-and' : 'cb-group-or';
    html += `<div class="cb-group ${logicClass}" data-group-id="${group.id}">`;
    html += `<div class="cb-group-header">`;
    html += `<div class="cb-group-toggle">
      <button class="${group.logic === 'AND' ? 'active-and' : ''}" onclick="cbToggleGroupLogic(${group.id}, 'AND')">AND</button>
      <button class="${group.logic === 'OR' ? 'active-or' : ''}" onclick="cbToggleGroupLogic(${group.id}, 'OR')">OR</button>
    </div>`;
    html += `<span style="font-size:11px;color:var(--text-secondary);">Group ${gi + 1}</span>`;
    html += `<div class="cb-group-actions">`;
    html += `<button class="cb-btn-sm" style="background:var(--slds-blue);color:#fff;" onclick="cbAddConditionToGroup(${group.id})">+ Condition</button>`;
    if (cbState.groups.length > 1) {
      html += `<button class="cb-btn-sm cb-btn-remove" onclick="cbRemoveGroup(${group.id})">Remove Group</button>`;
    }
    html += `</div></div>`;

    if (group.conditions.length === 0) {
      html += `<div style="color:var(--text-secondary);font-size:12px;padding:16px;text-align:center;">No conditions in this group. Click "+ Condition" to add one.</div>`;
    }

    group.conditions.forEach((cond, ci) => {
      const fields = CB_FIELDS[currentProgram] || CB_FIELDS['hosp-licensing'];
      const fieldDef = fields.find(f => f.value === cond.field) || { type: 'text' };
      const operators = CB_OPERATORS[fieldDef.type] || CB_OPERATORS.text;
      const extraClass = cond.editing ? 'cb-editing' : (cond.source === 'ai' ? 'cb-ai-suggestion' : '');

      if (cond.editing) {
        // Editable row
        html += `<div class="condition-row ${extraClass}">`;
        html += `<select class="cb-field-select slds-select" onchange="cbUpdateField(${group.id}, ${cond.id}, this.value)">
          <option value="">-- Field --</option>
          ${fields.map(f => `<option value="${f.value}" ${f.value === cond.field ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>`;
        html += `<select class="cb-op-select slds-select" onchange="cbUpdateOp(${group.id}, ${cond.id}, this.value)">
          ${operators.map(o => `<option value="${o.value}" ${o.value === cond.operator ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>`;
        if (fieldDef.type === 'boolean') {
          html += `<select class="cb-value-input slds-select" onchange="cbUpdateValue(${group.id}, ${cond.id}, this.value)">
            <option value="true" ${cond.value === 'true' ? 'selected' : ''}>True</option>
            <option value="false" ${cond.value === 'false' ? 'selected' : ''}>False</option>
          </select>`;
        } else {
          html += `<input class="cb-value-input slds-input" type="${fieldDef.type === 'number' ? 'number' : fieldDef.type === 'date' ? 'date' : 'text'}" value="${cond.value}" onchange="cbUpdateValue(${group.id}, ${cond.id}, this.value)" placeholder="Enter value..." />`;
        }
        html += `<span class="cb-type-badge">${fieldDef.type}</span>`;
        html += `<div class="cb-row-actions">
          <button class="cb-btn-sm" style="background:var(--slds-success);color:#fff;border:none;" onclick="cbSaveCondition(${group.id}, ${cond.id})">Save</button>
          <button class="cb-btn-sm cb-btn-remove" onclick="cbRemoveCondition(${group.id}, ${cond.id})">✕</button>
        </div>`;
        html += `</div>`;
      } else if (cond.source === 'ai') {
        // AI suggestion row — accept/reject
        html += `<div class="condition-row cb-ai-suggestion">`;
        html += `<span style="font-size:12px;color:var(--slds-blue);font-weight:600;">✨ AI:</span>`;
        html += `<span style="font-weight:600;color:var(--slds-navy);min-width:120px;">${fieldDef.label || cond.field}</span>`;
        html += `<span style="font-weight:600;color:var(--slds-error);min-width:40px;text-align:center;">${cond.operator}</span>`;
        html += `<span style="flex:1;">${cond.value}</span>`;
        html += `<span class="cb-type-badge">${cond.valueType}</span>`;
        html += `<div class="cb-row-actions">
          <button class="cb-btn-sm cb-btn-accept" onclick="cbAcceptAI(${group.id}, ${cond.id})">Accept</button>
          <button class="cb-btn-sm cb-btn-reject" onclick="cbRemoveCondition(${group.id}, ${cond.id})">Reject</button>
        </div>`;
        html += `</div>`;
      } else {
        // Read-only display row
        html += `<div class="condition-row ${extraClass}">`;
        if (ci > 0) {
          html += `<span style="font-size:11px;font-weight:700;color:${group.logic === 'AND' ? 'var(--slds-blue)' : '#DD7A01'};min-width:32px;">${group.logic}</span>`;
        } else {
          html += `<span style="font-size:11px;font-weight:700;color:var(--text-secondary);min-width:32px;">IF</span>`;
        }
        html += `<span style="font-weight:600;color:var(--slds-navy);min-width:120px;">${fieldDef.label || cond.field}</span>`;
        html += `<span style="font-weight:600;color:var(--slds-error);min-width:40px;text-align:center;">${cond.operator}</span>`;
        html += `<span style="flex:1;">${cond.value}</span>`;
        html += `<span class="cb-type-badge">${cond.valueType}</span>`;
        html += `<div class="cb-row-actions">
          <button class="cb-btn-sm cb-btn-edit" onclick="cbToggleEdit(${group.id}, ${cond.id})">Edit</button>
          <button class="cb-btn-sm cb-btn-remove" onclick="cbRemoveCondition(${group.id}, ${cond.id})">✕</button>
        </div>`;
        html += `</div>`;
      }
    });

    html += `</div>`;
  });

  editor.innerHTML = html;

  // Update logic preview
  cbRenderLogicPreview();
}

// ── Logic Tree Preview ──────────────────────────────────────
function cbRenderLogicPreview() {
  const preview = document.getElementById('cbLogicPreview');
  const allConditions = cbState.groups.reduce((sum, g) => sum + g.conditions.filter(c => c.source !== 'ai').length, 0);
  if (allConditions === 0) {
    preview.style.display = 'none';
    return;
  }
  preview.style.display = 'block';

  const groupStrings = cbState.groups.map(group => {
    const accepted = group.conditions.filter(c => c.source !== 'ai');
    if (accepted.length === 0) return null;
    const condStrings = accepted.map(c =>
      `<span class="cb-logic-field">${c.field}</span> <span class="cb-logic-op">${c.operator}</span> <span class="cb-logic-value">${c.value}</span>`
    );
    if (condStrings.length === 1) return condStrings[0];
    return `(${condStrings.join(` <span class="cb-logic-keyword">${group.logic}</span> `)})`;
  }).filter(Boolean);

  if (groupStrings.length === 0) {
    preview.style.display = 'none';
    return;
  }

  const combined = groupStrings.length === 1 ? groupStrings[0] :
    groupStrings.join(`\n<span class="cb-logic-keyword">AND</span>\n`);

  preview.innerHTML = `<div style="font-size:10px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;">Logic Expression</div>${combined}`;
}

// ── Group & Condition CRUD ──────────────────────────────────
function cbAddCondition() {
  if (cbState.groups.length === 0) {
    cbState.groups.push({ id: cbState.nextId++, logic: 'AND', conditions: [] });
  }
  const group = cbState.groups[0];
  group.conditions.push({
    id: cbState.nextId++, field: '', operator: '=', value: '', valueType: 'text', editing: true, source: 'user'
  });
  cbRender();
}

function cbAddGroup() {
  cbState.groups.push({
    id: cbState.nextId++, logic: 'OR', conditions: [{
      id: cbState.nextId++, field: '', operator: '=', value: '', valueType: 'text', editing: true, source: 'user'
    }]
  });
  cbRender();
}

function cbAddConditionToGroup(groupId) {
  const group = cbState.groups.find(g => g.id === groupId);
  if (!group) return;
  group.conditions.push({
    id: cbState.nextId++, field: '', operator: '=', value: '', valueType: 'text', editing: true, source: 'user'
  });
  cbRender();
}

async function cbRemoveCondition(groupId, condId) {
  if (cbState.readOnly) { showToast('This rule is read-only'); return; }
  const group = cbState.groups.find(g => g.id === groupId);
  if (!group) return;
  group.conditions = group.conditions.filter(c => c.id !== condId);
  cbRender();
  try {
    await cbPersistConditions('Condition removed');
    showToast('Condition removed');
  } catch (e) {
    showToast(`Error: ${e.message}`);
  }
}

// ── Shared helper: persist current cbState conditions to Supabase ──
async function cbPersistConditions(auditSummary) {
  if (!currentRule) return;
  if (currentRule && currentRule.status === 'draft') {
    const config = PROGRAM_CONFIG[currentProgram];
    await lexipoint.saveConditions(currentRule.rule_id, config.tenant, cbGetCurrentConditions());
    return; // skip audit write and rawConditions update during staging
  }
  const config = PROGRAM_CONFIG[currentProgram];
  const conditions = cbGetCurrentConditions();
  await lexipoint.saveConditions(currentRule.rule_id, config.tenant, conditions);
  cbState.rawConditions = conditions.map((c, i) => ({
    rule_id: currentRule.rule_id,
    field: c.field,
    operator: c.operator,
    value: c.value,
    value_type: c.value_type,
    order: i + 1
  }));
  await lexipoint.addAuditEntry(
    config.tenant, config.userId, 'publisher', 'edit_rule',
    'rule', currentRule.rule_id, auditSummary
  );
  try {
    localStorage.setItem(`lp_live_conds_${currentRule.rule_id}`, JSON.stringify(conditions));
  } catch (e) {}
}

// ── Row-level Save: persist a single condition edit immediately ──
async function cbSaveCondition(groupId, condId) {
  if (cbState.readOnly) { showToast('This rule is read-only'); return; }
  const group = cbState.groups.find(g => g.id === groupId);
  if (!group) return;
  const cond = group.conditions.find(c => c.id === condId);
  if (!cond) return;

  if (!cond.field || String(cond.value).trim() === '') {
    showToast('Field and value are required before saving');
    return;
  }

  cond.editing = false;
  cond.source = cond.source === 'ai' ? 'accepted' : 'user';
  cbRender();

  try {
    await cbPersistConditions(`Condition saved: ${cond.field} ${cond.operator} ${cond.value}`);
    showToast('Condition saved');
  } catch (e) {
    showToast(`Error: ${e.message}`);
    console.error('[cbSaveCondition] Failed:', e);
  }
}

function cbRemoveGroup(groupId) {
  cbState.groups = cbState.groups.filter(g => g.id !== groupId);
  if (cbState.groups.length === 0) {
    cbState.groups.push({ id: cbState.nextId++, logic: 'AND', conditions: [] });
  }
  cbRender();
}

function cbToggleGroupLogic(groupId, logic) {
  const group = cbState.groups.find(g => g.id === groupId);
  if (group) { group.logic = logic; cbRender(); }
}

function cbToggleEdit(groupId, condId) {
  const group = cbState.groups.find(g => g.id === groupId);
  if (!group) return;
  const cond = group.conditions.find(c => c.id === condId);
  if (cond) { cond.editing = !cond.editing; cbRender(); }
}

function cbUpdateField(groupId, condId, val) {
  const group = cbState.groups.find(g => g.id === groupId);
  if (!group) return;
  const cond = group.conditions.find(c => c.id === condId);
  if (!cond) return;
  cond.field = val;
  const fields = CB_FIELDS[currentProgram] || CB_FIELDS['hosp-licensing'];
  const fieldDef = fields.find(f => f.value === val);
  if (fieldDef) {
    cond.valueType = fieldDef.type;
    const ops = CB_OPERATORS[fieldDef.type];
    if (ops && !ops.find(o => o.value === cond.operator)) {
      cond.operator = ops[0].value;
    }
    if (fieldDef.type === 'boolean' && cond.value !== 'true' && cond.value !== 'false') {
      cond.value = 'true';
    }
  }
  cbRender();
}

function cbUpdateOp(groupId, condId, val) {
  const group = cbState.groups.find(g => g.id === groupId);
  if (!group) return;
  const cond = group.conditions.find(c => c.id === condId);
  if (cond) { cond.operator = val; }
}

function cbUpdateValue(groupId, condId, val) {
  const group = cbState.groups.find(g => g.id === groupId);
  if (!group) return;
  const cond = group.conditions.find(c => c.id === condId);
  if (cond) { cond.value = val; cbRenderLogicPreview(); }
}

function cbAcceptAI(groupId, condId) {
  const group = cbState.groups.find(g => g.id === groupId);
  if (!group) return;
  const cond = group.conditions.find(c => c.id === condId);
  if (cond) {
    cond.source = 'user';
    if (cbState.rule) {
      lexipoint.addAuditEntry(
        'ohio-odh', 'user-001', 'publisher', 'accept_ai_suggestion',
        'rule', cbState.rule.rule_id,
        `AI suggestion accepted: ${cond.field} ${cond.operator} ${cond.value}`
      );
    }
    cbRender();
  }
}

function cbExpandAll() {
  cbState.groups.forEach(g => g.conditions.forEach(c => { c.editing = true; }));
  cbRender();
}

// ── AI Suggestions Engine ───────────────────────────────────
function cbGenerateAISuggestions(rule, existingConditions) {
  // Simulated AI analysis based on rule text and existing conditions
  const suggestions = [];
  const existingFields = existingConditions.map(c => c.field);

  // Rule-specific AI suggestions
  const ruleHints = {
    'OH-001': {
      suggestions: [
        { type: 'suggestion', field: 'orc_chapter', operator: '=', value: '3702', valueType: 'text',
          reason: 'Source text references "Chapter 3702 of the Revised Code" as the licensing authority.' },
        { type: 'suggestion', field: 'facility_type', operator: '=', value: 'hospital', valueType: 'text',
          reason: 'Rule applies specifically to hospital facilities per source text.' }
      ],
      conflicts: [],
      gaps: [
        { text: 'Source text mentions "license issued by the director of health" but no condition validates the issuing authority.', field: 'license_authority' },
        { text: 'No condition checks license expiration date, though ongoing compliance is implied by "shall maintain."', field: 'license_expiration' }
      ]
    },
    'OH-002': {
      suggestions: [
        { type: 'suggestion', field: 'accreditation_body', operator: '=', value: 'Joint Commission', valueType: 'text',
          reason: 'Source references Joint Commission accreditation as a compliance pathway.' },
        { type: 'suggestion', field: 'inspection_date', operator: '>=', value: '2024-01-01', valueType: 'date',
          reason: 'Annual inspection requirement implies most recent inspection must be within the last year.' }
      ],
      conflicts: [
        { text: 'Condition "bed_count >= 25" may conflict with the separate critical access hospital exception (≤25 beds). Consider adding facility_type exclusion.', fields: ['bed_count', 'facility_type'] }
      ],
      gaps: [
        { text: 'Source mentions "continuous compliance monitoring" but no condition implements a periodic review schedule.', field: 'review_frequency' }
      ]
    },
    'OH-003': {
      suggestions: [
        { type: 'suggestion', field: 'emergency_capable', operator: '=', value: 'true', valueType: 'boolean',
          reason: 'Rule requires emergency department capability per source text.' },
        { type: 'suggestion', field: 'staff_ratio', operator: '>=', value: '1.5', valueType: 'number',
          reason: 'Staffing guidelines in source text recommend minimum 1.5 nurses per patient in acute care.' }
      ],
      conflicts: [],
      gaps: [
        { text: 'Source references "24-hour physician coverage" but no condition validates physician staffing levels.', field: 'physician_coverage' }
      ]
    }
  };

  const hints = ruleHints[rule.rule_id] || {
    suggestions: [
      { type: 'suggestion', field: existingFields.includes('licensed') ? 'compliance_score' : 'licensed',
        operator: existingFields.includes('licensed') ? '>=' : '=',
        value: existingFields.includes('licensed') ? '80' : 'true',
        valueType: existingFields.includes('licensed') ? 'number' : 'boolean',
        reason: 'Standard compliance verification recommended for this rule type.' }
    ],
    conflicts: existingConditions.length > 3 ? [
      { text: 'Multiple conditions on similar fields may create overlapping or contradictory requirements. Review for logical consistency.', fields: existingFields.slice(0, 2) }
    ] : [],
    gaps: [
      { text: 'Consider adding a temporal condition (date-based) to establish when this rule takes effect or expires.', field: 'effective_date' }
    ]
  };

  cbState.aiSuggestions = {
    suggestions: hints.suggestions.filter(s => !existingFields.includes(s.field)),
    conflicts: hints.conflicts,
    gaps: hints.gaps
  };
}

// ── Sidebar Tab Switching ───────────────────────────────────
function cbSwitchSidebarTab(tab) {
  cbState.sidebarTab = tab;
  document.querySelectorAll('.cb-sidebar-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.stab === tab);
  });

  const content = document.getElementById('cbSidebarContent');
  if (tab === 'suggestions') cbRenderSuggestions(content);
  else if (tab === 'test') cbRenderTestPanel(content);
  else if (tab === 'coverage') cbRenderCoverage(content);
}

// ── Suggestions Panel ───────────────────────────────────────
function cbRenderSuggestions(container) {
  const ai = cbState.aiSuggestions;
  let html = '';

  // Conflicts first (highest priority)
  if (ai.conflicts && ai.conflicts.length > 0) {
    html += `<div style="font-size:11px;font-weight:700;color:var(--slds-error);margin-bottom:8px;text-transform:uppercase;">⚠ Conflicts Detected</div>`;
    ai.conflicts.forEach(c => {
      html += `<div class="cb-suggestion-card cb-s-conflict">
        <div class="cb-suggestion-label" style="color:var(--slds-error);">Conflict</div>
        <div class="cb-suggestion-text">${c.text}</div>
        ${c.fields ? `<div style="font-size:11px;color:var(--text-secondary);">Affected: ${c.fields.map(f => `<span class="cb-suggestion-field">${f}</span>`).join(', ')}</div>` : ''}
      </div>`;
    });
  }

  // Gap analysis
  if (ai.gaps && ai.gaps.length > 0) {
    html += `<div style="font-size:11px;font-weight:700;color:#DD7A01;margin:12px 0 8px;text-transform:uppercase;">📋 Gap Analysis</div>`;
    ai.gaps.forEach(g => {
      html += `<div class="cb-suggestion-card cb-s-gap">
        <div class="cb-suggestion-label" style="color:#DD7A01;">Gap</div>
        <div class="cb-suggestion-text">${g.text}</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">Missing field: <span class="cb-suggestion-field">${g.field}</span></div>
      </div>`;
    });
  }

  // Suggested conditions
  if (ai.suggestions && ai.suggestions.length > 0) {
    html += `<div style="font-size:11px;font-weight:700;color:var(--slds-blue);margin:12px 0 8px;text-transform:uppercase;">💡 Suggested Conditions</div>`;
    ai.suggestions.forEach((s, i) => {
      html += `<div class="cb-suggestion-card cb-s-suggestion">
        <div class="cb-suggestion-label" style="color:var(--slds-blue);">Suggestion</div>
        <div style="font-size:12px;font-weight:600;color:var(--slds-navy);margin-bottom:4px;">${s.field} ${s.operator} ${s.value}</div>
        <div class="cb-suggestion-text">${s.reason}</div>
        <div class="cb-suggestion-actions">
          <button class="cb-btn-sm cb-btn-accept" onclick="cbApplySuggestion(${i})">Accept</button>
          <button class="cb-btn-sm cb-btn-reject" onclick="cbDismissSuggestion(${i})">Dismiss</button>
        </div>
      </div>`;
    });
  }

  if (!ai.conflicts?.length && !ai.gaps?.length && !ai.suggestions?.length) {
    html = `<div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;">
      <div style="font-size:32px;margin-bottom:8px;">✅</div>
      No issues detected. Conditions look well-structured.
    </div>`;
  }

  html += `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--slds-border);">
    <button class="slds-button slds-button_neutral cb-btn-sm" style="width:100%;text-align:center;" onclick="cbRefreshAI()">🔄 Re-analyze Conditions</button>
  </div>`;

  container.innerHTML = html;
}

function cbApplySuggestion(index) {
  const s = cbState.aiSuggestions.suggestions[index];
  if (!s) return;
  // Add as accepted condition to first group
  if (cbState.groups.length === 0) {
    cbState.groups.push({ id: cbState.nextId++, logic: 'AND', conditions: [] });
  }
  cbState.groups[0].conditions.push({
    id: cbState.nextId++, field: s.field, operator: s.operator, value: s.value,
    valueType: s.valueType, editing: false, source: 'accepted'
  });
  cbState.aiSuggestions.suggestions.splice(index, 1);

  // Log AI suggestion acceptance to audit trail
  if (cbState.rule) {
    lexipoint.addAuditEntry(
      'ohio-odh', 'user-001', 'publisher', 'accept_ai_suggestion',
      'rule', cbState.rule.rule_id,
      `AI suggestion accepted: ${s.field} ${s.operator} ${s.value}`
    );
  }

  cbRender();
  cbSwitchSidebarTab('suggestions');
}

function cbDismissSuggestion(index) {
  cbState.aiSuggestions.suggestions.splice(index, 1);
  cbSwitchSidebarTab('suggestions');
}

function cbRefreshAI() {
  if (cbState.rule) {
    const currentConditions = [];
    cbState.groups.forEach(g => g.conditions.filter(c => c.source !== 'ai').forEach(c => currentConditions.push(c)));
    cbGenerateAISuggestions(cbState.rule, currentConditions);
    cbSwitchSidebarTab('suggestions');
  }
}

// ── Test Panel ──────────────────────────────────────────────
function cbRenderTestPanel(container) {
  // Collect unique conditions (not from AI) to build test inputs
  const usedConds = [];  // {field, cond} — one per unique field
  const seen = new Set();
  cbState.groups.forEach(g => g.conditions.forEach(c => {
    if (c.field && c.source !== 'ai' && !seen.has(c.field)) { seen.add(c.field); usedConds.push(c); }
  }));

  let html = `<div style="font-size:11px;font-weight:700;color:var(--slds-navy);margin-bottom:10px;text-transform:uppercase;">Test with Sample Data</div>`;
  html += `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Enter values below and run the test to see which conditions pass or fail.</div>`;

  if (usedConds.length === 0) {
    html += `<div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;">Add conditions first to enable testing.</div>`;
    container.innerHTML = html;
    return;
  }

  // Pre-populate booleans that have no test value yet
  usedConds.forEach(cond => {
    const resolvedType = cbResolveType(cond);
    if (resolvedType === 'boolean' && !cbState.testCases.find(t => t.field === cond.field)) {
      cbState.testCases.push({ field: cond.field, value: 'true' });
    }
  });

  html += `<div id="cbTestInputs">`;
  usedConds.forEach(cond => {
    const resolvedType = cbResolveType(cond);
    const label = cbFieldLabel(cond);
    const existing = cbState.testCases.find(t => t.field === cond.field);
    const val = existing ? existing.value : '';
    // Find what the condition expects for this field (for the hint)
    let hint = '';
    cbState.groups.forEach(g => g.conditions.forEach(c => {
      if (c.field === cond.field && c.source !== 'ai' && !hint) hint = `${c.operator} ${c.value}`;
    }));
    html += `<div class="cb-test-row" data-field="${cond.field}">
      <label title="Condition expects: ${hint}">${label}</label>
      ${resolvedType === 'boolean'
        ? `<select oninput="cbSetTestValue('${cond.field}', this.value)">
            <option value="true" ${val === 'true' ? 'selected' : ''}>True</option>
            <option value="false" ${val !== 'true' ? 'selected' : ''}>False</option>
          </select>`
        : `<input type="${resolvedType === 'number' ? 'number' : resolvedType === 'date' ? 'date' : 'text'}"
            value="${val}" oninput="cbSetTestValue('${cond.field}', this.value)"
            placeholder="${hint ? 'expects ' + hint : resolvedType}" />`
      }
    </div>`;
  });
  html += `</div>`;

  html += `<button class="slds-button slds-button_brand cb-btn-sm" style="width:100%;margin-top:8px;padding:8px;" onclick="cbRunTest()">▶ Run Test</button>`;

  // Result area — separate div so we can update it without wiping inputs
  html += `<div id="cbTestResultArea">`;
  if (cbState.lastTestResult) {
    html += cbFormatTestResult(cbState.lastTestResult);
  }
  html += `</div>`;

  html += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--slds-border);">
    <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;">Quick Presets</div>
    <button class="slds-button slds-button_neutral cb-btn-sm" style="margin-bottom:4px;width:100%;" onclick="cbLoadPreset('passing')">Load Passing Values</button>
    <button class="slds-button slds-button_neutral cb-btn-sm" style="width:100%;" onclick="cbLoadPreset('failing')">Load Failing Values</button>
  </div>`;

  container.innerHTML = html;
}

function cbFormatTestResult(r) {
  let html = `<div class="cb-test-result ${r.pass ? 'cb-test-pass' : 'cb-test-fail'}" style="margin-top:10px;">
    <div style="font-size:14px;margin-bottom:6px;">${r.pass ? '✅ PASS' : '❌ FAIL'} — ${r.summary}</div>`;
  r.details.forEach(d => {
    html += `<div class="cb-test-detail" style="margin-bottom:3px;">${d}</div>`;
  });
  if (r.groupDetails) {
    r.groupDetails.forEach(gd => {
      html += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(0,0,0,0.08);">
        <div style="font-size:11px;font-weight:700;color:var(--slds-navy);margin-bottom:4px;">${gd.label} — ${gd.pass ? '✅ Passed' : '❌ Failed'}</div>
        ${gd.results.map(r => `<div class="cb-test-detail">${r}</div>`).join('')}
      </div>`;
    });
  }
  html += `</div>`;
  return html;
}

function cbSetTestValue(field, value) {
  const existing = cbState.testCases.find(t => t.field === field);
  if (existing) { existing.value = value; }
  else { cbState.testCases.push({ field, value }); }
}

// Resolve data type from condition's own valueType (from DB), CB_FIELDS, or heuristics
function cbResolveType(cond) {
  const vt = (cond.valueType || '').toLowerCase();
  if (vt === 'integer' || vt === 'number' || vt === 'numeric' || vt === 'float' || vt === 'decimal' || vt === 'int') return 'number';
  if (vt === 'boolean' || vt === 'bool') return 'boolean';
  if (vt === 'date' || vt === 'datetime' || vt === 'timestamp') return 'date';
  if (vt === 'text' || vt === 'string' || vt === 'varchar') return 'text';
  // Fallback: CB_FIELDS
  const fields = CB_FIELDS[currentProgram] || CB_FIELDS['hosp-licensing'];
  const fieldDef = fields.find(f => f.value === cond.field);
  if (fieldDef) return fieldDef.type;
  // Heuristic
  if (cond.value && !isNaN(cond.value) && cond.value.trim() !== '') return 'number';
  if (cond.value === 'true' || cond.value === 'false') return 'boolean';
  return 'text';
}

// Resolve field label — CB_FIELDS first, then prettified field name
function cbFieldLabel(cond) {
  const fields = CB_FIELDS[currentProgram] || CB_FIELDS['hosp-licensing'];
  const fieldDef = fields.find(f => f.value === cond.field);
  return fieldDef ? fieldDef.label : cond.field;
}

// Normalize operator — DB may store == or <> instead of = or !=
function cbNormalizeOp(op) {
  if (op === '==' || op === '===') return '=';
  if (op === '!==' || op === '<>') return '!=';
  return op;
}

function cbEvalCondition(cond, testVal) {
  const type = cbResolveType(cond);
  const op = cbNormalizeOp(cond.operator);
  const fieldLabel = cbFieldLabel(cond);
  let pass = false;

  if (type === 'number') {
    const a = parseFloat(testVal), b = parseFloat(cond.value);
    if (isNaN(a) || isNaN(b)) return { pass: false, reason: `<span style="color:var(--slds-error);">❌</span> <strong>${fieldLabel}</strong>: cannot compare "${testVal}" to "${cond.value}" (not numbers)` };
    if (op === '>=') pass = a >= b;
    else if (op === '<=') pass = a <= b;
    else if (op === '>') pass = a > b;
    else if (op === '<') pass = a < b;
    else if (op === '=') pass = a === b;
    else if (op === '!=') pass = a !== b;
    else pass = a >= b; // default for unknown numeric ops
  } else if (type === 'boolean') {
    const a = String(testVal).toLowerCase().trim();
    const b = String(cond.value).toLowerCase().trim();
    if (op === '!=' || op === '<>') pass = (a !== b);
    else pass = (a === b); // = and == both mean equality for booleans
  } else if (type === 'date') {
    const a = new Date(testVal), b = new Date(cond.value);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return { pass: false, reason: `<span style="color:var(--slds-error);">❌</span> <strong>${fieldLabel}</strong>: invalid date "${testVal}" or "${cond.value}"` };
    if (op === '>=') pass = a >= b;
    else if (op === '<=') pass = a <= b;
    else if (op === '>') pass = a > b;
    else if (op === '<') pass = a < b;
    else if (op === '=') pass = a.getTime() === b.getTime();
    else if (op === '!=') pass = a.getTime() !== b.getTime();
  } else {
    // Text comparison
    const a = String(testVal).toLowerCase().trim();
    const b = String(cond.value).toLowerCase().trim();
    if (op === '=' || op === '==') pass = a === b;
    else if (op === '!=') pass = a !== b;
    else if (op === 'contains') pass = a.includes(b);
    else if (op === 'starts_with') pass = a.startsWith(b);
    else pass = a === b; // fallback
  }

  return {
    pass,
    reason: pass
      ? `<span style="color:#2E844A;">✅</span> <strong>${fieldLabel}</strong> ${cond.operator} ${cond.value} — input: "${testVal}"`
      : `<span style="color:var(--slds-error);">❌</span> <strong>${fieldLabel}</strong> ${cond.operator} ${cond.value} — input: "${testVal}" <span style="color:var(--slds-error);">(failed)</span>`
  };
}

function cbRunTest() {
  // Capture current input values from DOM using data-field attribute
  const rows = document.querySelectorAll('#cbTestInputs .cb-test-row');
  rows.forEach(row => {
    const fieldKey = row.getAttribute('data-field');
    const inputEl = row.querySelector('input, select');
    if (fieldKey && inputEl) cbSetTestValue(fieldKey, inputEl.value);
  });

  const groupDetails = [];
  let allGroupsPassed = true;

  cbState.groups.forEach((group, gi) => {
    const accepted = group.conditions.filter(c => c.source !== 'ai' && c.field);
    if (accepted.length === 0) return;

    const condResults = accepted.map(cond => {
      const testCase = cbState.testCases.find(t => t.field === cond.field);
      const testVal = testCase ? testCase.value : '';
      if (testVal === '' && testVal !== '0') {
        const fieldLabel = cbFieldLabel(cond);
        return { pass: false, reason: `<span style="color:var(--slds-error);">⚠️</span> <strong>${fieldLabel}</strong> — no test value provided` };
      }
      return cbEvalCondition(cond, testVal);
    });

    const groupPass = group.logic === 'AND'
      ? condResults.every(r => r.pass)
      : condResults.some(r => r.pass);

    if (!groupPass) allGroupsPassed = false;
    groupDetails.push({
      label: `Group ${gi + 1} (${group.logic})`,
      pass: groupPass,
      results: condResults.map(r => r.reason)
    });
  });

  const totalConds = groupDetails.reduce((s, g) => s + g.results.length, 0);
  const passedConds = groupDetails.reduce((s, g) => s + g.results.filter((_, i) => {
    const accepted = cbState.groups[groupDetails.indexOf(g)]?.conditions.filter(c => c.source !== 'ai' && c.field) || [];
    return true; // counted in groupDetails
  }).length, 0);

  cbState.lastTestResult = {
    pass: allGroupsPassed,
    summary: allGroupsPassed
      ? `All ${cbState.groups.length > 1 ? cbState.groups.length + ' groups' : 'conditions'} satisfied.`
      : `Failed — review details below.`,
    details: [],
    groupDetails
  };

  // Update just the result area without wiping inputs
  const resultArea = document.getElementById('cbTestResultArea');
  if (resultArea) {
    resultArea.innerHTML = cbFormatTestResult(cbState.lastTestResult);
  } else {
    cbSwitchSidebarTab('test');
  }
}

function cbLoadPreset(type) {
  cbState.testCases = [];
  cbState.lastTestResult = null;

  cbState.groups.forEach(g => g.conditions.filter(c => c.source !== 'ai' && c.field).forEach(cond => {
    const resolvedType = cbResolveType(cond);
    const normOp = cbNormalizeOp(cond.operator);
    let val;
    if (type === 'passing') {
      if (resolvedType === 'number') {
        const num = parseFloat(cond.value) || 0;
        if (normOp === '>=' || normOp === '>') val = String(num + 10);
        else if (normOp === '<=' || normOp === '<') val = String(Math.max(0, num - 10));
        else val = cond.value;
      } else if (resolvedType === 'boolean') { val = cond.value; }
      else if (resolvedType === 'date') {
        const d = new Date(cond.value);
        if (normOp === '>=' || normOp === '>') { d.setFullYear(d.getFullYear() + 1); val = d.toISOString().split('T')[0]; }
        else if (normOp === '<=' || normOp === '<') { d.setFullYear(d.getFullYear() - 1); val = d.toISOString().split('T')[0]; }
        else val = cond.value;
      } else { val = cond.value; }
    } else {
      if (resolvedType === 'number') {
        const num = parseFloat(cond.value) || 0;
        if (normOp === '>=' || normOp === '>') val = String(Math.max(0, num - 10));
        else if (normOp === '<=' || normOp === '<') val = String(num + 10);
        else val = String(num + 1);
      } else if (resolvedType === 'boolean') { val = cond.value === 'true' ? 'false' : 'true'; }
      else if (resolvedType === 'date') {
        const d = new Date(cond.value);
        if (normOp === '>=' || normOp === '>') { d.setFullYear(d.getFullYear() - 2); val = d.toISOString().split('T')[0]; }
        else if (normOp === '<=' || normOp === '<') { d.setFullYear(d.getFullYear() + 2); val = d.toISOString().split('T')[0]; }
        else { d.setDate(d.getDate() + 1); val = d.toISOString().split('T')[0]; }
      } else { val = ''; }
    }
    if (!cbState.testCases.find(t => t.field === cond.field)) {
      cbState.testCases.push({ field: cond.field, value: val });
    }
  }));

  // Re-render to show preset values in inputs
  cbSwitchSidebarTab('test');
}

// ── Coverage Panel — Policy Requirement Validation ──────────
function cbRenderCoverage(container) {
  const rule = cbState.rule;
  if (!rule) { container.innerHTML = '<div style="padding:16px;color:var(--text-secondary);">No rule selected.</div>'; return; }

  const accepted = [];
  cbState.groups.forEach(g => g.conditions.filter(c => c.source !== 'ai' && c.field).forEach(c => accepted.push(c)));

  // Deep policy requirement mappings — each requirement specifies the expected condition
  // status: 'full' = field+operator+value correct, 'partial' = field exists but wrong op/value, 'missing' = no condition
  const policyRequirements = {
    'OH-001': {
      sourceText: 'A hospital shall maintain a minimum capacity of not less than 25 licensed beds and shall operate under a license issued by the director of health. The hospital shall be duly licensed as a hospital under the provisions of Chapter 3702 of the Revised Code.',
      requirements: [
        {
          id: 'req-1', policyPhrase: 'minimum capacity of not less than 25 licensed beds',
          description: 'Facility must have at least 25 licensed beds',
          expectedField: 'bed_count', expectedOp: '>=', expectedValue: '25',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'bed_count');
            if (!c) return { status: 'missing', detail: 'No condition checks bed count' };
            if ((c.operator === '>=' || c.operator === '>') && parseFloat(c.value) <= 25) return { status: 'full', detail: `Covered: ${c.field} ${c.operator} ${c.value}` };
            if (c.operator === '>=' && parseFloat(c.value) > 25) return { status: 'partial', detail: `Condition is stricter than policy requires (${c.value} vs. 25). Policy says "not less than 25."` };
            if (c.operator === '<=' || c.operator === '<') return { status: 'partial', detail: `Wrong direction: condition uses "${c.operator}" but policy requires minimum (>=)` };
            if (c.operator === '=') return { status: 'partial', detail: `Exact match "=" is too restrictive. Policy says "not less than" which means >=` };
            return { status: 'partial', detail: `Field exists but operator "${c.operator}" doesn't match policy intent (>=)` };
          }
        },
        {
          id: 'req-2', policyPhrase: 'shall operate under a license',
          description: 'Facility must hold a valid operating license',
          expectedField: 'licensed', expectedOp: '=', expectedValue: 'true',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'licensed');
            if (!c) return { status: 'missing', detail: 'No condition validates licensure status' };
            if (c.value === 'true' || c.value === 'yes') return { status: 'full', detail: `Covered: ${c.field} ${c.operator} ${c.value}` };
            return { status: 'partial', detail: `Condition exists but value "${c.value}" doesn't confirm active licensure` };
          }
        },
        {
          id: 'req-3', policyPhrase: 'license issued by the director of health',
          description: 'License must be from the OH Director of Health (not just any authority)',
          expectedField: 'license_authority', expectedOp: '=', expectedValue: 'OH Director of Health',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'license_authority');
            if (!c) return { status: 'missing', detail: 'No condition verifies the issuing authority. A facility could have a license from a different jurisdiction.' };
            return { status: 'full', detail: `Covered: ${c.field} ${c.operator} ${c.value}` };
          }
        },
        {
          id: 'req-4', policyPhrase: 'duly licensed as a hospital under Chapter 3702',
          description: 'Facility type must be "hospital" and cite ORC Chapter 3702',
          expectedField: 'facility_type', expectedOp: '=', expectedValue: 'hospital',
          validate: (conds) => {
            const ft = conds.find(c => c.field === 'facility_type');
            const orc = conds.find(c => c.field === 'orc_chapter');
            const ftOk = ft && (ft.value.toLowerCase().includes('hospital'));
            const orcOk = orc && (orc.value.includes('3702'));
            if (ftOk && orcOk) return { status: 'full', detail: `Both facility type and ORC chapter verified` };
            if (ftOk) return { status: 'partial', detail: `Facility type checked but no condition validates ORC Chapter 3702 citation` };
            if (orcOk) return { status: 'partial', detail: `ORC chapter checked but no condition confirms facility type is "hospital"` };
            return { status: 'missing', detail: 'No conditions validate facility type or statutory authority' };
          }
        }
      ]
    },
    'OH-002': {
      sourceText: 'The hospital shall be duly licensed and maintain accreditation from a recognized national accrediting body. Annual inspections by the state licensing authority are required for continued operation.',
      requirements: [
        {
          id: 'req-1', policyPhrase: 'shall be duly licensed',
          description: 'Active license required',
          expectedField: 'licensed', expectedOp: '=', expectedValue: 'true',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'licensed');
            if (!c) return { status: 'missing', detail: 'No condition checks licensure' };
            if (c.value === 'true') return { status: 'full', detail: `Covered: ${c.field} = ${c.value}` };
            return { status: 'partial', detail: `Field exists but value "${c.value}" doesn't confirm licensure` };
          }
        },
        {
          id: 'req-2', policyPhrase: 'maintain accreditation from a recognized national accrediting body',
          description: 'Must have current accreditation (e.g., Joint Commission, DNV, HFAP)',
          expectedField: 'accreditation_body', expectedOp: '!=', expectedValue: '',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'accreditation_body');
            if (!c) return { status: 'missing', detail: 'No condition validates accreditation body' };
            if (c.operator === '=' && c.value) return { status: 'full', detail: `Covered: requires ${c.value}` };
            if (c.operator === '!=' && c.value === '') return { status: 'full', detail: `Covered: ensures accreditation is not empty` };
            return { status: 'partial', detail: `Condition exists but may not adequately validate accreditation` };
          }
        },
        {
          id: 'req-3', policyPhrase: 'Annual inspections by the state licensing authority',
          description: 'Most recent inspection must be within 12 months',
          expectedField: 'inspection_date', expectedOp: '>=', expectedValue: '(rolling 12-month)',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'inspection_date');
            if (!c) return { status: 'missing', detail: 'No condition checks inspection recency. A facility could have a years-old inspection on record.' };
            if (c.operator === '>=' || c.operator === '>') return { status: 'full', detail: `Covered: inspection_date ${c.operator} ${c.value}. Verify the date threshold is within 12 months.` };
            if (c.operator === '=') return { status: 'partial', detail: `Exact date match is too rigid for an annual requirement. Use >= with a rolling date.` };
            return { status: 'partial', detail: `Operator "${c.operator}" may not correctly enforce annual requirement` };
          }
        },
        {
          id: 'req-4', policyPhrase: 'continued operation',
          description: 'License status must be active (not suspended/revoked/expired)',
          expectedField: 'license_status', expectedOp: '=', expectedValue: 'active',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'license_status');
            if (!c) return { status: 'missing', detail: 'No condition validates license is in active status. A licensed facility could have a suspended license.' };
            if (c.value.toLowerCase() === 'active') return { status: 'full', detail: `Covered: ${c.field} = ${c.value}` };
            return { status: 'partial', detail: `Status value "${c.value}" may not correctly validate active operation` };
          }
        }
      ]
    },
    'OH-003': {
      sourceText: 'The facility must demonstrate emergency department capability with adequate physician and nursing staff coverage at all times. Minimum nursing ratio of 1.5 FTE per patient for acute care settings.',
      requirements: [
        {
          id: 'req-1', policyPhrase: 'emergency department capability',
          description: 'Facility must have an operational ED',
          expectedField: 'emergency_capable', expectedOp: '=', expectedValue: 'true',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'emergency_capable');
            if (!c) return { status: 'missing', detail: 'No condition checks emergency department capability' };
            if (c.value === 'true') return { status: 'full', detail: `Covered: ${c.field} = ${c.value}` };
            return { status: 'partial', detail: `Value "${c.value}" doesn't confirm ED capability` };
          }
        },
        {
          id: 'req-2', policyPhrase: 'adequate physician staff coverage',
          description: '24-hour physician availability required',
          expectedField: 'physician_coverage', expectedOp: '=', expectedValue: 'true',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'physician_coverage');
            if (!c) return { status: 'missing', detail: 'No condition validates physician coverage. Policy explicitly requires physician staffing.' };
            return { status: 'full', detail: `Covered: ${c.field} ${c.operator} ${c.value}` };
          }
        },
        {
          id: 'req-3', policyPhrase: 'nursing staff coverage — minimum 1.5 FTE per patient',
          description: 'Nurse-to-patient ratio must be >= 1.5',
          expectedField: 'staff_ratio', expectedOp: '>=', expectedValue: '1.5',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'staff_ratio');
            if (!c) return { status: 'missing', detail: 'No condition checks nursing ratio. Policy specifies minimum 1.5 FTE.' };
            if ((c.operator === '>=' || c.operator === '>') && parseFloat(c.value) <= 1.5) return { status: 'full', detail: `Covered: ${c.field} ${c.operator} ${c.value}` };
            if ((c.operator === '>=' || c.operator === '>') && parseFloat(c.value) > 1.5) return { status: 'partial', detail: `Threshold ${c.value} is stricter than the policy minimum of 1.5. This may reject compliant facilities.` };
            if (c.operator === '=' ) return { status: 'partial', detail: `Exact match "=" is too restrictive. Policy says "minimum" which means >=` };
            return { status: 'partial', detail: `Operator "${c.operator}" doesn't match the minimum requirement (>=)` };
          }
        },
        {
          id: 'req-4', policyPhrase: 'at all times',
          description: 'Coverage must be 24/7 — not just business hours',
          expectedField: 'coverage_hours', expectedOp: '=', expectedValue: '24/7',
          validate: (conds) => {
            const c = conds.find(c => c.field === 'coverage_hours');
            if (!c) return { status: 'missing', detail: 'No condition enforces 24/7 coverage. "At all times" means the ratio must apply around the clock, not just during day shifts.' };
            return { status: 'full', detail: `Covered: ${c.field} ${c.operator} ${c.value}` };
          }
        }
      ]
    }
  };

  // Generic fallback — analyzes conditions against rule description/text
  const policy = policyRequirements[rule.rule_id] || cbBuildGenericPolicy(rule, accepted);

  // Run validation
  const results = policy.requirements.map(req => {
    const result = req.validate(accepted);
    return { ...req, ...result };
  });

  const fullCount = results.filter(r => r.status === 'full').length;
  const partialCount = results.filter(r => r.status === 'partial').length;
  const missingCount = results.filter(r => r.status === 'missing').length;
  const totalReqs = results.length;
  // Score: full = 1, partial = 0.5, missing = 0
  const score = totalReqs > 0 ? Math.round(((fullCount + partialCount * 0.5) / totalReqs) * 100) : 0;
  const barColor = score >= 80 ? '#2E844A' : score >= 50 ? '#DD7A01' : '#BA0517';

  let html = `<div style="font-size:11px;font-weight:700;color:var(--slds-navy);margin-bottom:10px;text-transform:uppercase;">Policy Coverage Analysis</div>`;
  html += `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Verifying that configured conditions fully implement the source policy requirements.</div>`;

  // Score bar
  html += `<div class="cb-coverage">
    <div class="cb-coverage-label"><span>Policy Coverage Score</span><span style="font-weight:700;color:${barColor};">${score}%</span></div>
    <div class="cb-coverage-bar"><div class="cb-coverage-fill" style="width:${score}%;background:${barColor};"></div></div>
    <div class="cb-coverage-label">
      <span><span style="color:#2E844A;font-weight:700;">${fullCount}</span> covered · <span style="color:#DD7A01;font-weight:700;">${partialCount}</span> partial · <span style="color:var(--slds-error);font-weight:700;">${missingCount}</span> missing</span>
      <span>${totalReqs} requirements</span>
    </div>
  </div>`;

  // Source text (if available)
  if (policy.sourceText) {
    html += `<div style="font-size:11px;font-weight:700;color:var(--slds-navy);margin:16px 0 6px;text-transform:uppercase;">Source Policy Text</div>`;
    // Highlight phrases in source text
    let annotated = policy.sourceText;
    results.forEach(r => {
      const phrase = r.policyPhrase;
      const color = r.status === 'full' ? 'rgba(46,132,74,0.15)' : r.status === 'partial' ? 'rgba(221,122,1,0.15)' : 'rgba(186,5,23,0.1)';
      const border = r.status === 'full' ? '2px solid #2E844A' : r.status === 'partial' ? '2px solid #DD7A01' : '2px dashed #BA0517';
      const icon = r.status === 'full' ? '✅' : r.status === 'partial' ? '⚠️' : '❌';
      // Try to find and highlight the phrase in source text
      const idx = annotated.toLowerCase().indexOf(phrase.toLowerCase().substring(0, 20));
      if (idx >= 0) {
        // Find end of the actual phrase region (approximate)
        const end = Math.min(idx + phrase.length + 10, annotated.length);
        const matchText = annotated.substring(idx, end).split(/[.;,]/).shift();
        annotated = annotated.substring(0, idx) +
          `<span style="background:${color};padding:1px 3px;border-radius:2px;border-bottom:${border};cursor:help;" title="${r.detail}">${icon} ${matchText}</span>` +
          annotated.substring(idx + matchText.length);
      }
    });
    html += `<div style="font-size:12px;line-height:1.9;color:var(--text);background:#fff;padding:12px;border-radius:4px;border:1px solid var(--slds-border);">${annotated}</div>`;
  }

  // Requirement-by-requirement breakdown
  html += `<div style="font-size:11px;font-weight:700;color:var(--slds-navy);margin:16px 0 8px;text-transform:uppercase;">Requirement Validation</div>`;

  results.forEach((r, i) => {
    const statusIcon = r.status === 'full' ? '✅' : r.status === 'partial' ? '⚠️' : '❌';
    const statusLabel = r.status === 'full' ? 'Covered' : r.status === 'partial' ? 'Partial' : 'Missing';
    const statusColor = r.status === 'full' ? '#2E844A' : r.status === 'partial' ? '#DD7A01' : 'var(--slds-error)';
    const borderColor = r.status === 'full' ? '#2E844A' : r.status === 'partial' ? '#DD7A01' : '#BA0517';

    html += `<div style="padding:10px 12px;background:#fff;border:1px solid var(--slds-border);border-left:3px solid ${borderColor};border-radius:4px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div style="font-size:12px;font-weight:700;color:var(--slds-navy);flex:1;">${statusIcon} ${r.description}</div>
        <span style="font-size:10px;font-weight:700;color:${statusColor};padding:2px 8px;border-radius:10px;background:${r.status === 'full' ? 'rgba(46,132,74,0.1)' : r.status === 'partial' ? 'rgba(221,122,1,0.1)' : 'rgba(186,5,23,0.08)'};">${statusLabel}</span>
      </div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;font-style:italic;">Policy: "${r.policyPhrase}"</div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">Expected: <strong>${r.expectedField}</strong> ${r.expectedOp} <strong>${r.expectedValue}</strong></div>
      <div style="font-size:12px;color:var(--text);line-height:1.5;">${r.detail}</div>
    </div>`;
  });

  // Conditions with no matching requirement (over-coverage)
  const coveredFields = new Set(policy.requirements.map(r => r.expectedField));
  const extraConditions = accepted.filter(c => !coveredFields.has(c.field));
  if (extraConditions.length > 0) {
    html += `<div style="margin-top:12px;padding:10px 12px;background:rgba(1,118,211,0.05);border:1px solid rgba(1,118,211,0.15);border-radius:4px;">
      <div style="font-size:11px;font-weight:700;color:var(--slds-blue);margin-bottom:6px;">ℹ️ Additional Conditions (not in source policy)</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">These conditions don't map to a specific source policy phrase. They may be valid business rules or may need review.</div>
      ${extraConditions.map(c => `<div style="font-size:12px;color:var(--text);margin-bottom:3px;">• <strong>${c.field}</strong> ${c.operator} ${c.value}</div>`).join('')}
    </div>`;
  }

  container.innerHTML = html;
}

// Build generic policy analysis for rules without explicit mappings
function cbBuildGenericPolicy(rule, accepted) {
  const ruleText = rule.rule_text || rule.description || rule.name || '';
  const requirements = [];

  // Extract numeric thresholds from rule text (e.g., "at least 25", "minimum 30", "not less than 10")
  const numPatterns = [
    { regex: /(?:at least|minimum|not less than|no fewer than|>=?)\s*(\d+)\s*([\w\s]+?)(?:\.|,|and|$)/gi, op: '>=' },
    { regex: /(?:no more than|maximum|not (?:to )?exceed|at most|<=?)\s*(\d+)\s*([\w\s]+?)(?:\.|,|and|$)/gi, op: '<=' },
    { regex: /(?:exactly|equal to|must be)\s*(\d+)\s*([\w\s]+?)(?:\.|,|and|$)/gi, op: '=' }
  ];

  numPatterns.forEach(pat => {
    let match;
    while ((match = pat.regex.exec(ruleText)) !== null) {
      const value = match[1];
      const context = match[2].trim().toLowerCase();
      // Try to match context to a known field
      const fields = CB_FIELDS[currentProgram] || CB_FIELDS['hosp-licensing'];
      const guessedField = fields.find(f =>
        context.includes(f.value.replace(/_/g, ' ')) ||
        f.label.toLowerCase().split(' ').some(w => context.includes(w))
      );
      const fieldName = guessedField ? guessedField.value : context.replace(/\s+/g, '_').substring(0, 30);
      requirements.push({
        id: `gen-${requirements.length}`,
        policyPhrase: match[0].trim(),
        description: `${pat.op === '>=' ? 'Minimum' : pat.op === '<=' ? 'Maximum' : 'Exact'} ${value} for ${guessedField ? guessedField.label : context}`,
        expectedField: fieldName, expectedOp: pat.op, expectedValue: value,
        validate: (conds) => {
          const c = conds.find(c => c.field === fieldName);
          if (!c) return { status: 'missing', detail: `No condition found for "${fieldName}". Policy states: "${match[0].trim()}"` };
          if (c.operator === pat.op && c.value === value) return { status: 'full', detail: `Covered: ${c.field} ${c.operator} ${c.value}` };
          if (c.field === fieldName) return { status: 'partial', detail: `Field exists but condition uses "${c.operator} ${c.value}" instead of expected "${pat.op} ${value}"` };
          return { status: 'partial', detail: `Condition exists but may not fully match policy intent` };
        }
      });
    }
  });

  // Extract boolean requirements (e.g., "must be licensed", "shall maintain", "is required")
  const boolPatterns = /(?:must|shall|is required to|needs to)\s+(?:be\s+|have\s+|maintain\s+)?([\w\s]+?)(?:\.|,|and\s|under\s|by\s|from\s|$)/gi;
  let bMatch;
  while ((bMatch = boolPatterns.exec(ruleText)) !== null) {
    const concept = bMatch[1].trim().toLowerCase();
    if (concept.length < 3 || concept.length > 40) continue;
    const fields = CB_FIELDS[currentProgram] || CB_FIELDS['hosp-licensing'];
    const guessedField = fields.find(f =>
      concept.includes(f.value.replace(/_/g, ' ')) ||
      concept.includes(f.label.toLowerCase()) ||
      f.label.toLowerCase().split(' ').some(w => w.length > 3 && concept.includes(w))
    );
    if (guessedField && !requirements.find(r => r.expectedField === guessedField.value)) {
      requirements.push({
        id: `gen-${requirements.length}`,
        policyPhrase: bMatch[0].trim(),
        description: `${guessedField.label} is required`,
        expectedField: guessedField.value, expectedOp: '=', expectedValue: guessedField.type === 'boolean' ? 'true' : '(any value)',
        validate: (conds) => {
          const c = conds.find(c => c.field === guessedField.value);
          if (!c) return { status: 'missing', detail: `No condition found for "${guessedField.label}". Policy states: "${bMatch[0].trim()}"` };
          return { status: 'full', detail: `Covered: ${c.field} ${c.operator} ${c.value}` };
        }
      });
    }
  }

  // If no requirements extracted, create a generic notice
  if (requirements.length === 0) {
    requirements.push({
      id: 'gen-notice',
      policyPhrase: '(full source text not available for automated analysis)',
      description: 'Manual review required — source text could not be parsed',
      expectedField: 'N/A', expectedOp: 'N/A', expectedValue: 'N/A',
      validate: () => ({ status: 'partial', detail: 'Automated analysis requires source policy text. Please verify conditions manually against the regulatory source.' })
    });
  }

  return {
    sourceText: ruleText || null,
    requirements
  };
}

// ══════════════════════════════════════════════════════════════
// ██  END CONDITION BUILDER                                  ██
// ══════════════════════════════════════════════════════════════

