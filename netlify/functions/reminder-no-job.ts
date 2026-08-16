/**
 * reminder-no-job.ts — Netlify Scheduled Function.
 * Corre cada hora y envía un email a las empresas que se registraron
 * hace 24-48h pero todavía no publicaron ninguna vacante (activación).
 */
import { schedule } from '@netlify/functions';
import { adminDb } from './_firebaseAdmin';
import { sendEmail } from './_sendEmail';

async function run() {
    const now = Date.now();
    const windowStart = new Date(now - 48 * 60 * 60 * 1000);
    const windowEnd = new Date(now - 24 * 60 * 60 * 1000);

    const usersSnap = await adminDb.collection('users_empresas')
        .where('createdAt', '>=', windowStart)
        .where('createdAt', '<=', windowEnd)
        .get();

    console.log(`🔍 [reminder-no-job] ${usersSnap.size} empresas registradas en la ventana 24-48h`);

    for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();

        if (data.activationReminderSentAt) continue; // ya se le envió antes
        if (!data.email) continue;

        const jobsSnap = await adminDb.collection('jobs')
            .where('companyId', '==', userDoc.id)
            .limit(1)
            .get();

        if (!jobsSnap.empty) continue; // ya publicó, no molestar

        const nombre = data.company?.name || 'ahí';

        try {
            await sendEmail({
                to: data.email,
                subject: 'Tu primera vacante en Veritly te toma 2 minutos',
                html: `
                    <div style="font-family: sans-serif; color: #111827; max-width: 480px; margin: 0 auto;">
                        <h2 style="color: #4F46E5;">Hola, ${nombre} 👋</h2>
                        <p>Vimos que creaste tu cuenta en Veritly pero todavía no publicaste tu primera vacante.</p>
                        <p>Publicar un puesto toma menos de 2 minutos: pega la descripción (o usa nuestro ejemplo precargado) y la IA arma el anuncio y las preguntas filtro por ti.</p>
                        <p style="margin-top: 24px;">
                            <a href="https://www.veritlyapp.com/empresa/dashboard/job/create" style="background: #4F46E5; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">Publicar mi primera vacante</a>
                        </p>
                        <p style="margin-top: 24px; color: #6B7280; font-size: 13px;">— El equipo de Veritly</p>
                    </div>
                `
            });

            await userDoc.ref.update({ activationReminderSentAt: new Date().toISOString() });
            console.log(`✅ [reminder-no-job] Recordatorio enviado a ${data.email}`);
        } catch (e: any) {
            console.error(`❌ [reminder-no-job] Error enviando a ${data.email}:`, e?.message || e);
        }
    }
}

const handlerFn = async () => {
    try {
        await run();
        return { statusCode: 200, body: 'OK' };
    } catch (e: any) {
        console.error('❌ [reminder-no-job] Error general:', e?.message || e);
        return { statusCode: 500, body: 'Error' };
    }
};

// Corre cada hora — dentro de esa hora captura a quienes cayeron en la ventana 24-48h
export const handler = schedule('0 * * * *', handlerFn);
