import { Handler } from '@netlify/functions';
import { initializeApp, getApps } from 'firebase/app';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
const Culqi = require('culqi-node');

const CULQI_PRIVATE_KEY = process.env.CULQI_PRIVATE_KEY;

// Firebase (mismo config que save-match.ts)
const firebaseConfig = {
    apiKey: "AIzaSyBbQwiklf0kWnz5V2_l6PgPeL679NyGEJ8",
    authDomain: "auth.veritlyapp.com",
    projectId: "vinku-3a3af",
    storageBucket: "vinku-3a3af.firebasestorage.app",
    messagingSenderId: "1052083063406",
    appId: "1:1052083063406:web:20b981e0bf896caa7ab47f"
};

// Evitar inicializar Firebase múltiples veces en funciones calientes
const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(fbApp);

// Fallback Mapa de planId (Culqi) → datos del plan en Veritly en caso de que falle la DB
const PLAN_MAP_FALLBACK: Record<string, { name: string; aiAnalysisLimit: number; internalVacanciesLimit: number; publicVacanciesLimit: number }> = {
    'plan_pro':       { name: 'pro',        aiAnalysisLimit: 500,  internalVacanciesLimit: 20, publicVacanciesLimit: 5 },
    'plan_gold':      { name: 'gold',       aiAnalysisLimit: 2000, internalVacanciesLimit: 50, publicVacanciesLimit: 15 },
    'plan_enterprise':{ name: 'enterprise', aiAnalysisLimit: 9999, internalVacanciesLimit: 999, publicVacanciesLimit: 999 },
};

export const handler: Handler = async (event) => {
    // A-01: CORS restringido a los dominios de Veritly
    const allowedOrigins = ['https://www.veritlyapp.com', 'https://veritlyapp.com'];
    const origin = event.headers.origin || event.headers.Origin || '';
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Vary': 'Origin',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        // B-02: Ahora recibimos datos reales de la empresa desde el frontend
        const { token, email, planId, userId, companyName, companyPhone } = JSON.parse(event.body || '{}');

        if (!token || !email || !planId || !userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Faltan datos requeridos (token, email, planId, userId)' })
            };
        }

        if (!CULQI_PRIVATE_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Configuración del servidor incompleta (CULQI_PRIVATE_KEY)' })
            };
        }

        // B-03: Intentar obtener configuración dinámica del plan desde Firestore
        let planData: any = PLAN_MAP_FALLBACK[planId];
        try {
            const planDoc = await getDoc(doc(db, 'config_plans', planId));
            if (planDoc.exists()) {
                planData = planDoc.data();
                if (!planData.name) planData.name = planId; // Fallback name
            }
        } catch (e) {
            console.error("⚠️ [subscribe] Error al obtener plan de DB, usando fallback:", e);
        }

        if (!planData) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `Plan no reconocido: ${planId}` })
            };
        }

        const culqi = new Culqi(CULQI_PRIVATE_KEY);

        // B-02 FIX: Usar datos reales de la empresa para que el panel de Culqi sea auditable
        const nameParts = (companyName || 'Empresa Veritly').trim().split(' ');
        const customer = await culqi.customers.create({
            first_name: nameParts[0] || 'Empresa',
            last_name: nameParts.slice(1).join(' ') || 'Veritly',
            email: email,
            address: 'Lima, Peru',
            address_city: 'Lima',
            country_code: 'PE',
            phone_number: (companyPhone || '999999999').replace(/\D/g, '').slice(-9)
        });

        // 2. Asociar Tarjeta (Token) al Cliente
        const card = await culqi.cards.create({
            customer_id: customer.id,
            token_id: token
        });

        // 3. Crear Suscripción
        const subscription = await culqi.subscriptions.create({
            card_id: card.id,
            plan_id: planId
        });

        // A-02 FIX: Actualizar Firebase DESDE EL BACKEND, no desde el frontend.
        // Esto garantiza que el plan se active incluso si el usuario cierra la ventana
        // o pierde conexión justo después del cobro.
        console.log(`💳 [subscribe] Pago confirmado. Actualizando plan en Firebase para: ${userId}`);
        await setDoc(doc(db, 'users_empresas', userId), {
            subscription: {
                plan: planData.name || planId,
                aiAnalysisLimit: planData.aiAnalysisLimit || 200,
                internalVacanciesLimit: planData.internalVacanciesLimit || 5,
                publicVacanciesLimit: planData.publicVacanciesLimit || 3,
                candidatesAnalyzed: 0, // Reset o mantener? Normalmente se mantiene el histórico pero se resetea la cuota si es un ciclo nuevo. 
                                       // Por ahora mantenemos la estructura.
                culqiSubscriptionId: subscription.id,
                culqiCustomerId: customer.id,
                activatedAt: new Date().toISOString(),
                status: 'active'
            }
        }, { merge: true });
        console.log(`✅ [subscribe] Plan '${planData.name}' activado en Firebase para: ${userId}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                plan: planData.name,
                subscriptionId: subscription.id,
                customerId: customer.id
            })
        };

    } catch (error: any) {
        console.error("❌ Error en Culqi Subscription:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Error interno al procesar suscripción' })
        };
    }
};

