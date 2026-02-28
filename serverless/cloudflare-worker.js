// Cloudflare Worker: DeepSeek proxy with CORS and optional auth
// Worker env: DEEPSEEK_API_KEY (required), CILIAI_PROXY_SECRET (optional — if set, requests must send Authorization: Bearer <secret>)
// Optional: DEEPSEEK_BASE_URL (default: https://api.deepseek.com/v1/chat/completions)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CiliAI-Token'
};

function getRequestToken(request) {
    const auth = request.headers.get('Authorization');
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
    return request.headers.get('X-CiliAI-Token') || '';
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (request.method === 'GET') {
            if (url.pathname === '/api/chat/health') {
                return new Response(JSON.stringify({ ok: true, keyConfigured: !!env.DEEPSEEK_API_KEY, authRequired: !!env.CILIAI_PROXY_SECRET }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        if (url.pathname !== '/api/chat') {
            return new Response('Not found', { status: 404, headers: corsHeaders });
        }

        if (env.CILIAI_PROXY_SECRET) {
            const token = getRequestToken(request);
            if (token !== env.CILIAI_PROXY_SECRET) {
                return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing token' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        if (!env.DEEPSEEK_API_KEY) {
            return new Response('Missing server API key', { status: 500, headers: corsHeaders });
        }

        const body = await request.json();
        const payload = {
            model: body.model || 'deepseek-chat',
            temperature: typeof body.temperature === 'number' ? body.temperature : 0.2,
            messages: body.messages || []
        };

        const baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1/chat/completions';
        const resp = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const text = await resp.text();
        return new Response(text, {
            status: resp.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
};

