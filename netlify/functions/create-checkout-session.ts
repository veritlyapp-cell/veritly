import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { adminDb } from './_firebaseAdmin';
import { getCorsHeaders, checkRateLimit } from './_security';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SITE_URL = 'https://www.veritlyapp.com';

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
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({ error: 'Demasiadas solicitudes. Intenta en 1 minuto.' })
        };
    }

    if (!STRIPE_SECRET_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Configuración del servidor incompleta (STRIPE_SECRET_KEY)' })
        };
    }

    try {
        const { planId, billingPeriod, userId, email } = JSON.parse(event.body || '{}');

        if (!planId || !billingPeriod || !userId || !email) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Faltan datos requeridos (planId, billingPeriod, userId, email)' })
            };
        }

        const planDoc = await adminDb.collection('config_plans').doc(planId).get();
        if (!planDoc.exists) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `Plan no reconocido: ${planId}` })
            };
        }
        const planData = planDoc.data()!;

        const priceId = billingPeriod === 'annual' ? planData.stripePriceIdAnnual : planData.stripePriceIdMonthly;
        if (!priceId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `El plan '${planId}' no tiene un Stripe Price ID configurado para ${billingPeriod === 'annual' ? 'facturación anual' : 'facturación mensual'}.` })
            };
        }

        const stripe = new Stripe(STRIPE_SECRET_KEY);

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer_email: email,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${SITE_URL}/empresa/dashboard/pricing?checkout=success`,
            cancel_url: `${SITE_URL}/empresa/dashboard/pricing?checkout=cancelled`,
            metadata: { userId, planId, billingPeriod },
            subscription_data: {
                metadata: { userId, planId, billingPeriod }
            }
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: session.url })
        };

    } catch (error: any) {
        console.error("❌ Error creando Checkout Session:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Error interno al crear la sesión de pago' })
        };
    }
};
