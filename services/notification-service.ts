
import { getAppConfig } from './credits-service';

/**
 * Sends a notification to the admin dashboard/email.
 * Currently simulates email sending by logging to console, as no backend is connected.
 * 
 * TODO: Integrate with EmailJS, SendGrid, or Firebase Functions for real emails.
 */
export const sendAdminNotification = async (
    type: 'candidate' | 'company',
    details: { name: string; email: string; id?: string; phone?: string; location?: string }
) => {
    try {
        const config = await getAppConfig();

        // 1. Check if notifications are enabled globally or for specific type
        if (!config.notifications) {
            console.log("🔕 [Notification] Notifications object missing in config.");
            return;
        }

        const adminEmail = config.notifications.adminEmail;
        if (!adminEmail) {
            console.log("🔕 [Notification] No admin email configured.");
            return;
        }

        const shouldSend = type === 'candidate'
            ? config.notifications.newCandidateEmail
            : config.notifications.newCompanyEmail;

        if (!shouldSend) {
            console.log(`🔕 [Notification] Notifications disabled for type: ${type}`);
            return;
        }

        // 2. Prepare message
        const subject = type === 'candidate'
            ? `👨‍💼 Nuevo Candidato: ${details.name}`
            : `🏢 Nueva Empresa: ${details.name}`;

        const body = `
        Hola Admin,
        
        Un nuevo ${type === 'candidate' ? 'candidato' : 'una empresa'} se ha registrado en Veritly.
        
        Detalles:
        - Nombre: ${details.name}
        - Email: ${details.email}
        ${details.id ? `- ID (RUC/DNI): ${details.id}` : ''}
        ${details.phone ? `- Teléfono: ${details.phone}` : ''}
        ${details.location ? `- Ubicación: ${details.location}` : ''}
        
        Fecha: ${new Date().toLocaleString()}
        `;

        // 3. Send Notification via Netlify Function
        console.log(`📧 [Notification] Sending email via Resend...`);

        const response = await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: adminEmail,
                subject: subject,
                html: body.replace(/\n/g, '<br>') // Simple conversion to HTML
            })
        });

        if (response.ok) {
            console.log(`✅ [Notification] Email sent successfully.`);
        } else {
            console.error(`❌ [Notification] Failed to send email: ${response.statusText}`);
            const errorData = await response.json();
            console.error('Error Details:', errorData);
        }

    } catch (error) {
        console.error("❌ Error sending admin notification:", error);
    }
};
