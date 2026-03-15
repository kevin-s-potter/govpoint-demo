import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = 'https://fshdlcveidwwufdigekh.supabase.co';

interface RuleChange {
  ruleName: string;
  citation?: string;
  changes: { field: string; from: string; to: string }[];
  totalFlips: number;
  failToPassCount: number;
  passToFailCount: number;
}

interface SummarizeRequest {
  programName: string;
  sandboxName: string;
  ruleChanges: RuleChange[];
  totalFlips: number;
  appCount: number;
  dataSource: string;
  topContextValues: Record<string, string[]>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json() as SummarizeRequest;
    const { programName, sandboxName, ruleChanges, totalFlips, appCount, dataSource, topContextValues } = body;

    if (!programName || !Array.isArray(ruleChanges) || ruleChanges.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: programName, ruleChanges' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Build readable rule change lines
    const changeLines = ruleChanges.map(r => {
      const citation = r.citation ? ` (${r.citation})` : '';
      const changeDesc = r.changes.map(c => `${c.field} from ${c.from} to ${c.to}`).join(', ');
      return `  Rule: ${r.ruleName}${citation}\n  Change: ${changeDesc}\n  Impact: ${r.totalFlips} applications affected — ${r.failToPassCount} move from denied→approved, ${r.passToFailCount} move from approved→denied`;
    }).join('\n\n');

    // Build geography line only if county data is actually present
    const countyValues = topContextValues['county'] || topContextValues['County'] || [];
    const geoLine = countyValues.length > 0
      ? `Geographic distribution of affected records: ${countyValues.join(', ')}`
      : '(No geographic data available for this program.)';

    const systemPrompt = `You are a policy analyst writing plain-language impact summaries for government regulators.
Be concise and specific. Respond with exactly one paragraph of 1–3 sentences.
No markdown, no bullet points, no headers.
If a rule citation is provided, open the summary with it (e.g. "Under SNAP-OH-017, ...").
Only mention geography if county data is explicitly provided — never invent or infer county names.`;

    const userPrompt = `Program: ${programName}
Sandbox: ${sandboxName}

Policy changes being analyzed:
${changeLines}

Total: ${totalFlips} of ${appCount} ${dataSource} application records would flip outcome.
${geoLine}

Write a 1–3 sentence plain-language summary. Lead with the rule citation if one was provided.
Be specific about the numbers. Do not start with "This change" or "This policy".`;

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
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
        function_name: 'summarize-impact',
        model: message.model,
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        program_id: null
      })
    }).catch(err => console.warn('api_usage_log insert failed:', err));

    let summary = (message.content[0] as { type: string; text: string }).text.trim();
    // Strip any accidental markdown
    summary = summary.replace(/^[*_#`]+|[*_#`]+$/g, '').trim();

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('summarize-impact error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to generate impact summary', detail: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
