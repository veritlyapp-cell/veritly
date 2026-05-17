/**
 * _security.ts — Utilidades de seguridad compartidas para todas las Netlify Functions
 * Prefijo _ para que Netlify NO lo exponga como endpoint público.
 */

// ─── CORS ──────────────────────────────────────────────────────────────────
export const ALLOWED_ORIGINS = [
    'https://www.veritlyapp.com',
    'https://veritlyapp.com',
    'http://localhost:8081',
    'http://localhost:3000',
];

export function getCorsHeaders(origin: string) {
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': corsOrigin,
        'Vary': 'Origin',
        'Access-Control-Allow-Headers': 'Content-Type, X-Api-Token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
    };
}

// ─── RATE LIMITING (in-memory, resets on cold start) ──────────────────────
// Para producción seria mejor usar Upstash Redis, pero esto ya bloquea el abuso básico
const ipCallCount: Record<string, { count: number; windowStart: number }> = {};

const RATE_LIMIT = 30;          // máximo llamadas por IP
const RATE_WINDOW_MS = 60_000;  // en 60 segundos

export function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = ipCallCount[ip];

    if (!record || now - record.windowStart > RATE_WINDOW_MS) {
        ipCallCount[ip] = { count: 1, windowStart: now };
        return true; // OK
    }

    if (record.count >= RATE_LIMIT) {
        return false; // BLOQUEADO
    }

    record.count++;
    return true; // OK
}

// ─── INTERNAL API TOKEN (opcional, para llamadas app→function) ────────────
export function validateInternalToken(token: string | undefined): boolean {
    const expected = process.env.INTERNAL_API_TOKEN;
    if (!expected) return true; // Si no está configurado, no bloquear
    return token === expected;
}
