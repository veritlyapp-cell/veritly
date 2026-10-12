import { Handler } from '@netlify/functions';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_firebaseAdmin';
import { verifyIdToken } from './_verifyAuth';
import { getCorsHeaders, checkRateLimit } from './_security';
import { getSalaryRange, getMaxReasonableSalary } from '../../utils/salaryRange';
import { getActiveKillerQuestions, passesKillerQuestion } from '../../utils/killerQuestions';
import { canonicalCity, livesInOtherCity } from '../../utils/jobLocation';
import { isJobExpired } from '../../utils/jobExpiry';
import { MIN_AGE, ageAt, ageBracket, isValidBirthDate, isValidGender } from '../../utils/demographics';

// Guarda la postulacion de un candidato y decide los descartes automaticos
// (sueldo, pais, preguntas filtro) en el servidor. Antes se evaluaba en el
// navegador, que para eso necesitaba las respuestas correctas y el presupuesto:
// cualquiera podia leerlos. Misma logica que antes (utils/salaryRange.ts y
// utils/killerQuestions.ts), mismo documento resultante.

const ID_RE = /^[A-Za-z0-9_-]{10,40}$/;
const BUCKET_PREFIX = 'https://firebasestorage.googleapis.com/v0/b/vinku-3a3af.firebasestorage.app/o/';
const MAX_BASE64 = 900 * 1024; // el doc privado del CV debe caber en el limite de 1 MB de Firestore

