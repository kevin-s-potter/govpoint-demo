#!/usr/bin/env node
/**
 * fetch_source_text.js
 *
 * Fetches real statutory text for each rule from government websites and
 * writes it back to the `source_text` column in Supabase via REST API.
 *
 * Sources by citation type:
 *   - CFR (7/42/45/29/40 CFR)  → eCFR.gov renderer API (part-level cache)
 *   - U.S.C.                    → uscode.house.gov
 *   - ORC §xxxx.xx              → codes.ohio.gov (full-page text extraction)
 *   - OAC §xxxx:x-xx-xx         → codes.ohio.gov
 *   - MCL xxx.xxxx              → legislature.mi.gov
 *   - 902 KAR xx:xxx            → apps.legislature.ky.gov
 *   - KRS xxx.xxx               → apps.legislature.ky.gov
 *   - Proprietary/policy        → meaningful fallback message
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL  = 'https://fshdlcveidwwufdigekh.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzaGRsY3ZlaWR3d3VmZGlnZWtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI2ODM5OCwiZXhwIjoyMDg4ODQ0Mzk4fQ.OPaz8JhFkj4IKAebBGAXfSwyFSyIA7BVlwug19iGNZ0';
const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzaGRsY3ZlaWR3d3VmZGlnZWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjgzOTgsImV4cCI6MjA4ODg0NDM5OH0.2x-ipiRpBCphclHyXb0bD98WwA392jOfd-8tuAOc2CY';

const BATCH_SIZE     = 5;
const BATCH_DELAY_MS = 400;
const FETCH_HEADERS  = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };

// ─── Text helpers ─────────────────────────────────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').replace(/&[a-z]+;/g, '')
    .replace(/\s{2,}/g, ' ').trim();
}

function truncate(text, maxChars = 1200) {
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf(' ', maxChars);
  return text.slice(0, cut > 0 ? cut : maxChars) + '…';
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function getAllRules() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rules?select=rule_id,program_id,citation,jurisdiction,name,description&order=program_id,rule_id`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  );
  if (!res.ok) throw new Error(`Fetch rules failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function patchSourceText(ruleId, sourceText) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rules?rule_id=eq.${encodeURIComponent(ruleId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ source_text: sourceText }),
    }
  );
  if (!res.ok) throw new Error(`PATCH ${ruleId} failed: ${res.status} ${await res.text()}`);
}

// ─── eCFR part cache ──────────────────────────────────────────────────────────

const ecfrCache = new Map(); // "title:part" → html string

async function getECFRPart(title, part) {
  const key = `${title}:${part}`;
  if (ecfrCache.has(key)) return ecfrCache.get(key);
  const url = `https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-${title}?part=${part}`;
  try {
    const res = await fetch(url, { redirect: 'follow', headers: FETCH_HEADERS });
    if (!res.ok) { ecfrCache.set(key, null); return null; }
    const html = await res.text();
    ecfrCache.set(key, html);
    return html;
  } catch { ecfrCache.set(key, null); return null; }
}

// ─── Citation parsers ─────────────────────────────────────────────────────────

function parseCFR(c) {
  const m = c.match(/(\d+)\s+(?:CFR|C\.F\.R\.)\s+§?\s*(\d+)\.(\d+)/i);
  return m ? { title: m[1], part: m[2], section: `${m[2]}.${m[3]}` } : null;
}

function parseUSC(c) {
  const m = c.match(/(\d+)\s+U\.S\.C\.?\s+§?\s*([\d\w]+)/i);
  return m ? { title: m[1], section: m[2].replace(/[()a-z]/gi, '') } : null;
}

function parseORC(c) {
  const m = c.match(/ORC\s+§?\s*([\d]+\.[\d]+)/i);
  return m ? { section: m[1] } : null;
}

function parseOAC(c) {
  const m = c.match(/OAC\s+§?\s*([\d:]+(?:-\d+){2,})/i);
  return m ? { rule: m[1] } : null;
}

function parseMCL(c) {
  const m = c.match(/MCL\s+([\d]+)\.([\d]+)/i);
  return m ? { act: m[1], section: m[2] } : null;
}

function parseKAR(c) {
  const m = c.match(/(\d+)\s+KAR\s+(\d+):(\d+)/i);
  return m ? {
    chapter: String(m[1]).padStart(3, '0'),
    title: String(m[2]).padStart(3, '0'),
    reg: String(parseInt(m[3])).padStart(3, '0'),
  } : null;
}

function parseKRS(c) {
  const m = c.match(/KRS\s+([\d]+[A-Z]?)\.(\d+)/i);
  return m ? { chapter: m[1], section: m[2] } : null;
}

// ─── Source fetchers ──────────────────────────────────────────────────────────

async function fetchECFR(cfr) {
  const html = await getECFRPart(cfr.title, cfr.part);
  if (!html) return null;
  const sectionId = cfr.section;                          // e.g. "273.2"
  const startTag  = `id="${sectionId}"`;
  const startIdx  = html.indexOf(startTag);
  if (startIdx === -1) return null;

  // Skip past the end of the opening tag so id="..." never bleeds into text
  const tagClose  = html.indexOf('>', startIdx);
  const textStart = tagClose !== -1 ? tagClose + 1 : startIdx + startTag.length;

  // Find where the next section begins so we don't bleed into it
  const [partStr, numStr] = sectionId.split('.');
  const nextId   = `id="${partStr}.${parseInt(numStr) + 1}"`;
  const endIdx   = html.indexOf(nextId, startIdx + 1);
  const sectionHtml = html.slice(textStart, endIdx > textStart ? endIdx : textStart + 5000);
  const text = stripHtml(sectionHtml);
  return text.length > 60 ? truncate(text) : null;
}

async function fetchUSC(usc) {
  const url = `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${usc.title}-section${usc.section}&num=0&edition=prelim`;
  try {
    const res = await fetch(url, { redirect: 'follow', headers: FETCH_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<div[^>]+class="[^"]*statute[^"]*"[^>]*>([\s\S]{100,6000}?)<\/div>/i);
    return m ? truncate(stripHtml(m[1])) : null;
  } catch { return null; }
}

const NAV_MARKERS = ['Skip to main content', 'Ohio Laws Skip', 'Ohio Administrative Code | Ohio Laws',
                     'Keywords Section Number', 'Go To Section'];

async function fetchOhio(url, sectionLabel) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: FETCH_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();

    // Try to find actual statute content — avoid navigation/chrome
    for (const pattern of [
      // codes.ohio.gov wraps statute body in a div with class containing "content" after the breadcrumb
      /<div[^>]+class="[^"]*statute[^"]*"[^>]*>([\s\S]{100,6000}?)<\/div>/i,
      /<div[^>]+class="[^"]*law[^"]*text[^"]*"[^>]*>([\s\S]{100,6000}?)<\/div>/i,
      // Lawriter-style: section text between headings
      /<p[^>]*class="[^"]*lawtext[^"]*"[^>]*>([\s\S]{100,4000}?)<\/p>/i,
      /<article[^>]*>([\s\S]{300,6000}?)<\/article>/i,
      /<main[^>]*>([\s\S]{300,8000}?)<\/main>/i,
    ]) {
      const m = html.match(pattern);
      if (m) {
        const text = stripHtml(m[1]);
        // Reject if it contains nav boilerplate
        if (text.length > 100 && !NAV_MARKERS.some(nav => text.includes(nav))) {
          return truncate(text);
        }
      }
    }
    return null;   // Do NOT fall back to full-page text — it produces nav garbage
  } catch { return null; }
}

async function fetchORC(orc) {
  return fetchOhio(
    `https://codes.ohio.gov/ohio-revised-code/section-${orc.section}`,
    orc.section
  );
}

async function fetchOAC(oac) {
  return fetchOhio(
    `https://codes.ohio.gov/ohio-administrative-code/rule-${oac.rule}`,
    oac.rule
  );
}

async function fetchMCL(mcl) {
  const url = `https://www.legislature.mi.gov/Laws/MCL?objectName=MCL-${mcl.act}-${mcl.section}`;
  try {
    const res = await fetch(url, { redirect: 'follow', headers: FETCH_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();
    for (const pattern of [
      /<div[^>]+class="[^"]*lawtext[^"]*"[^>]*>([\s\S]{100,6000}?)<\/div>/i,
      /<div[^>]+class="[^"]*law[^"]*"[^>]*>([\s\S]{100,6000}?)<\/div>/i,
      /<main[^>]*>([\s\S]{200,8000}?)<\/main>/i,
    ]) {
      const m = html.match(pattern);
      if (m) {
        const text = stripHtml(m[1]);
        if (text.length > 100) return truncate(text);
      }
    }
    const fullText = stripHtml(html);
    const idx = fullText.indexOf(`${mcl.act}.${mcl.section}`);
    if (idx !== -1) return truncate(fullText.slice(idx, idx + 1500));
    return null;
  } catch { return null; }
}

async function fetchKAR(kar) {
  const url = `https://apps.legislature.ky.gov/law/kar/titles/${kar.chapter}/${kar.title}/${kar.reg}/.htm`;
  try {
    const res = await fetch(url, { redirect: 'follow', headers: FETCH_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<body[^>]*>([\s\S]+)<\/body>/i);
    return m ? truncate(stripHtml(m[1])) : null;
  } catch { return null; }
}

async function fetchKRS(krs) {
  const url = `https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=${krs.chapter}.${krs.section}`;
  try {
    const res = await fetch(url, { redirect: 'follow', headers: FETCH_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();
    for (const pattern of [
      /<div[^>]+class="[^"]*statute[^"]*"[^>]*>([\s\S]{100,6000}?)<\/div>/i,
      /<div[^>]+id="[^"]*content[^"]*"[^>]*>([\s\S]{200,6000}?)<\/div>/i,
      /<body[^>]*>([\s\S]+)<\/body>/i,
    ]) {
      const m = html.match(pattern);
      if (m) {
        const text = stripHtml(m[1]);
        if (text.length > 100) return truncate(text);
      }
    }
    return null;
  } catch { return null; }
}

// ─── Fallback text ────────────────────────────────────────────────────────────

const PROPRIETARY = ['NFPA', 'IBC', 'IRC', 'IPC', 'IMC', 'ASHRAE', 'ANSI', 'UL '];
const INTERNAL    = ['ODJFS Policy', 'LARA Fee', 'LARA Form', 'LARA Online', 'LARA Enforcement',
                     'Industry practice', 'local ordinance', 'Local ordinance'];

function buildFallback(rule) {
  const cit = rule.citation;
  if (PROPRIETARY.some(s => cit.includes(s)))
    return `This requirement is governed by ${cit}, a proprietary standard. Full text requires a licensed copy. Rule: ${rule.name}. ${rule.description}`;
  if (INTERNAL.some(s => cit.includes(s)))
    return `This rule is governed by internal agency policy (${cit}). Contact the administering agency for the full policy text. Rule: ${rule.name}. ${rule.description}`;
  return `Statutory text for ${cit} is not available from public sources. Rule: ${rule.name}. ${rule.description}`;
}

function isFallback(citation) {
  return PROPRIETARY.some(s => citation.includes(s)) || INTERNAL.some(s => citation.includes(s));
}

// ─── Main router ──────────────────────────────────────────────────────────────

async function resolveRule(rule) {
  const c = rule.citation || '';
  if (isFallback(c)) return { text: buildFallback(rule), source: 'fallback' };

  const cfr = parseCFR(c);
  if (cfr) {
    const text = await fetchECFR(cfr);
    if (text) return { text, source: `eCFR ${cfr.title}CFR§${cfr.section}` };
  }

  const usc = parseUSC(c);
  if (usc && !cfr) {
    const text = await fetchUSC(usc);
    if (text) return { text, source: `USC §${usc.title}USC${usc.section}` };
  }

  const orc = parseORC(c);
  if (orc) {
    const text = await fetchORC(orc);
    if (text) return { text, source: `ORC §${orc.section}` };
  }

  const oac = parseOAC(c);
  if (oac) {
    const text = await fetchOAC(oac);
    if (text) return { text, source: `OAC §${oac.rule}` };
  }

  const mcl = parseMCL(c);
  if (mcl) {
    const text = await fetchMCL(mcl);
    if (text) return { text, source: `MCL ${mcl.act}.${mcl.section}` };
  }

  const kar = parseKAR(c);
  if (kar) {
    const text = await fetchKAR(kar);
    if (text) return { text, source: `KAR ${kar.chapter}:${kar.reg}` };
  }

  const krs = parseKRS(c);
  if (krs) {
    const text = await fetchKRS(krs);
    if (text) return { text, source: `KRS ${krs.chapter}.${krs.section}` };
  }

  return { text: buildFallback(rule), source: 'fallback' };
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Pass --retry to only re-process rules that currently have fallback/nav text
  const retryOnly = process.argv.includes('--retry');
  console.log(`Fetching rules from Supabase… ${retryOnly ? '(--retry mode: fallback rules only)' : ''}`);
  let rules = await getAllRules();
  if (retryOnly) {
    // Fetch current source_text to identify fallback candidates
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rules?select=rule_id,source_text&order=rule_id`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    const current = await res.json();
    const fallbackIds = new Set(
      current
        .filter(r => !r.source_text
          || r.source_text.startsWith('Statutory text')
          || r.source_text.startsWith('This rule is')
          || r.source_text.startsWith('This requirement is'))
        .map(r => r.rule_id)
    );
    rules = rules.filter(r => fallbackIds.has(r.rule_id));
    console.log(`  → ${rules.length} rules to retry`);
  }
  console.log(`${rules.length} rules. Batches of ${BATCH_SIZE}, ~${Math.ceil(rules.length/BATCH_SIZE)} rounds.\n`);

  const results = [];
  let realCount = 0;

  for (let i = 0; i < rules.length; i += BATCH_SIZE) {
    const batch = rules.slice(i, i + BATCH_SIZE);
    const prog = `[${String(i+1).padStart(3)}–${String(Math.min(i+BATCH_SIZE,rules.length)).padStart(3)}]`;

    const batchResults = await Promise.all(batch.map(async rule => {
      try {
        const { text, source } = await resolveRule(rule);
        await patchSourceText(rule.rule_id, text);
        const isReal = source !== 'fallback';
        if (isReal) realCount++;
        const icon = isReal ? '✓' : '~';
        const preview = text.slice(0, 65).replace(/\n/g, ' ');
        console.log(`  ${icon} ${rule.rule_id.padEnd(20)} [${source.slice(0,22).padEnd(22)}] "${preview}…"`);
        return { rule_id: rule.rule_id, source, ok: isReal };
      } catch (err) {
        console.error(`  ✗ ${rule.rule_id} — ${err.message}`);
        return { rule_id: rule.rule_id, source: 'error', ok: false };
      }
    }));

    console.log(`${prog} done  (real so far: ${realCount})`);
    results.push(...batchResults);
    if (i + BATCH_SIZE < rules.length) await sleep(BATCH_DELAY_MS);
  }

  // Write JSON log
  const logPath = resolve(process.cwd(), 'scripts/source_text_results.json');
  writeFileSync(logPath, JSON.stringify(results, null, 2));

  // Summary by source type
  const bySrc = {};
  for (const r of results) {
    const key = r.source.startsWith('eCFR') ? 'eCFR'
              : r.source.startsWith('ORC') ? 'ORC'
              : r.source.startsWith('OAC') ? 'OAC'
              : r.source.startsWith('MCL') ? 'MCL'
              : r.source.startsWith('KAR') ? 'KAR'
              : r.source.startsWith('KRS') ? 'KRS'
              : r.source.startsWith('USC') ? 'USC'
              : r.source;
    bySrc[key] = (bySrc[key] || 0) + 1;
  }

  const errors = results.filter(r => r.source === 'error');
  console.log('\n════════ Summary ════════');
  console.log(`✓ Real text:  ${realCount}/${rules.length}`);
  console.log(`~ Fallback:   ${results.length - realCount - errors.length}/${rules.length}`);
  if (errors.length) console.log(`✗ Errors:     ${errors.length} — ${errors.map(e=>e.rule_id).join(', ')}`);
  console.log('By source:');
  for (const [src, n] of Object.entries(bySrc).sort((a,b)=>b[1]-a[1]))
    console.log(`  ${String(n).padStart(3)}  ${src}`);
  console.log(`\nLog: ${logPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
