
const rateLimitMap = new Map();
const RATE_LIMIT    = 10;   // max calls per window per IP
const RATE_WINDOW   = 60_000; // 1 minute in ms

function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip) || { count: 0, start: now };

    if (now - entry.start > RATE_WINDOW) {
        // Window expired — reset
        rateLimitMap.set(ip, { count: 1, start: now });
        return false;
    }

    if (entry.count >= RATE_LIMIT) return true;

    entry.count++;
    rateLimitMap.set(ip, entry);
    return false;
}

export default async function handler(req, res) {
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    
    
    const allowedOrigin = process.env.ALLOWED_ORIGIN;
    const origin = req.headers['origin'] || '';

    if (allowedOrigin && origin !== allowedOrigin) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    
    if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);

    
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }

    
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Missing prompt' });
    }

    
    if (prompt.length > 4000) {
        return res.status(400).json({ error: 'Prompt too long' });
    }

    
    if (!prompt.includes('Members') || !prompt.includes('Expenses')) {
        return res.status(400).json({ error: 'Invalid request format' });
    }

    
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
        return res.status(500).json({ error: 'API key not configured on server' });
    }

    
    try {
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 2048,
                    }
                })
            }
        );

        if (!geminiRes.ok) {
            const errData = await geminiRes.json().catch(() => ({}));
            return res.status(geminiRes.status).json({
                error: errData?.error?.message || `Gemini error ${geminiRes.status}`
            });
        }

        const data = await geminiRes.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return res.status(200).json({ text });

    } catch (err) {
        return res.status(500).json({ error: err.message || 'Server error' });
    }
}