import { Handler } from '@netlify/functions';
import { adminDb } from './_firebaseAdmin';
import { isCompanyMember, verifyIdToken } from './_verifyAuth';
import { getCorsHeaders, checkRateLimit } from './_security';

// Enlaces cortos propios para vacantes (veritlyapp.com/v/{slug}) en vez del
// ID largo de Firestore (veritlyapp.com/vacante/AbCdEfGhIjKlMnOpQrSt) --
// util para compartir en LinkedIn/WhatsApp sin que se vea tan extenso, y sin
// depender de acortadores externos (bit.ly, etc.) que algunas empresas
// bloquean en su red corporativa. Mismo patron que company_slugs para las
// landing pages de empresa.

// Palabras que no aportan al link ("Jefe(a) de Atraccion del Talento" ->
// "jefe-atraccion-talento"). El link tiene que caber en una imagen o post.
const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'en', 'para', 'por', 'con', 'a', 'al', 'un', 'una', 'sr', 'jr']);

function slugify(text: string): string {
    const words = text
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
        .replace(/\(a\)|\(o\)|\(as\)|\(os\)/g, '')       // "jefe(a)" -> "jefe"
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/[\s-]+/)
        .filter((w) => w && !STOPWORDS.has(w));
    let slug = '';
    for (const w of words.slice(0, 3)) {
        const next = slug ? `${slug}-${w}` : w;
        if (next.length > 22) break;
        slug = next;
    }
    return slug || words[0]?.slice(0, 22) || '';
}

function randomSuffix(): string {
    return Math.random().toString(36).slice(2, 5);
}

// Link elegido por el reclutador: 3-30 caracteres, minusculas, numeros y guiones
const CUSTOM_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

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
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Demasiadas solicitudes. Intenta en 1 minuto.' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        // ── Publico: resolver un slug corto al ID real de la vacante ──
        if (action === 'resolve') {
            const { slug } = body;
            if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el slug' }) };

            const slugSnap = await adminDb.collection('job_slugs').doc(slug).get();
            if (!slugSnap.exists) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Enlace no encontrado' }) };
            }
            return { statusCode: 200, headers, body: JSON.stringify({ jobId: slugSnap.data()!.jobId }) };
        }

        // ── El resto requiere autenticacion (dueño o miembro del equipo) ──
        const { idToken, jobId } = body;
        const verified = await verifyIdToken(idToken);
        if (!verified) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sesión inválida' }) };
        if (!jobId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta jobId' }) };

        const jobSnap = await adminDb.collection('jobs').doc(jobId).get();
        if (!jobSnap.exists) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Vacante no encontrada' }) };
        const jobData = jobSnap.data()!;

        if (!(await isCompanyMember(verified.uid, jobData.companyId))) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'No autorizado' }) };
        }

        // ── Trae el slug existente, o crea uno nuevo si la vacante no tiene ──
        if (action === 'get_or_create') {
            if (jobData.shortSlug) {
                return { statusCode: 200, headers, body: JSON.stringify({ slug: jobData.shortSlug }) };
            }

            const base = slugify(jobData.jobTitle || 'vacante') || 'vacante';
            let slug = '';
            for (let attempt = 0; attempt < 5; attempt++) {
                const candidate = `${base}-${randomSuffix()}`;
                const existing = await adminDb.collection('job_slugs').doc(candidate).get();
                if (!existing.exists) {
                    slug = candidate;
                    break;
                }
            }
            if (!slug) {
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo generar un enlace único, intenta de nuevo.' }) };
            }

            await adminDb.collection('job_slugs').doc(slug).set({ jobId, companyId: jobData.companyId });
            await adminDb.collection('jobs').doc(jobId).set({ shortSlug: slug }, { merge: true });

            return { statusCode: 200, headers, body: JSON.stringify({ slug }) };
        }

        // ── El reclutador elige su propio link (ej. veritlyapp.com/v/ventas-lima) ──
        // El link anterior NO se borra: sigue llevando a la vacante, para no
        // romper los que ya se compartieron en imagenes o publicaciones.
        if (action === 'set_custom') {
            const slug = String(body.slug || '').trim().toLowerCase();
            if (!CUSTOM_SLUG_RE.test(slug) || slug.includes('--')) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Usa entre 3 y 30 caracteres: minúsculas, números y guiones (sin espacios ni tildes).' }) };
            }
            const ref = adminDb.collection('job_slugs').doc(slug);
            const taken = await adminDb.runTransaction(async (tx) => {
                const existing = await tx.get(ref);
                if (existing.exists && existing.data()!.jobId !== jobId) return true;
                if (!existing.exists) tx.set(ref, { jobId, companyId: jobData.companyId });
                tx.set(adminDb.collection('jobs').doc(jobId), { shortSlug: slug }, { merge: true });
                return false;
            });
            if (taken) return { statusCode: 409, headers, body: JSON.stringify({ error: 'Ese link ya lo usa otra vacante. Prueba con otro.' }) };
            return { statusCode: 200, headers, body: JSON.stringify({ slug }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: `Acción no reconocida: ${action}` }) };

    } catch (error: any) {
        console.error("❌ Error en job-slug.ts:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
    }
};
