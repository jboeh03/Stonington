exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS' || event.httpMethod === 'GET') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  const key = process.env.ANTHROPICKEY;
  if (!key) return { statusCode: 200, headers, body: JSON.stringify({ error: 'ANTHROPICKEY not set' }) };

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Bad JSON body: ' + e.message }) };
  }

  try {
    const https = require('https');
    const payload = JSON.stringify(body);
    const payloadBytes = Buffer.byteLength(payload);

    // Reject if payload too large (Netlify limit is 6MB)
    if (payloadBytes > 5 * 1024 * 1024) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Image too large (' + (payloadBytes/1024/1024).toFixed(1) + 'MB). Please use fewer or smaller photos.' }) };
    }

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payloadBytes,
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        timeout: 25000
      };

      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          // Always return the raw response so we can see what went wrong
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch(e) {
            parsed = { error: 'Anthropic returned non-JSON', raw: raw.slice(0, 500), status: res.statusCode };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      });

      req.on('error', (e) => reject(new Error('HTTPS error: ' + e.message)));
      req.on('timeout', () => { req.destroy(); reject(new Error('Timed out after 25s — try a smaller photo')); });
      req.write(payload);
      req.end();
    });

    return { statusCode: 200, headers, body: JSON.stringify(result.body) };

  } catch(err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};
