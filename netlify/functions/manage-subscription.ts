import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { adminDb } from './_firebaseAdmin';
import { getCorsHeaders, checkRateLimit } from './_security';
import { verifyIdToken } from './_verifyAuth';
import { FREE_PLAN_ID, periodEndIso, planSubscriptionFields } from './_planFields';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Cambiar a Freemium y ver hasta cuando dura el plan pagado. Solo el dueño de
// la cuenta (no los miembros del equipo).
// - status: plan actual, fecha de renovacion o de fin, y si no vence (plan
//   asignado a mano, sin suscripcion de Stripe).
// - downgrade_to_free: con Stripe, se cancela al final del periodo ya pagado
//   (el plan sigue hasta esa fecha y stripe-webhook.ts lo pasa a Freemium
//   cuando Stripe borra la suscripcion). Sin Stripe, el cambio es inmediato.
// - resume: deshace el cambio programado (vuelve a renovarse).
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
        const { action, idToken, companyId } = JSON.parse(event.body || '{}');
        const verified = await verifyIdToken(idToken);
        if (!verified) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sesión inválida' }) };
        if (!companyId || verified.uid !== companyId) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Solo el dueño de la cuenta puede cambiar el plan.' }) };
        }

        const companyRef = adminDb.collection('users_empresas').doc(companyId);
        const sub: any = (await companyRef.get()).data()?.subscription || {};
        const planId: string = sub.planId || FREE_PLAN_ID;
        const isPaidPlan = planId !== FREE_PLAN_ID;
        const subscriptionId: string | undefined = sub.stripeSubscriptionId || undefined;
        const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

        if (action === 'status') {
            let currentPeriodEnd: string | null = sub.currentPeriodEnd || null;
            let cancelAtPeriodEnd = !!sub.cancelAtPeriodEnd;
            if (isPaidPlan && subscriptionId && stripe) {
                try {
                    const s = await stripe.subscriptions.retrieve(subscriptionId);
                    currentPeriodEnd = periodEndIso(s) || currentPeriodEnd;
                    cancelAtPeriodEnd = s.cancel_at_period_end;
                    await companyRef.set({ subscription: { currentPeriodEnd, cancelAtPeriodEnd } }, { merge: true });
                } catch (e: any) {
                    console.warn('⚠️ No se pudo leer la suscripcion de Stripe:', e.message);
                }
            }
            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    planId,
                    plan: sub.plan || null,
                    isPaidPlan,
                    // Plan pagado sin suscripcion de Stripe: asignado a mano, no vence
                    perpetual: isPaidPlan && !subscriptionId,
                    currentPeriodEnd,
                    cancelAtPeriodEnd,
                }),
            };
        }

        if (action === 'downgrade_to_free') {
            if (!isPaidPlan) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ya estás en el plan Freemium.' }) };

            if (subscriptionId) {
                if (!stripe) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuración del servidor incompleta.' }) };
                const s = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
                const currentPeriodEnd = periodEndIso(s);
                await companyRef.set({ subscription: { cancelAtPeriodEnd: true, currentPeriodEnd } }, { merge: true });
                return { statusCode: 200, headers, body: JSON.stringify({ scheduled: true, currentPeriodEnd }) };
            }

            // Plan asignado a mano: no hay periodo pagado, el cambio es inmediato
            const free = await planSubscriptionFields(FREE_PLAN_ID);
            await companyRef.set({
                subscription: {
                    ...free,
                    status: 'active',
                    previousPlanId: planId,
                    changedToFreeAt: new Date().toISOString(),
                    cancelAtPeriodEnd: false,
                    currentPeriodEnd: null,
                },
            }, { merge: true });
            return { statusCode: 200, headers, body: JSON.stringify({ immediate: true }) };
        }

        if (action === 'resume') {
            if (!subscriptionId || !stripe) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No hay una suscripción para reactivar.' }) };
            const s = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
            await companyRef.set({ subscription: { cancelAtPeriodEnd: false, currentPeriodEnd: periodEndIso(s) } }, { merge: true });
            return { statusCode: 200, headers, body: JSON.stringify({ resumed: true }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: `Acción no reconocida: ${action}` }) };
    } catch (e: any) {
        console.error('❌ Error en manage-subscription.ts:', e);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo cambiar el plan. Intenta de nuevo.' }) };
    }
};
