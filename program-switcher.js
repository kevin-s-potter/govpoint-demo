// ── SHARED PROGRAM CONFIGURATION ─────────────────────────────────────────────
// Edit this file to add or move programs. Changes apply to all 4 pages.
//
// To add a program:
//   1. Add an entry to PROGRAM_CONFIG
//   2. Add a display label to PROGRAM_DETAIL_LABELS
//   3. Add the program ID to the correct group in TENANT_GROUPS
//   4. Run the corresponding SQL migration on Supabase

const PROGRAM_CONFIG = {
  'hosp-licensing':       { tenant: 'ohio-odh',      abbr: 'ODH',   name: 'Ohio Department of Health',                  programName: 'Hospital Licensing',            userId: 'user-001', ruleCount: 26,  evaluationTable: 'applications'       },
  'snap':                 { tenant: 'ohio-odjfs',    abbr: 'ODJFS', name: 'Ohio Dept of Job and Family Services',        programName: 'SNAP Benefits',                 userId: 'user-301', ruleCount: 183, evaluationTable: 'applications'       },
  'nursing-home':         { tenant: 'ky-chfs',       abbr: 'CHFS',  name: 'Kentucky CHFS',                              programName: 'Nursing Home Licensing',         userId: 'user-101', ruleCount: 8,   evaluationTable: 'applications'       },
  'contractor-licensing': { tenant: 'michigan-lara', abbr: 'LARA',  name: 'Michigan LARA Bureau of Construction Codes', programName: 'Contractor Licensing',          userId: 'user-201', ruleCount: 100, evaluationTable: 'applications'       },
  'childcare-licensing':  { tenant: 'ohio-odjfs',    abbr: 'ODJFS', name: 'Ohio Dept of Job and Family Services',       programName: 'Child Care Facility Licensing', userId: 'user-301', ruleCount: 113, evaluationTable: 'applications'       },
  'doggy-daycare':        { tenant: 'city-of-sunridge', abbr: 'DDC', name: 'City of Sunridge',                          programName: 'Doggy Day Care Grants',         userId: 'user-401', ruleCount: 20,  evaluationTable: 'grant_applications' }
};

const USER_DISPLAY = {
  'user-001': { name: 'Sarah Chen',        initials: 'SC', role: 'Publisher' },
  'user-101': { name: 'Maria Torres',      initials: 'MT', role: 'Publisher' },
  'user-201': { name: 'James Wilson',      initials: 'JW', role: 'Publisher' },
  'user-301': { name: 'Michelle Thompson', initials: 'MT', role: 'Publisher' },
  'user-401': { name: 'Jamie Rivera',      initials: 'JR', role: 'Grant Coordinator' }
};

// Controls dropdown section order and grouping.
// To move a program between agencies, change which group its ID appears in.
const TENANT_GROUPS = [
  { label: 'Ohio Department of Health', programs: ['hosp-licensing'] },
  { label: 'Ohio ODJFS',                programs: ['snap', 'childcare-licensing'] },
  { label: 'Kentucky CHFS',             programs: ['nursing-home'] },
  { label: 'Michigan LARA',             programs: ['contractor-licensing'] },
  { label: 'City of Sunridge',          programs: ['doggy-daycare'] },
];

// Detail line shown under each program name in the dropdown
const PROGRAM_DETAIL_LABELS = {
  'hosp-licensing':       'HEA-3614 · 26 rules',
  'snap':                 'SNAP-OH · 183 rules',
  'nursing-home':         'NH-902 · 8 rules',
  'contractor-licensing': 'MCL-339 · 100 rules',
  'childcare-licensing':  'ORC-5104 · 113 rules',
  'doggy-daycare':        'DDC · 20 rules',
};

// ── RENDER ────────────────────────────────────────────────────────────────────
// Call once at page init. Mount point: <div id="programSwitcherMount" class="tenant-switcher"></div>

