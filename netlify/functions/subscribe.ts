import { Handler } from '@netlify/functions';
const Culqi = require('@culqi/culqi-node');

const CULQI_PRIVATE_KEY = process.env.CULQI_PRIVATE_KEY;

export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
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
        const { token, email, planId, userId } = JSON.parse(event.body || '{}');

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

        const culqi = new Culqi(CULQI_PRIVATE_KEY);

        // 1. Crear Cliente en Culqi
        const customer = await culqi.customers.create({
            first_name: 'Usuario',
            last_name: 'Veritly',
            email: email,
            address: 'Lima, Peru',
            address_city: 'Lima',
            country_code: 'PE',
            phone_number: '999999999'
        });

        // 2. Asociar Tarjeta (Token) al Cliente
        const card = await culqi.cards.create({
            customer_id: customer.id,
            token_id: token
        });

        // 3. Crear Suscripción
        const subscription = await culqi.subscriptions.create({
            card_id: card.id,
            plan_id: planId // El ID del plan creado en el panel de Culqi (ej: "plan_pro_5")
        });

        // NOTA: Aquí deberías actualizar Firebase, pero como esto corre en Netlify 
        // y no tenemos el Admin SDK configurado aquí de forma simple ahora,
        // devolveremos éxito y el frontend confirmará el cambio o usaremos un webhook luego.
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
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
