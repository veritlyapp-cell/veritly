import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { adminDb } from './_firebaseAdmin';
import { sendEmail } from './_sendEmail';
import { buildPlanActivatedEmail } from './_emailTemplates';
import { FREE_PLAN_ID, periodEndIso, planSubscriptionFields } from './_planFields';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Sin CORS ni rate limit propios: este endpoint solo lo llama Stripe,
// autenticado por la firma del webhook (no por origen ni IP).
export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
        console.error("❌ Falta STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET");
        return { statusCode: 500, body: 'Server configuration error' };
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const signature = event.headers['stripe-signature'];

    if (!signature) {
        return { statusCode: 400, body: 'Missing stripe-signature header' };
    }

    // Stripe exige el body crudo (sin parsear) para verificar la firma.
    const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64')
        : (event.body || '');

    let stripeEvent: Stripe.Event;
    try {
        stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
        console.error("❌ Firma de webhook inválida:", err.message);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    try {
        switch (stripeEvent.type) {
            case 'checkout.session.completed': {
                const session = stripeEvent.data.object as Stripe.Checkout.Session;
                const { userId, planId, billingPeriod } = session.metadata || {};

                if (!userId || !planId) {
                    console.error("⚠️ checkout.session.completed sin metadata userId/planId");
                    break;
                }

                let planData: any = null;
                try {
                    const planDoc = await adminDb.collection('config_plans').doc(planId).get();
                    if (planDoc.exists) planData = planDoc.data();
                } catch (e) {
                    console.error("⚠️ No se pudo leer el plan:", e);
                }

                // Fecha de renovacion (para mostrar "se renueva el ...")
                let currentPeriodEnd: string | null = null;
                try {
                    if (session.subscription) currentPeriodEnd = periodEndIso(await stripe.subscriptions.retrieve(session.subscription as string));
                } catch (e) {
                    console.error("⚠️ No se pudo leer la suscripción para la fecha de renovación:", e);
                }

                console.log(`💳 [stripe-webhook] Pago confirmado. Activando plan '${planId}' para: ${userId}`);
                await adminDb.collection('users_empresas').doc(userId).set({
                    subscription: {
                        ...(await planSubscriptionFields(planId)),
                        candidatesAnalyzed: 0,
                        currentPeriodEnd,
                        cancelAtPeriodEnd: false,
                        billingPeriod: billingPeriod || 'monthly',
                        stripeCustomerId: session.customer as string,
                        stripeSubscriptionId: session.subscription as string,
                        activatedAt: new Date().toISOString(),
                        status: 'active'
                    }
                }, { merge: true });
                console.log(`✅ [stripe-webhook] Plan '${planId}' activado para: ${userId}`);

                try {
                    const toEmail = session.customer_details?.email;
                    if (toEmail) {
                        const { subject, html } = buildPlanActivatedEmail({
                            companyName: session.customer_details?.name || 'equipo',
                            planName: planData?.name || planId,
                            aiAnalysisLimit: planData?.aiAnalysisLimit,
                            internalVacanciesLimit: planData?.internalVacanciesLimit,
                            killerQuestionsLimit: planData?.killerQuestionsLimit,
                            features: planData?.features,
                        });
                        await sendEmail({ to: toEmail, subject, html });
                        console.log(`✉️ [stripe-webhook] Correo de plan activado enviado a: ${toEmail}`);
                    }
                } catch (emailError) {
                    console.error("⚠️ [stripe-webhook] No se pudo enviar el correo de plan activado:", emailError);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = stripeEvent.data.object as Stripe.Subscription;
                const { userId } = subscription.metadata || {};
                if (!userId) break;

                // Solo si es la suscripcion vigente de la cuenta (no una anterior
                // reemplazada por otra compra)
                const companyRef = adminDb.collection('users_empresas').doc(userId);
                const current = (await companyRef.get()).data()?.subscription || {};
                if (current.stripeSubscriptionId && current.stripeSubscriptionId !== subscription.id) break;

                // Termino el plan pagado: vuelve a Freemium con sus limites (antes
                // quedaba status 'expired' pero con el plan y sus funciones)
                console.log(`🚫 [stripe-webhook] Suscripción terminada, pasa a Freemium: ${userId}`);
                await companyRef.set({
                    subscription: {
                        ...(await planSubscriptionFields(FREE_PLAN_ID)),
                        status: 'active',
                        previousPlanId: current.planId || null,
                        changedToFreeAt: new Date().toISOString(),
                        stripeSubscriptionId: null,
                        cancelAtPeriodEnd: false,
                        currentPeriodEnd: null,
                    }
                }, { merge: true });
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = stripeEvent.data.object as Stripe.Subscription;
                const { userId } = subscription.metadata || {};
                if (!userId) break;

                // Renovacion y cambio programado a Freemium (cancel_at_period_end)
                const periodFields = { currentPeriodEnd: periodEndIso(subscription), cancelAtPeriodEnd: subscription.cancel_at_period_end };
                if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
                    await adminDb.collection('users_empresas').doc(userId).set({
                        subscription: { status: 'expired', ...periodFields }
                    }, { merge: true });
                } else if (subscription.status === 'active') {
                    await adminDb.collection('users_empresas').doc(userId).set({
                        subscription: { status: 'active', ...periodFields }
                    }, { merge: true });
                }
                break;
            }

            default:
                break;
        }

        return { statusCode: 200, body: JSON.stringify({ received: true }) };
    } catch (error: any) {
        console.error("❌ Error procesando webhook de Stripe:", error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};
