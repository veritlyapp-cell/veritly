import { Handler } from '@netlify/functions';
import type { DocumentData, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './_firebaseAdmin';
import { verifyIdToken } from './_verifyAuth';
import { getCorsHeaders, checkRateLimit } from './_security';

// "Mis Postulaciones" del candidato: sus postulaciones a vacantes de Veritly
// con el estado real del pipeline del reclutador, traducido a lo que el
// candidato debe ver. Se hace en el servidor porque el documento de la
// postulacion tambien tiene el analisis IA y notas del reclutador: aca se
// devuelve solo puesto, empresa (alias si es confidencial), fechas y estado.
//
// Requiere el indice de grupo de "candidates" por userId (firestore.indexes.json).

type PublicStatus = { key: 'review' | 'interview' | 'offer' | 'hired' | 'closed'; label: string };

const toIso = (v: any): string | null => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof (v as Timestamp).toDate === 'function') return (v as Timestamp).toDate().toISOString();
    return null;
};

function publicStatus(c: DocumentData, jobOpen: boolean): PublicStatus {
    const status = c.recruitmentStatus || c.status || 'new';
    if (status === 'hired') return { key: 'hired', label: 'Seleccionado' };
    if (status === 'offer') return { key: 'offer', label: 'Oferta' };
    if (status === 'interview') return { key: 'interview', label: 'Entrevista' };
    if (status === 'rejected' || status === 'rejected_salary') {
        // Los descartes automaticos al postular (sueldo, pais, preguntas filtro)
        // guardan failureReason y no tienen statusUpdatedAt: no se anuncian al
        // instante, se muestran "En revision" hasta que la vacante cierra. Un
        // descarte del reclutador si se muestra: statusUpdatedAt (desde oct-2026)
        // o, en registros anteriores, un descartado sin failureReason.
        const byRecruiter = !!c.statusUpdatedAt || !c.failureReason;
        if (byRecruiter || !jobOpen) return { key: 'closed', label: 'Proceso finalizado' };
        return { key: 'review', label: 'En revisión' };
    }
    return jobOpen ? { key: 'review', label: 'En revisión' } : { key: 'closed', label: 'Proceso finalizado' };
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

    try {
        const { idToken } = JSON.parse(event.body || '{}');
        const verified = await verifyIdToken(idToken);
        if (!verified) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sesión inválida' }) };

        const snap = await adminDb.collectionGroup('candidates').where('userId', '==', verified.uid).get();
        // Solo postulaciones a vacantes (jobs/{jobId}/candidates/{id})
        const apps = snap.docs.filter((d) => d.ref.parent.parent?.parent.id === 'jobs');
        if (apps.length === 0) return { statusCode: 200, headers, body: JSON.stringify({ applications: [] }) };

        const jobRefs = [...new Map(apps.map((d) => [d.ref.parent.parent!.id, d.ref.parent.parent!])).values()];
        const jobSnaps = await adminDb.getAll(...jobRefs);
        const jobs = new Map(jobSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

        const companyIds = [...new Set([...jobs.values()].filter((j) => !j.isConfidential && j.companyId).map((j) => j.companyId as string))];
        const companySnaps = companyIds.length
            ? await adminDb.getAll(...companyIds.map((id) => adminDb.collection('users_empresas').doc(id)))
            : [];
        const companyNames = new Map(companySnaps.map((s) => {
            const d = s.exists ? s.data()! : {};
            return [s.id, d.company?.name || d.nombreComercial || d.aiContext?.nombre || 'Empresa'];
        }));

        const applications = apps.flatMap((d) => {
            const jobId = d.ref.parent.parent!.id;
            const job = jobs.get(jobId);
            if (!job) return []; // vacante eliminada
            const c = d.data();
            const jobOpen = job.status !== 'Closed' && !!job.isExternal;
            return [{
                jobId,
                jobTitle: job.jobTitle || job.title || 'Vacante',
                company: job.isConfidential
                    ? (job.confidentialLabel?.trim() || 'Empresa Confidencial')
                    : (companyNames.get(job.companyId) || 'Empresa'),
                appliedAt: toIso(c.appliedAt) || toIso(c.analyzedAt),
                updatedAt: toIso(c.statusUpdatedAt),
                jobOpen,
                status: publicStatus(c, jobOpen),
            }];
        });

        applications.sort((a, b) => (b.appliedAt || '').localeCompare(a.appliedAt || ''));
        return { statusCode: 200, headers, body: JSON.stringify({ applications }) };
    } catch (error: any) {
        console.error('❌ Error en my-applications.ts:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
    }
};
