export default async (request, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const key = Netlify.env.get('ANTHROPICKEY');
  if (!key) {
    return new Response(JSON.stringify({ error: 'ANTHROPICKEY env var not set' }), { status: 500, headers });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    clearTimeout(timeout);
    const text = await response.text();

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return new Response(JSON.stringify({ error: 'Bad Anthropic response', raw: text.slice(0,200) }), { status: 502, headers }); }

    return new Response(JSON.stringify(data), { status: response.status, headers });

  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return new Response(
      JSON.stringify({ error: isTimeout ? 'Timed out — try fewer/smaller photos' : err.message }),
      { status: isTimeout ? 504 : 500, headers }
    );
  }
};

export const config = { path: '/api/analyze' };
