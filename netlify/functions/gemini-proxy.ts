import { Handler } from '@netlify/functions';
import { getCorsHeaders, checkRateLimit } from './_security';

// Key solo en variable de servidor (sin EXPO_PUBLIC_) — nunca sale al cliente
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const handler: Handler = async (event) => {
    const origin = event.headers.origin || event.headers.Origin || '';
    const headers = getCorsHeaders(origin);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({ error: 'Demasiadas solicitudes. Intenta en 1 minuto.' })
        };
    }

    if (!GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY is not defined in environment variables");
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error' })
        };
    }

    try {
        const { model, contents, generationConfig } = JSON.parse(event.body || '{}');

        if (!model || !contents) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: model and contents' })
            };
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const geminiRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents, generationConfig })
        });

        const data = await geminiRes.json();

        return {
            statusCode: geminiRes.status,
            headers,
            body: JSON.stringify(data)
        };

    } catch (error: any) {
        console.error("❌ Error in gemini-proxy:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal Server Error' })
        };
    }
};
