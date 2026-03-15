import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = 'https://fshdlcveidwwufdigekh.supabase.co';

const CLASSIFICATION_LABELS: Record<string, string> = {
  director_credentials:   'Director / Administrator Education Credentials',
  background_check_bci:  'BCI (Bureau of Criminal Investigation) Background Check Results',
  background_check_fbi:  'FBI Background Check Results',
  floor_plan:             'Facility Floor Plan / Layout',
  proof_of_insurance:     'Proof of Liability Insurance',
  staff_roster:           'Staff Roster',
  health_safety_policies: 'Written Health & Safety Policies',
  emergency_action_plan:  'Emergency Action Plan',
  cpr_certification:      'CPR / First Aid Certification',
  sutq_certificate:       'Step Up To Quality (SUTQ) Certificate',
  incorporation_docs:     'Business Formation / Incorporation Documents',
  other:                  'Other Supporting Documentation',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { file_url, classification } = await req.json();

    if (!file_url || !classification) {
      return new Response(
        JSON.stringify({ error: 'file_url and classification are required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch document bytes from Supabase Storage
    const fileResp = await fetch(file_url);
    if (!fileResp.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch document from storage' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = fileResp.headers.get('content-type') || 'application/octet-stream';
    const buffer = await fileResp.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Build base64 string safely for large files
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    const classificationLabel = CLASSIFICATION_LABELS[classification] ?? classification;

    // Determine content block type
    const isPdf = contentType.includes('pdf');
    const isImage = contentType.startsWith('image/');

    if (!isPdf && !isImage) {
      return new Response(
        JSON.stringify({ error: 'Only PDF and image files are supported' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    // Build the content block based on file type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileBlock: any = isPdf
      ? {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: contentType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: base64,
          },
        };

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text: `The user has classified this document as: "${classificationLabel}".

Review the document and assess how well the user's classification matches the actual content.

Respond in valid JSON only — no markdown fences, no extra text:
{
  "confidence": <integer 0-100>,
  "summary": "<1-2 sentences describing what this document actually contains>",
  "classification_note": "<one sentence explaining why you gave this confidence score>"
}`,
            },
          ],
        },
      ],
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
        function_name: 'classify-document',
        model: message.model,
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        program_id: null
      })
    }).catch(err => console.warn('api_usage_log insert failed:', err));

    const rawText = (message.content[0] as { type: string; text: string }).text.trim();

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      // Claude occasionally wraps in backticks — strip them
      const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '');
      result = JSON.parse(cleaned);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('classify-document error:', err);
    return new Response(
      JSON.stringify({ error: 'Classification failed', detail: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
