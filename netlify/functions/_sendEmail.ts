/**
 * _sendEmail.ts — Envío de correo compartido vía SMTP (nodemailer).
 * Prefijo _ para que Netlify NO lo exponga como endpoint público.
 * Usado tanto por send-email.ts (llamado desde el cliente) como por
 * otras Functions server-to-server (ej. stripe-webhook.ts) sin pasar
 * por una llamada HTTP interna innecesaria.
 */
import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('Falta configuración SMTP en el servidor');
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const senderEmail = process.env.SMTP_FROM || 'oscar@relielabs.com';
    const senderName = 'Veritly';

    const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to,
        subject,
        html,
    });

    return info;
}