function renderProgramSwitcher(activeProgram) {
  if (!document.getElementById('ps-styles')) {
    const style = document.createElement('style');
    style.id = 'ps-styles';
    style.textContent = `
      .tenant-switcher { position: relative; }
      .tenant-switcher-btn {
        background: transparent; color: #FFFFFF;
        border: 1px solid rgba(255,255,255,0.3); border-radius: 4px;
        padding: 6px 14px; font-size: 12px; font-weight: 600;
        cursor: pointer; display: flex; align-items: center; gap: 6px;
        transition: all 0.2s; font-family: inherit;
      }
      .tenant-switcher-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.5); }
      .tenant-switcher-dropdown {
        display: none; position: absolute; top: calc(100% + 6px); left: 0;
        background: #FFFFFF; border: 1px solid #E5E5E5;
        border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        min-width: 300px; z-index: 200; overflow: hidden;
      }
      .tenant-switcher-dropdown.show { display: block; }
      .ps-group-header {
        padding: 8px 16px; font-size: 10px; font-weight: 700; color: #54698D;
        text-transform: uppercase; letter-spacing: 0.5px;
        background: #F8F8F8; border-bottom: 1px solid #E5E5E5;
      }
      .tenant-option + .ps-group-header { border-top: 1px solid #E5E5E5; }
      .tenant-option {
        padding: 11px 16px; cursor: pointer; display: flex; align-items: center;
        gap: 12px; font-size: 13px; transition: background 0.15s;
      }
      .tenant-option:hover { background: #F3F3F3; }
      .tenant-option.active { background: #EBF4FF; font-weight: 600; }
      .tenant-option .tenant-check { width: 16px; color: #0176D3; font-weight: 700; }
      .tenant-option .tenant-info { flex: 1; }
      .tenant-option .tenant-name { color: #032D60; font-weight: 600; font-size: 13px; }
      .tenant-option .tenant-detail { font-size: 11px; color: #54698D; margin-top: 1px; }
    `;
    document.head.appendChild(style);
  }

  const cfg = PROGRAM_CONFIG[activeProgram];
  let html = `
    <button class="tenant-switcher-btn" onclick="document.querySelector('.tenant-switcher-dropdown').classList.toggle('show')">
      <span id="tenantLabel">${cfg.abbr} · ${cfg.programName}</span>
      <span style="font-size:9px;">&#9660;</span>
    </button>
    <div class="tenant-switcher-dropdown">`;

  for (const group of TENANT_GROUPS) {
    html += `\n      <div class="ps-group-header">${group.label}</div>`;
    for (const programId of group.programs) {
      const pc = PROGRAM_CONFIG[programId];
      const isActive = programId === activeProgram;
      html += `
      <div class="tenant-option${isActive ? ' active' : ''}" data-program="${programId}" onclick="switchProgram('${programId}')">
        <span class="tenant-check">${isActive ? '&#10003;' : ''}</span>
        <div class="tenant-info">
          <div class="tenant-name">${pc.programName}</div>
          <div class="tenant-detail">${PROGRAM_DETAIL_LABELS[programId]}</div>
        </div>
      </div>`;
    }
  }

  html += `\n    </div>`;

  const mount = document.getElementById('programSwitcherMount');
  if (mount) mount.innerHTML = html;

  if (!window._psSwitcherBound) {
    window._psSwitcherBound = true;
    document.addEventListener('click', e => {
      if (!e.target.closest('.tenant-switcher')) {
        document.querySelector('.tenant-switcher-dropdown')?.classList.remove('show');
      }
    });
  }
}

// ── UPDATE ────────────────────────────────────────────────────────────────────
// Call from each page's switchProgram() to sync the dropdown UI after a switch.

function updateSwitcherUI(programId) {
  const config = PROGRAM_CONFIG[programId];
  const el = document.getElementById('tenantLabel');
  if (el) el.textContent = `${config.abbr} · ${config.programName}`;
  document.querySelectorAll('.tenant-option').forEach(opt => {
    const active = opt.dataset.program === programId;
    opt.classList.toggle('active', active);
    opt.querySelector('.tenant-check').textContent = active ? '✓' : '';
  });
  document.querySelector('.tenant-switcher-dropdown')?.classList.remove('show');
}
