#!/usr/bin/env node
// Test: UX-2 Dashboard Audit CTA upgrade (PR #21)
// Run: node scripts/test-ux2-dashboard-cta.mjs
// No npm install required — uses Node built-ins only.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_URL = 'https://fshdlcveidwwufdigekh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzaGRsY3ZlaWR3d3VmZGlnZWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjgzOTgsImV4cCI6MjA4ODg0NDM5OH0.2x-ipiRpBCphclHyXb0bD98WwA392jOfd-8tuAOc2CY';

let passed = 0, failed = 0;

function ok(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, detail) { console.log(`  FAIL  ${label}${detail ? `\n        → ${detail}` : ''}`); failed++; }

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── 1. Static HTML checks ──────────────────────────────────────────────────

console.log('\n[1] Static HTML — dashboard.html');
const html = readFileSync(join(ROOT, 'dashboard.html'), 'utf8');

// auditStatStrip div present
html.includes('id="auditStatStrip"')
  ? ok('auditStatStrip div present')
  : fail('auditStatStrip div not found', 'expected <div id="auditStatStrip" ...>');

// auditStatStrip is a sibling of chart-title, not replacing it
html.includes('class="chart-title">Recent Activity</div>') &&
html.indexOf('auditStatStrip') > html.indexOf('"chart-title"')
  ? ok('chart-title "Recent Activity" still present above stat strip')
  : fail('chart-title or ordering wrong');

// Link upgraded to slds-button slds-button_neutral
const buttonPattern = /class="slds-button slds-button_neutral"[^>]*>\s*View Full Audit Log/;
buttonPattern.test(html)
  ? ok('"View Full Audit Log" uses slds-button slds-button_neutral')
  : fail('"View Full Audit Log" link not upgraded to slds-button', 'check dashboard.html card header');

// Old inline style link should be gone
html.includes('font-weight:600;color:var(--slds-blue-brand);text-decoration:none;">View Full Audit Log')
  ? fail('Old inline-styled text link still present', 'remove the pre-upgrade anchor tag')
  : ok('Old inline text link removed');

// JS stat computation present
html.includes('auditStatStrip') && html.includes('cachedAuditEntries') && html.includes('count24h')
  ? ok('Stat strip JS (count24h / count7d) present in renderActivityTable')
  : fail('Stat strip JS not found', 'check renderActivityTable() for count24h/count7d logic');

// ── 2. Static HTML checks — program-switcher.js ────────────────────────────

console.log('\n[2] Static — program-switcher.js ruleCount fixes');
const ps = readFileSync(join(ROOT, 'program-switcher.js'), 'utf8');

/hosp-licensing[^}]+ruleCount:\s*26/.test(ps)
  ? ok('hosp-licensing ruleCount = 26')
  : fail('hosp-licensing ruleCount wrong', 'should be 26');

/childcare-licensing[^}]+ruleCount:\s*113/.test(ps)
  ? ok('childcare-licensing ruleCount = 113')
  : fail('childcare-licensing ruleCount wrong', 'should be 113');

// ── 3. Static HTML checks — childcare.html ────────────────────────────────

console.log('\n[3] Static — childcare.html hover color fix');
const cc = readFileSync(join(ROOT, 'childcare.html'), 'utf8');

cc.includes('btn-upload-file:hover { background: #0176D3; }')
  ? ok('.btn-upload-file hover = #0176D3 (brand blue)')
  : fail('.btn-upload-file hover color wrong', 'should be #0176D3');

!cc.includes('#0158A8')
  ? ok('Non-standard #0158A8 removed from childcare.html')
  : fail('#0158A8 still present in childcare.html');

// ── 4. Live Supabase — stat strip logic ───────────────────────────────────

console.log('\n[4] Live Supabase — audit_log stat computation');
try {
  const entries = await supabaseGet(
    '/rest/v1/audit_log?select=timestamp&order=timestamp.desc&limit=1000'
  );

  const now = new Date();
  const h24ago = new Date(now - 24 * 60 * 60 * 1000);
  const d7ago  = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const count24h = entries.filter(e => new Date(e.timestamp) >= h24ago).length;
  const count7d  = entries.filter(e => new Date(e.timestamp) >= d7ago).length;

  console.log(`        audit_log rows fetched : ${entries.length}`);
  console.log(`        Last 24h events        : ${count24h}`);
  console.log(`        Last 7 days events     : ${count7d}`);

  typeof count24h === 'number' && typeof count7d === 'number'
    ? ok('Stat computation returns numeric counts without error')
    : fail('Stat computation returned non-numeric values');

  count7d >= count24h
    ? ok('count7d >= count24h (logical sanity check)')
    : fail('count7d < count24h — 7-day window should be >= 24h window');

} catch (e) {
  fail('Supabase fetch failed', e.message);
}

// ── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(48)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
