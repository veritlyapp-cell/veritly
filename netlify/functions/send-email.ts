
import { Handler } from '@netlify/functions';
import { sendEmail } from './_sendEmail';

export const handler: Handler = async (event, context) => {
    // CORS Headers
    // A-01 FIX: CORS restringido a los dominios de Veritly (previene uso como relay de spam)
    const origin = event.headers.origin || event.headers.Origin || '';
    const isNetlifyPreview = origin.endsWith('.netlify.app');
    const allowedOrigins = ['https://www.veritlyapp.com', 'https://veritlyapp.com'];
    const corsOrigin = (allowedOrigins.includes(origin) || isNetlifyPreview) ? origin : allowedOrigins[0];

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
        const { to, subject, html } = JSON.parse(event.body || '{}');

        if (!to || !subject || !html) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: to, subject, html' })
            };
        }

        const info = await sendEmail({ to, subject, html });

        console.log("✅ Email sent via SMTP:", info.messageId);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: "Email sent successfully", id: info.messageId })
        };

    } catch (error: any) {
        console.error("❌ Error sending email:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal Server Error' })
        };
    }
};
