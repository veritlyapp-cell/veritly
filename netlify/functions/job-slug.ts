import { Handler } from '@netlify/functions';
import { adminDb } from './_firebaseAdmin';
import { verifyIdToken } from './_verifyAuth';
import { getCorsHeaders, checkRateLimit } from './_security';

// Enlaces cortos propios para vacantes (veritlyapp.com/v/{slug}) en vez del
// ID largo de Firestore (veritlyapp.com/vacante/AbCdEfGhIjKlMnOpQrSt) --
// util para compartir en LinkedIn/WhatsApp sin que se vea tan extenso, y sin
// depender de acortadores externos (bit.ly, etc.) que algunas empresas
// bloquean en su red corporativa. Mismo patron que company_slugs para las
// landing pages de empresa.

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40)
        .replace(/-+$/, '');
}

function randomSuffix(): string {
    return Math.random().toString(36).slice(2, 6);
}

async function isCompanyMember(uid: string, companyId: string): Promise<boolean> {
    if (uid === companyId) return true;
    const snap = await adminDb.collection('team_members').doc(uid).get();
    if (!snap.exists) return false;
    return snap.data()?.companyId === companyId;
}

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

        return { statusCode: 400, headers, body: JSON.stringify({ error: `Acción no reconocida: ${action}` }) };

    } catch (error: any) {
        console.error("❌ Error en job-slug.ts:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
    }
};
