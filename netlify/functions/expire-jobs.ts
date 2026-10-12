import { schedule } from '@netlify/functions';
import { adminDb } from './_firebaseAdmin';
import { JOB_ACTIVE_DAYS, isJobExpired } from '../../utils/jobExpiry';

// Todos los dias: las vacantes activas con mas de 60 dias desde su ultima
// publicacion pasan a inactivas (status 'Closed'). Los postulantes se quedan;
// la empresa la puede "Republicar" (misma vacante, fecha nueva) o "Copiar"
// (vacante nueva, sin postulantes) desde Mis Puestos.
const handlerFn = async () => {
    const snap = await adminDb.collection('jobs').get();
    const expired = snap.docs.filter((d) => {
        const job = d.data();
        return job.status !== 'Closed' && isJobExpired(job);
    });

    const now = new Date().toISOString();
    // Lotes de hasta 500 escrituras (limite de Firestore)
    for (let i = 0; i < expired.length; i += 450) {
        const batch = adminDb.batch();
        expired.slice(i, i + 450).forEach((d) => batch.update(d.ref, {
            status: 'Closed',
            closedReason: `vencida_${JOB_ACTIVE_DAYS}_dias`,
            closedAt: now,
        }));
        await batch.commit();
    }

    console.log(`⏰ [expire-jobs] ${expired.length} vacantes pasaron a inactivas (más de ${JOB_ACTIVE_DAYS} días)`);
    return { statusCode: 200, body: JSON.stringify({ expired: expired.length }) };
};

// 08:00 UTC (03:00 en Lima)
export const handler = schedule('0 8 * * *', handlerFn);
