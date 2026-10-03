import { Handler } from '@netlify/functions';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { adminDb } from './_firebaseAdmin';
import { isCompanyMember, verifyIdToken } from './_verifyAuth';
import { getCorsHeaders, checkRateLimit } from './_security';
import { sendEmail } from './_sendEmail';

// Correo del reclutador a candidatos de una de sus vacantes (agradecimiento,
// invitacion a entrevista o mensaje libre), con {nombre} {puesto} {empresa}
// reemplazados por candidato.
//
// Seguridad: el cliente solo manda IDs de candidatos. Los emails se leen aca
// de jobs/{jobId}/candidates, despues de verificar que quien envia es de la
// empresa duena de la vacante; asi esta funcion no sirve para escribirle a
// cualquiera. Sale de la direccion de Veritly con el nombre de la empresa, y
// las respuestas van al correo del reclutador (Reply-To).

const MAX_PER_REQUEST = 25; // el cliente parte selecciones mas grandes en tandas
const MAX_SUBJECT = 200;
const MAX_BODY = 5000;
const CONCURRENCY = 5;

const ID_RE = /^[A-Za-z0-9_@.\-]{1,200}$/;
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fillTemplate = (text: string, vars: Record<string, string>) =>
    text.replace(/\{(nombre|puesto|empresa)\}/gi, (_, key) => vars[key.toLowerCase()] ?? '');

function buildHtml(body: string, vars: Record<string, string>, companyName: string) {
    const safeVars = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, escapeHtml(v)]));
    const content = fillTemplate(escapeHtml(body), safeVars).replace(/\r?\n/g, '<br>');
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:560px">
<p style="margin:0">${content}</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 12px">
<p style="margin:0;font-size:12px;color:#94a3b8">Enviado por ${escapeHtml(companyName)} a través de Veritly. Puedes responder directamente a este correo.</p>
</div>`;
}

async function getCompanyDisplayName(job: DocumentData): Promise<string> {
    // Vacante confidencial: nunca revelar la empresa real
    if (job.isConfidential) return job.confidentialLabel?.trim() || 'Empresa Confidencial';
    const snap = await adminDb.collection('users_empresas').doc(job.companyId).get();
    const d = snap.exists ? snap.data()! : {};
    return d.company?.name || d.nombreComercial || d.aiContext?.nombre || 'Empresa';
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
        const { idToken, jobId, candidateIds, subject, body } = JSON.parse(event.body || '{}');

        const verified = await verifyIdToken(idToken);
        if (!verified) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sesión inválida' }) };

        if (typeof jobId !== 'string' || !ID_RE.test(jobId)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta jobId' }) };
        }
        if (!Array.isArray(candidateIds) || candidateIds.length === 0 || candidateIds.length > MAX_PER_REQUEST
            || !candidateIds.every((c) => typeof c === 'string' && ID_RE.test(c))) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: `Envía entre 1 y ${MAX_PER_REQUEST} candidatos por vez` }) };
        }
        const cleanSubject = typeof subject === 'string' ? subject.replace(/[\r\n]+/g, ' ').trim() : '';
        const cleanBody = typeof body === 'string' ? body.trim() : '';
        if (!cleanSubject || cleanSubject.length > MAX_SUBJECT || !cleanBody || cleanBody.length > MAX_BODY) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Asunto o mensaje vacío o demasiado largo' }) };
        }

        const jobRef = adminDb.collection('jobs').doc(jobId);
        const jobSnap = await jobRef.get();
        if (!jobSnap.exists) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Vacante no encontrada' }) };
        const job = jobSnap.data()!;
        if (!(await isCompanyMember(verified.uid, job.companyId))) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'No autorizado' }) };
        }

        const companyName = await getCompanyDisplayName(job);
        const jobTitle = job.jobTitle || job.title || 'la vacante';
        const replyTo = verified.email && EMAIL_RE.test(verified.email) ? verified.email : undefined;

        const uniqueIds = [...new Set<string>(candidateIds)];
        const snaps = await Promise.all(uniqueIds.map((cid) => jobRef.collection('candidates').doc(cid).get()));

        const sent: string[] = [];
        const skipped: { id: string; reason: string }[] = [];
        const failed: { id: string; reason: string }[] = [];

        const toSend = snaps.flatMap((snap) => {
            if (!snap.exists) { skipped.push({ id: snap.id, reason: 'no existe' }); return []; }
            const c = snap.data()!;
            const email = String(c.email || '').trim();
            if (!EMAIL_RE.test(email)) { skipped.push({ id: snap.id, reason: 'sin email' }); return []; }
            const fullName = String(c.name || c.fullName || '').trim();
            const firstName = fullName.split(/\s+/)[0] || '';
            return [{ ref: snap.ref, id: snap.id, email, vars: { nombre: firstName, puesto: jobTitle, empresa: companyName } }];
        });

        for (let i = 0; i < toSend.length; i += CONCURRENCY) {
            await Promise.all(toSend.slice(i, i + CONCURRENCY).map(async (t) => {
                try {
                    await sendEmail({
                        to: t.email,
                        subject: fillTemplate(cleanSubject, t.vars),
                        html: buildHtml(cleanBody, t.vars, companyName),
                        fromName: `${companyName} vía Veritly`,
                        replyTo,
                    });
                    const sentAt = new Date().toISOString();
                    await t.ref.set({
                        lastEmailAt: sentAt,
                        emailLog: FieldValue.arrayUnion({ subject: fillTemplate(cleanSubject, t.vars), sentAt, by: verified.uid }),
                    }, { merge: true });
                    sent.push(t.id);
                } catch (e: any) {
                    console.error('candidate-email: fallo envio a', t.id, e?.message);
                    failed.push({ id: t.id, reason: 'error al enviar' });
                }
            }));
        }

        return { statusCode: 200, headers, body: JSON.stringify({ sent, skipped, failed }) };
    } catch (error: any) {
        console.error('❌ Error en candidate-email.ts:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
    }
};
