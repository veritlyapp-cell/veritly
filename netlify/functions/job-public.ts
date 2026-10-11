import { Handler } from '@netlify/functions';
import { adminDb } from './_firebaseAdmin';
import { getSalaryRange } from '../../utils/salaryRange';
import { getActiveKillerQuestions } from '../../utils/killerQuestions';

// Vacante publica para la pagina de postulacion: SOLO lo que el candidato debe
// ver. Antes la pagina leia el documento completo de Firestore desde el
// navegador, y con el las respuestas correctas de las preguntas filtro, el
// presupuesto aunque el sueldo fuera privado y el companyId (que llevaba al
// perfil de la empresa, tambien legible: correo, RUC, responsable).
//
// - Preguntas filtro sin respuestas correctas (se evaluan en submit-application.ts)
// - Rango salarial solo si es publico (nunca el presupuesto ni las tolerancias)
// - Confidencial: solo el alias, sin companyId (comparandolo con una vacante
//   publica de la misma empresa se descubria cual es)

const ID_RE = /^[A-Za-z0-9_-]{10,40}$/;

const pick = (obj: any, keys: string[]) =>
    Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const toIso = (v: any) => (v?.toDate ? v.toDate().toISOString() : typeof v === 'string' ? v : null);

export const handler: Handler = async (event) => {
    const headers = { 'Content-Type': 'application/json' };
    if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    const id = event.queryStringParameters?.id || '';
    if (!ID_RE.test(id)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Vacante inválida' }) };

    try {
        const snap = await adminDb.collection('jobs').doc(id).get();
        if (!snap.exists) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Vacante no encontrada' }) };
        const job = snap.data()!;
        const confidential = !!job.isConfidential;

        let company: { name: string; logoUrl: string; type: string };
        if (confidential) {
            company = { name: job.confidentialLabel?.trim() || 'Empresa Confidencial', logoUrl: '', type: 'empresa' };
        } else {
            const c = (await adminDb.collection('users_empresas').doc(job.companyId).get()).data() || {};
            company = {
                name: c.company?.name || c.nombreComercial || c.aiContext?.nombre || 'Empresa',
                logoUrl: c.company?.logoUrl || c.logoUrl || '',
                type: c.company?.type || 'empresa',
            };
        }

        const publicJob = {
            id,
            ...pick(job, [
                'jobTitle', 'optimizedText', 'originalText', 'hardSkills', 'softSkills', 'education',
                'requiredExperience', 'employmentType', 'location', 'workMode', 'country', 'city', 'currency', 'allowedCountries',
                'isExternal', 'status', 'applicantsCount', 'isConfidential', 'confidentialLabel', 'shortSlug',
            ]),
            createdAt: toIso(job.createdAt),
            isSalaryPublic: !!job.isSalaryPublic,
            salaryRange: job.isSalaryPublic ? getSalaryRange(job) : null,
            killerQuestions: getActiveKillerQuestions(job).map((q: any) => pick(q, ['question', 'type', 'options'])),
            companyId: confidential ? null : job.companyId || null,
            company,
        };

        return {
            statusCode: 200,
            headers: {
                ...headers,
                // El navegador siempre revalida; el CDN de Netlify la guarda 1 minuto
                'Cache-Control': 'public, max-age=0, must-revalidate',
                'Netlify-CDN-Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
            },
            body: JSON.stringify(publicJob),
        };
    } catch (e: any) {
        console.error('❌ Error en job-public.ts:', e);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo cargar la vacante' }) };
    }
};
