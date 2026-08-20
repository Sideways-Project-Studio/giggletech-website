const ALLOWED_ORIGINS = new Set([
  'https://giggletech.io',
  'https://www.giggletech.io',
  'http://127.0.0.1:9292',
  'http://127.0.0.1:9293',
  'http://localhost:9292',
  'http://localhost:9293',
]);

const EVENT_NAME = '140mm-interest';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method === 'POST' && url.pathname === '/track') {
      if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return json({ error: 'Origin not allowed' }, 403);
      }

      await env.DB.prepare(
        'INSERT INTO interest_events (event_name) VALUES (?)'
      )
        .bind(EVENT_NAME)
        .run();

      return json(
        { tracked: true },
        200,
        corsHeaders(origin)
      );
    }

    if (request.method === 'GET' && url.pathname === '/count') {
      const result = await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM interest_events WHERE event_name = ?'
      )
        .bind(EVENT_NAME)
        .first();

      return json({
        event: EVENT_NAME,
        count: Number(result?.count ?? 0),
      });
    }

    return json({
      service: 'Vent Kit interest tracker',
      status: 'ok',
    });
  },
};
