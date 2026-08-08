
import { Handler } from '@netlify/functions';
import { getCorsHeaders, checkRateLimit } from './_security';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

export const handler: Handler = async (event) => {
    const origin = event.headers.origin || event.headers.Origin || '';
    const headers = getCorsHeaders(origin);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    // ── Rate Limiting: evita usar este endpoint como oráculo de credential stuffing ──
    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({ error: 'Demasiados intentos. Intenta en 1 minuto.' })
        };
    }

    try {
        const { email, password } = JSON.parse(event.body || '{}');

        if (!email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Email and password are required' })
            };
        }

        if (!FIREBASE_API_KEY) {
            console.error("❌ FIREBASE_API_KEY is not defined in environment variables");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true })
        });

        const data = await res.json();

        if (!res.ok) {
            return {
                statusCode: res.status,
                headers,
                body: JSON.stringify({ error: data.error?.message || 'Authentication failed' })
            };
        }

        // Return only what the extension needs, avoiding leaking sensitive tokens if possible
        // but the extension needs the token for further authenticated requests if any.
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                localId: data.localId,
                email: data.email,
                idToken: data.idToken,
                displayName: data.displayName
            })
        };

    } catch (error: any) {
        console.error("❌ Error in auth proxy:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal Server Error' })
        };
    }
};
