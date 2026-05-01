exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS' || event.httpMethod === 'GET') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, method: event.httpMethod }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Expected POST, got: ' + event.httpMethod }) };
  }

  const key = process.env.ANTHROPICKEY;
  if (!key) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'ANTHROPICKEY not set' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Bad JSON: ' + e.message }) };
  }

  try {
    const https = require('https');
    const payload = JSON.stringify(body);

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        timeout: 25000
      };
      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch(e) { reject(new Error('Bad JSON from Anthropic: ' + raw.slice(0,200))); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timed out')); });
      req.write(payload);
      req.end();
    });

    return { statusCode: 200, headers, body: JSON.stringify(result.body) };

  } catch(err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};
