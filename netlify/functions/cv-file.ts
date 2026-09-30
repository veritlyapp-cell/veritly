import { Handler } from '@netlify/functions';
import { getCorsHeaders, checkRateLimit } from './_security';

// Descarga un CV de Firebase Storage desde el servidor y lo devuelve en base64.
//
// El bucket (*.firebasestorage.app) no tiene CORS configurado para descargas,
// asi que el navegador no puede leer el archivo con fetch() ("Failed to fetch"),
// aunque si pueda mostrarlo en un iframe. Desde el servidor no aplica CORS.
//
// Solo acepta URLs de descarga de CVs de nuestro propio bucket: no es un proxy
// abierto (evita SSRF) y no da mas acceso del que ya da la URL con token.

const BUCKET = 'vinku-3a3af.firebasestorage.app';
const ALLOWED_PREFIXES = ['cvs/', 'candidates_cvs/'];
const MAX_BYTES = 4 * 1024 * 1024; // base64 (~5.3MB) debe caber en el limite de 6MB de respuesta de Netlify

function isAllowedCvUrl(raw: string): boolean {
    let u: URL;
    try {
        u = new URL(raw);
    } catch {
        return false;
    }
    if (u.protocol !== 'https:' || u.hostname !== 'firebasestorage.googleapis.com') return false;
    const prefix = `/v0/b/${BUCKET}/o/`;
    if (!u.pathname.startsWith(prefix)) return false;
    const objectPath = decodeURIComponent(u.pathname.slice(prefix.length));
    if (objectPath.includes('..')) return false;
    return ALLOWED_PREFIXES.some(p => objectPath.startsWith(p));
}

export const handler: Handler = async (event) => {
    const origin = event.headers.origin || event.headers.Origin || '';
    const headers = getCorsHeaders(origin);

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Demasiadas solicitudes. Intenta en 1 minuto.' }) };
    }

    let url = '';
    try {
        url = JSON.parse(event.body || '{}').url || '';
    } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
    }

    if (!isAllowedCvUrl(url)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL de CV no permitida' }) };
    }

    try {
        const res = await fetch(url);
        if (!res.ok) {
            return { statusCode: 502, headers, body: JSON.stringify({ error: `No se pudo descargar el CV (HTTP ${res.status})` }) };
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_BYTES) {
            return { statusCode: 413, headers, body: JSON.stringify({ error: 'El CV es demasiado grande para analizarlo (máx. 4 MB).' }) };
        }
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                base64: buf.toString('base64'),
                contentType: res.headers.get('content-type') || 'application/octet-stream',
            }),
        };
    } catch (e: any) {
        console.error('cv-file error:', e);
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'Error descargando el CV' }) };
    }
};
