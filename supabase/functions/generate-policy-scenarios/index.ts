import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = 'https://fshdlcveidwwufdigekh.supabase.co';

interface RuleCondition {
  id: number;
  rule_id: string;
  order: number;
  field: string;
  operator: string;
  value: string;
  value_type: string;
}

interface Rule {
  rule_id: string;
  name: string;
  rule_type: string;
  priority: string;
  status: string;
  citation: string;
  jurisdiction: string;
  source_text: string;
  conditions: RuleCondition[];
}

interface ScenarioConditionChange {
  field: string;
  operator: string;
  original_value: string;
  proposed_value: string;
  value_type: string;
}

interface ScenarioRule {
  rule_id: string;
  rule_name: string;
  change_rationale: string;
  condition_changes: ScenarioConditionChange[];
}

interface GeneratedScenario {
  name: string;
  summary: string;
  affected_rules: ScenarioRule[];
  estimated_impact: string;
  confidence: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { programId, policyGoal, timePeriodStart, timePeriodEnd, scenarioCount } =
      await req.json();

    if (!programId || !policyGoal || !scenarioCount) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const count = Math.min(Math.max(parseInt(scenarioCount) || 1, 1), 3);
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Fetch rules + conditions for the program
    const rulesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rules?program_id=eq.${programId}&status=eq.active&select=rule_id,name,rule_type,priority,citation,jurisdiction,source_text`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    const rulesRaw: Rule[] = await rulesRes.json();

    const condRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rule_conditions?rule_id=in.(${rulesRaw.map((r) => r.rule_id).join(',')})&select=rule_id,order,field,operator,value,value_type&order=rule_id,order`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    const conditionsRaw: RuleCondition[] = await condRes.json();

    // Fetch recent audit activity (cap at 50 entries to control token cost)
    let auditSummary = 'No audit data available for the specified period.';
    if (timePeriodStart && timePeriodEnd) {
      const auditRes = await fetch(
        `${SUPABASE_URL}/rest/v1/audit_log?timestamp=gte.${timePeriodStart}&timestamp=lte.${timePeriodEnd}&target_type=eq.rule&order=timestamp.desc&limit=50&select=action,target_id,detail,timestamp`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );
      const auditRaw = await auditRes.json();
      if (Array.isArray(auditRaw) && auditRaw.length > 0) {
        auditSummary = auditRaw
          .map((e: { action: string; target_id: string; detail: string; timestamp: string }) =>
            `${e.timestamp.slice(0, 10)}: ${e.action} on ${e.target_id} — ${e.detail ?? ''}`
          )
          .join('\n');
      }
    }

    // Build compact rule+condition map (token-efficient)
    const condByRule: Record<string, RuleCondition[]> = {};
    for (const c of conditionsRaw) {
      if (!condByRule[c.rule_id]) condByRule[c.rule_id] = [];
      condByRule[c.rule_id].push(c);
    }

    const rulesCompact = rulesRaw.map((r) => ({
      id: r.rule_id,
      name: r.name,
      type: r.rule_type,
      priority: r.priority,
      citation: r.citation,
      jurisdiction: r.jurisdiction,
      conditions: (condByRule[r.rule_id] ?? []).map((c) => ({
        field: c.field,
        op: c.operator,
        value: c.value,
        vtype: c.value_type,
      })),
    }));

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const systemPrompt = `You are a senior regulatory policy analyst specializing in government benefits and licensing programs. You have deep expertise in administrative law, rule ontology design, and policy impact analysis. Your task is to analyze an existing rule structure and propose concrete, legally grounded scenarios to achieve a stated policy goal.

You must respond with ONLY valid JSON — no markdown, no explanation, no code fences.`;

    const userPrompt = `Program ID: ${programId}
Policy Goal: ${policyGoal}
Analysis Period: ${timePeriodStart ?? 'N/A'} to ${timePeriodEnd ?? 'N/A'}
Requested Scenarios: ${count}

RULE ONTOLOGY (${rulesRaw.length} active rules, showing conditions):
${JSON.stringify(rulesCompact, null, 2)}

RECENT AUDIT ACTIVITY:
${auditSummary}

Analyze the rule ontology, condition logic, and audit activity above. Generate exactly ${count} distinct, ranked scenario(s) that would achieve the stated policy goal. Each scenario must:
- Target specific, named rules and conditions (use the exact rule_id and field names from the ontology)
- Propose concrete condition value changes (e.g., change gross_income threshold from 1830 to 1950)
- Explain WHY each change achieves the goal and what the downstream impact would be
- Be ranked by confidence (most achievable first)
- Stay within the bounds of the existing rule structure (modify conditions, don't invent new rules)

Respond with this exact JSON structure:
{
  "scenarios": [
    {
      "name": "Short scenario name (5-8 words)",
      "summary": "2-3 sentence plain English description of what this scenario does and why",
      "affected_rules": [
        {
          "rule_id": "exact rule_id from ontology",
          "rule_name": "exact rule name",
          "change_rationale": "why this rule needs to change",
          "condition_changes": [
            {
              "field": "exact field name",
              "operator": "operator (unchanged or new value)",
              "original_value": "current value from ontology",
              "proposed_value": "new proposed value",
              "value_type": "value type"
            }
          ]
        }
      ],
      "estimated_impact": "Plain English estimate of who is affected and how (e.g. '~1,200 additional eligible applicants per quarter')",
      "confidence": 85
    }
  ]
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    // Log API usage — fire-and-forget, non-blocking
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    fetch(`${SUPABASE_URL}/rest/v1/api_usage_log`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        function_name: 'generate-policy-scenarios',
        model: message.model,
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        program_id: programId ?? null
      })
    }).catch(err => console.warn('api_usage_log insert failed:', err));

    let rawText = (message.content[0] as { type: string; text: string }).text.trim();

    // Strip JSON code fences if present
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

    const parsed = JSON.parse(rawText);

    return new Response(
      JSON.stringify({
        scenarios: parsed.scenarios,
        meta: {
          model: 'claude-sonnet-4-6',
          rules_analyzed: rulesRaw.length,
          conditions_analyzed: conditionsRaw.length,
        },
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('generate-policy-scenarios error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to generate scenarios', detail: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