const str = (v: any, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

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
        const body = JSON.parse(event.body || '{}');
        const verified = await verifyIdToken(body.idToken);
        if (!verified) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sesión inválida. Vuelve a iniciar sesión.' }) };

        const jobId = String(body.jobId || '');
        if (!ID_RE.test(jobId)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Vacante inválida' }) };

        const fullName = str(body.fullName, 120);
        const phone = str(body.phone, 40);
        const country = str(body.country, 60);
        const city = canonicalCity(str(body.city, 60)); // "cuzco" -> "Cusco"
        const cvFileName = str(body.cvFileName, 200);
        const salaryExpectation = Number(body.salaryExpectation);
        const killerAnswers = body.killerAnswers && typeof body.killerAnswers === 'object' ? body.killerAnswers : {};
        const cvUrl = typeof body.cvUrl === 'string' && body.cvUrl.startsWith(BUCKET_PREFIX) ? body.cvUrl : null;
        const cvBase64 = typeof body.cvBase64 === 'string' && body.cvBase64.length <= MAX_BASE64 ? body.cvBase64 : null;

        if (!fullName || !phone) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nombre y teléfono son obligatorios.' }) };
        if (!cvUrl && !cvBase64) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta tu CV.' }) };

        const jobRef = adminDb.collection('jobs').doc(jobId);
        const jobSnap = await jobRef.get();
        const job = jobSnap.data();
        if (!jobSnap.exists || !job?.isExternal || job.status === 'Closed' || isJobExpired(job)) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Esta vacante ya no recibe postulaciones.' }) };
        }

        const currency = job.currency || 'S/';
        if (!(salaryExpectation > 0) || salaryExpectation > getMaxReasonableSalary(currency)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Revisa tu expectativa salarial.' }) };
        }

        // Descartes automaticos: misma logica que tenia el navegador
        // Fecha de nacimiento y genero: del perfil, o los que manda la primera
        // postulacion. Solo para estadisticas: no se copian a la postulacion que
        // ve la empresa ni se usan en el analisis.
        const userRef = adminDb.collection('users_candidatos').doc(verified.uid);
        const stored = (await userRef.get()).data()?.demographics;
        const hasStored = isValidBirthDate(stored?.birthDate) && isValidGender(stored?.gender);
        const birthDate: string = hasStored ? stored.birthDate : body.birthDate;
        const gender: string = hasStored ? stored.gender : body.gender;
        if (!isValidBirthDate(birthDate) || !isValidGender(gender)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Completa tu fecha de nacimiento y género.' }) };
        }
        if (ageAt(birthDate) < MIN_AGE) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: `Debes ser mayor de ${MIN_AGE} años para postular.` }) };
        }

        const range = getSalaryRange(job);
        const isSalaryRejected = !!range && (salaryExpectation > range.max || salaryExpectation < range.min);

        let failureReason = '';
        let isCountryRejected = false;
        if (Array.isArray(job.allowedCountries) && job.allowedCountries.length > 0 && !job.allowedCountries.includes(country)) {
            isCountryRejected = true;
            failureReason = 'No reside en los países permitidos para esta oferta.';
        }
        const activeQuestions = getActiveKillerQuestions(job);
        if (activeQuestions.some((_: any, idx: number) => killerAnswers[idx] === undefined)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Responde todas las preguntas de la oferta.' }) };
        }
        let isKillerRejected = false;
        activeQuestions.forEach((q: any, idx: number) => {
            if (!passesKillerQuestion(q, killerAnswers[idx])) {
                isKillerRejected = true;
                failureReason = 'No cumple con requisitos críticos (Killer Questions).';
            }
        });
        const isRejected = isSalaryRejected || isKillerRejected || isCountryRejected;
        const status = isRejected ? (isSalaryRejected ? 'rejected_salary' : 'rejected') : null;

        // Una postulacion por candidato y vacante (el id del doc es su uid)
        const candidateRef = jobRef.collection('candidates').doc(verified.uid);
        const created = await adminDb.runTransaction(async (tx) => {
            if ((await tx.get(candidateRef)).exists) return false;
            tx.set(candidateRef, {
                fullName,
                email: (verified.email || str(body.email, 200)).toLowerCase(),
                phone,
                country,
                city,
                // Vive en otra ciudad que la de una vacante presencial/hibrida: no
                // descarta, se marca en el pipeline y la IA lo considera
                otherCity: livesInOtherCity(job, { city, country }),
                salaryExpectation,
                cvUrl,
                originalFileUrl: cvUrl,
                cvFileName,
                appliedAt: FieldValue.serverTimestamp(),
                status: status || 'pending_ai',
                recruitmentStatus: status || 'screening',
                // Primera entrada del historial de etapas (Indicadores: tiempos)
                statusHistory: [{ status: status || 'screening', at: new Date().toISOString(), by: 'postulacion' }],
                failureReason: isSalaryRejected ? 'Presupuesto fuera de rango' : (isCountryRejected ? 'No reside en el país solicitado' : failureReason),
                killerAnswers,
                source: 'external_link',
                userId: verified.uid,
                jobId,
                companyId: job.companyId || '',
            });
            // CV en base64 solo si la subida a Storage fallo: doc aparte para que
            // la lista del reclutador no descargue el archivo de cada postulante
            if (cvBase64) tx.set(candidateRef.collection('private').doc('cv'), { cvBase64 });
            if (!hasStored) tx.set(userRef, { demographics: { birthDate, gender, updatedAt: new Date().toISOString() } }, { merge: true });
            // Data de mercado (Indicadores de admin): anonima, sin nombre ni contacto,
            // edad en rango. Solo la lee el admin (firestore.rules).
            tx.set(adminDb.collection('market_applications').doc(`${jobId}_${verified.uid}`), {
                appliedAt: FieldValue.serverTimestamp(),
                jobId,
                companyId: job.companyId || '',
                jobTitle: job.jobTitle || '',
                area: job.area || null,
                workMode: job.workMode || null,
                employmentType: job.employmentType || null,
                jobCountry: job.country || job.allowedCountries?.[0] || null,
                jobCity: job.city || null,
                currency,
                offeredMin: range?.min ?? null,
                offeredMax: range?.max ?? null,
                candidateCountry: country || null,
                candidateCity: city || null,
                otherCity: livesInOtherCity(job, { city, country }),
                salaryExpectation,
                ageBracket: ageBracket(ageAt(birthDate)),
                gender,
                autoStatus: status || null,
            });
            tx.update(jobRef, { applicantsCount: FieldValue.increment(1) });
            return true;
        });

        if (!created) return { statusCode: 409, headers, body: JSON.stringify({ error: 'Ya te has postulado a esta vacante anteriormente.' }) };
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (e: any) {
        console.error('❌ Error en submit-application.ts:', e);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo guardar tu postulación. Intenta de nuevo.' }) };
    }
};
