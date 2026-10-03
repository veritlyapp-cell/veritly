/**
 * _sendEmail.ts — Envío de correo compartido vía SMTP (nodemailer).
 * Prefijo _ para que Netlify NO lo exponga como endpoint público.
 * Usado tanto por send-email.ts (llamado desde el cliente) como por
 * otras Functions server-to-server (ej. stripe-webhook.ts) sin pasar
 * por una llamada HTTP interna innecesaria.
 */
import nodemailer from 'nodemailer';

// Una sola conexion (pool) por instancia de la funcion: candidate-email
// manda varios correos seguidos y abrir una conexion SMTP por cada uno es lento.
let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('Falta configuración SMTP en el servidor');
    }
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false,
            pool: true,
            maxConnections: 3,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    return transporter;
}

export async function sendEmail({ to, subject, html, fromName = 'Veritly', replyTo }: {
    to: string;
    subject: string;
    html: string;
    fromName?: string; // nombre visible del remitente (la direccion siempre es la de Veritly)
    replyTo?: string;  // a donde llegan las respuestas
}) {
    const senderEmail = process.env.SMTP_FROM || 'oscar@relielabs.com';
    const safeName = fromName.replace(/["\\\r\n<>]/g, '').trim() || 'Veritly';

    return getTransporter().sendMail({
        from: `"${safeName}" <${senderEmail}>`,
        to,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
    });
}
