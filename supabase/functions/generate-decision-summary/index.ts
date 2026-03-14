import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { facilityName, decision, flags, passCount, flagCount, blockCount, context } = await req.json();

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const issueText = flags && flags.length > 0
      ? `Issues identified: ${flags.join('; ')}.`
      : 'No issues were identified.';

    const programContext = context
      ? context
      : 'Ohio child care facility license application. Write as a regulatory compliance officer.';

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are writing a formal decision summary. Context: ${programContext}

Write a 2-3 sentence plain-English summary in third person, suitable for the applicant's official record. Be specific about what drove the decision. Do not use bullet points or headers.

Applicant/Facility: ${facilityName}
Decision: ${decision}
Rules passed: ${passCount}, flagged: ${flagCount}, blocked: ${blockCount}
${issueText}

Respond with only the summary paragraph.`,
      }],
    });

    const summary = (message.content[0] as { type: string; text: string }).text.trim();

    return new Response(JSON.stringify({ summary }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-decision-summary error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to generate summary', detail: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
