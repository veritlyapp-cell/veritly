import Stripe from 'stripe';
import { adminDb } from './_firebaseAdmin';

// Plan gratuito al que vuelve una cuenta cuando termina (o cancela) su plan pagado
export const FREE_PLAN_ID = 'beta_free';

// Campos de users_empresas.subscription que salen del plan (config_plans):
// los limites que leen la app y las funciones. Mismos valores por defecto que
// tenia stripe-webhook.ts.
export async function planSubscriptionFields(planId: string) {
    let plan: any = null;
    try {
        const snap = await adminDb.collection('config_plans').doc(planId).get();
        if (snap.exists) plan = snap.data();
    } catch (e) {
        console.error('⚠️ No se pudo leer el plan', planId, e);
    }
    return {
        planId,
        plan: plan?.name || planId,
        aiAnalysisLimit: plan?.aiAnalysisLimit || 200,
        internalVacanciesLimit: plan?.internalVacanciesLimit || 5,
        publicVacanciesLimit: plan?.publicVacanciesLimit || 3,
        killerQuestionsLimit: plan?.killerQuestionsLimit || 2,
    };
}

// Fin del periodo pagado. En las versiones nuevas de la API de Stripe esta en
// cada item de la suscripcion; en las antiguas, en la suscripcion.
export function periodEndIso(sub: Stripe.Subscription): string | null {
    const seconds = (sub as any).current_period_end ?? (sub.items?.data?.[0] as any)?.current_period_end;
    return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}
