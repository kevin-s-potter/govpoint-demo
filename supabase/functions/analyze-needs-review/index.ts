import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Policy context for each known review flag code.
// When wiring a new program: add its flag codes here.
const FLAG_CONTEXT: Record<string, string> = {
  'DDC-015:income_doc_expired':
    'Coordinator may approve a 30-day courtesy extension per Discretionary Policy CD-01 for first-time applicants with otherwise clean records.',
  'DDC-013:annual_cap_exceeded':
    'Annual benefit exceeds the $2,400 cap (DDC-013). Prorate to $200/month. Check whether the Hardship Supplement (Municipal Resolution HR-2024-07) applies before finalizing.',
  'DDC-008:cooling_period_borderline':
    'Applicant is 1 month short of the 6-month cooling period. A hardship waiver is available under § 12.7.3 if the applicant documents a qualifying change in circumstances (job loss, medical expense, housing disruption).',
  'DDC-014:no_facility_capacity':
    'Selected facility has no open enrollment slots. Priority applicants (DDC-018) must be transferred to an alternate licensed facility. Target resolution: 3 business days per § 12.12.1.',
  'DDC-018:priority_queue_eligible':
    'Applicant qualifies for the priority queue (veteran or single-parent household per DDC-018). Ensure priority SLA is applied.',
};

interface SampleApp {
  app_id: string;
  applicant_name?: string;
  county?: string;
  household_income?: number;
  household_size?: number;
  review_flags?: string[];
  review_notes?: string;
}

interface RequestGroup {
  flags: string[];
  appCount: number;
  sampleApps: SampleApp[];
}

interface ResponseGroup {
  flags: string[];
  action: string;
  citation: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { programId, groups } = await req.json() as {
      programId: string;
      groups: RequestGroup[];
    };

    if (!programId || !Array.isArray(groups) || groups.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: programId, groups' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Build the flag context block for the prompt
    const flagContextLines = groups.flatMap(g => g.flags).map(flag => {
      const ctx = FLAG_CONTEXT[flag];
      return ctx ? `  ${flag}: ${ctx}` : `  ${flag}: (No specific policy context available — use general grant coordinator judgment.)`;
    });

    // Build compact group summaries for the prompt (3 sample apps max per group)
    const groupSummaries = groups.map((g, idx) => {
      const samples = g.sampleApps.slice(0, 3).map(a =>
        `    - App ${a.app_id}: county=${a.county ?? 'N/A'}, income=$${a.household_income?.toLocaleString() ?? 'N/A'}, hh_size=${a.household_size ?? 'N/A'}, notes="${a.review_notes ?? ''}"`,
      ).join('\n');
      return `Group ${idx + 1} (${g.appCount} applications):\n  Flags: ${g.flags.join(', ')}\n  Sample:\n${samples}`;
    }).join('\n\n');

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const systemPrompt = `You are a senior grant coordinator supervisor for the ${programId} program reviewing flagged applications that require human coordinator attention. For each group of flagged applications, provide a concrete recommended action with the exact policy citation, a priority level, and a brief reasoning paragraph a coordinator could use in their decision process.

You must respond with ONLY valid JSON — no markdown, no explanation, no code fences. Cite only real policies from the context provided. Do not invent citations.`;

    const userPrompt = `Program: ${programId}

POLICY CONTEXT FOR THESE FLAGS:
${flagContextLines.join('\n')}

FLAGGED APPLICATION GROUPS:
${groupSummaries}

Respond with this exact JSON structure — one entry per group in the same order:
{
  "groups": [
    {
      "flags": ["flag_code"],
      "action": "Short action label (4-8 words, imperative — e.g. 'Approve Courtesy Extension')",
      "citation": "Exact policy/rule citation (e.g. 'DDC-015 + Discretionary Policy CD-01')",
      "priority": "high | medium | low",
      "reasoning": "2-3 sentence explanation a coordinator could adapt for their decision letter. Be specific about what the coordinator should verify or document."
    }
  ],
  "model": "claude-haiku-4-5-20251001"
}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    let rawText = (message.content[0] as { type: string; text: string }).text.trim();
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

    const parsed = JSON.parse(rawText) as { groups: ResponseGroup[]; model: string };

    return new Response(
      JSON.stringify({ groups: parsed.groups, model: parsed.model ?? 'claude-haiku-4-5-20251001' }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('analyze-needs-review error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to analyze needs review queue', detail: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
