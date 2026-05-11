
import { Handler } from '@netlify/functions';
import nodemailer from 'nodemailer';

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

        // SMTP Configuration
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error("❌ Missing SMTP configuration in environment variables");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false, // true for 465, false for 587
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // [UPDATE] Sender Address Logic
        // Brevo requires the sender email to be verified.
        // We prioritize SMTP_FROM env var, then fallback to a hardcoded verified email (user's email),
        // then try a generic one (which might fail).
        const senderEmail = process.env.SMTP_FROM || 'oscar@relielabs.com';
        const senderName = 'Veritly Admin';

        const info = await transporter.sendMail({
            from: `"${senderName}" <${senderEmail}>`, // Sender address
            to: to, // Receiver
            subject: subject, // Subject line
            html: html, // HTML body
        });

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
