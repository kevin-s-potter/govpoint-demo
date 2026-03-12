/**
 * GovPoint Data API — Supabase Edition
 *
 * All data access for the GovPoint demo goes through this module.
 * Reads from a live Supabase PostgreSQL database via REST API.
 *
 * ARCHITECTURE:
 *   UI (ontology.html / index.html)
 *     ↓ calls
 *   api.js (this file)
 *     ↓ fetches from
 *   Supabase REST API → PostgreSQL
 */

const SUPABASE_URL = 'https://fshdlcveidwwufdigekh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzaGRsY3ZlaWR3d3VmZGlnZWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjgzOTgsImV4cCI6MjA4ODg0NDM5OH0.2x-ipiRpBCphclHyXb0bD98WwA392jOfd-8tuAOc2CY';

class GovPointAPI {
  constructor() {
    // Cache fetched data so we don't re-query on every click
    this._cache = {};
    this.ready = this._prefetch();
  }

  // ── SUPABASE FETCH HELPER ──────────────────────────────────
  async _query(table, params = '') {
    const cacheKey = `${table}?${params}`;
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      console.error(`[GovPoint API] ${table} query failed: ${res.status}`);
      return [];
    }

    const data = await res.json();
    this._cache[cacheKey] = data;
    return data;
  }

  // ── PREFETCH — Load core data on page load ─────────────────
  async _prefetch() {
    try {
      await Promise.all([
        this._query('rules', 'select=*&order=rule_id'),
        this._query('users', 'select=*'),
        this._query('programs', 'select=*'),
        this._query('user_roles', 'select=*'),
        this._query('rule_conditions', 'select=*&order=rule_id,"order"'),
        this._query('notifications', 'select=*&order=created_at.desc')
      ]);
      const rules = this._cache['rules?select=*&order=rule_id'] || [];
      console.log(`[GovPoint API] Connected to Supabase — loaded ${rules.length} rules`);
    } catch (e) {
      console.error('[GovPoint API] Prefetch failed:', e);
    }
    return this;
  }

  // Clear cache (call after writes)
  clearCache() { this._cache = {}; }

  // ── TENANT ──────────────────────────────────────────────────
  async getTenant(tenantId = 'ohio-odh') {
    const rows = await this._query('tenants', `select=*&tenant_id=eq.${tenantId}`);
    return rows[0] || null;
  }

  // ── PROGRAMS ────────────────────────────────────────────────
  async getPrograms(tenantId = 'ohio-odh') {
    return this._query('programs', `select=*&tenant_id=eq.${tenantId}`);
  }

  // ── USERS & ROLES ──────────────────────────────────────────
  async getUsers(tenantId = 'ohio-odh') {
    return this._query('users', `select=*&tenant_id=eq.${tenantId}`);
  }

  async getUser(userId) {
    const users = await this._query('users', 'select=*');
    return users.find(u => u.user_id === userId) || null;
  }

  async getUserRole(userId, programId) {
    const roles = await this._query('user_roles', 'select=*');
    const match = roles.find(r => r.user_id === userId && r.program_id === programId);
    return match?.role || null;
  }

  async getCurrentUser() {
    return this.getUser('user-001');
  }

  // ── RULES ──────────────────────────────────────────────────
  async getRules(programId = 'hosp-licensing') {
    const all = await this._query('rules', 'select=*&order=rule_id');
    return all.filter(r => r.program_id === programId);
  }

  async getRule(ruleId) {
    const all = await this._query('rules', 'select=*&order=rule_id');
    return all.find(r => r.rule_id === ruleId) || null;
  }

  async searchRules(query, programId = 'hosp-licensing') {
    const q = query.toLowerCase();
    const rules = await this.getRules(programId);
    return rules.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.rule_id.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.citation || '').toLowerCase().includes(q)
    );
  }

  // ── CONDITIONS ─────────────────────────────────────────────
  async getConditions(ruleId) {
    const all = await this._query('rule_conditions', 'select=*&order=rule_id,"order"');
    return all.filter(c => c.rule_id === ruleId).sort((a, b) => a.order - b.order);
  }

  // ── DEPENDENCIES ───────────────────────────────────────────
  async getDependencies(ruleId) {
    const deps = await this._query('rule_dependencies', 'select=*');
    const dependsOn = deps.filter(d => d.rule_id === ruleId);
    const dependedOnBy = deps.filter(d => d.depends_on === ruleId);

    // Enrich with rule names
    for (const d of dependsOn) {
      d.targetRule = await this.getRule(d.depends_on);
    }
    for (const d of dependedOnBy) {
      d.sourceRule = await this.getRule(d.rule_id);
    }
    return { dependsOn, dependedOnBy };
  }

  // ── VERSION HISTORY ────────────────────────────────────────
  async getVersionHistory(ruleId) {
    const all = await this._query('rule_versions', 'select=*&order=changed_at.desc');
    return all.filter(v => v.rule_id === ruleId);
  }

  // ── COMMENTS ───────────────────────────────────────────────
  async getComments(ruleId) {
    const all = await this._query('comments', 'select=*&order=created_at');
    const filtered = all.filter(c => c.rule_id === ruleId);
    for (const c of filtered) {
      c.user = await this.getUser(c.user_id);
    }
    return filtered;
  }

  // ── AUDIT LOG ──────────────────────────────────────────────
  async getAuditLog(ruleId = null, tenantId = 'ohio-odh') {
    const all = await this._query('audit_log', 'select=*&order=timestamp.desc');
    let logs = all.filter(a => a.tenant_id === tenantId);
    if (ruleId) {
      logs = logs.filter(a => a.target_id === ruleId);
    }
    for (const a of logs) {
      a.user = a.user_id ? await this.getUser(a.user_id) : null;
    }
    return logs;
  }

  // ── NOTIFICATIONS ──────────────────────────────────────────
  async getNotifications(userId = 'user-001') {
    const all = await this._query('notifications', 'select=*&order=created_at.desc');
    return all.filter(n => n.user_id === userId);
  }

  async getUnreadCount(userId = 'user-001') {
    const notifs = await this.getNotifications(userId);
    return notifs.filter(n => !n.read).length;
  }

  // ── STATISTICS ─────────────────────────────────────────────
  async getStats(programId = 'hosp-licensing') {
    const rules = await this.getRules(programId);
    return {
      totalRules: rules.length,
      activeRules: rules.filter(r => r.status === 'active').length,
      draftRules: rules.filter(r => r.status === 'draft').length,
      reviewRules: rules.filter(r => r.status === 'review').length,
      federalRules: rules.filter(r => r.jurisdiction === 'Federal').length,
      stateRules: rules.filter(r => r.jurisdiction === 'Ohio').length,
    };
  }
}

// Singleton
const govpoint = new GovPointAPI();
