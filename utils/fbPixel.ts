// Meta Pixel (Facebook Ads) - Utility for Veritly
// Funciona solo en Web (en native se ignora silenciosamente)

import { Platform } from 'react-native';

// Pixel ID de la cuenta de Meta Business de Veritly
const FB_PIXEL_ID = '1668431677585947';

// Inicializar el Pixel (llamar una vez al cargar la app)
// Nunca debe poder romper el resto de la app: cualquier fallo (bloqueador de
// anuncios, extensión de privacidad, CSP, etc.) se traga en silencio.
export const initFbPixel = () => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    try {
        // Evitar doble inicialización, mismo patrón que initGA
        if ((window as any).fbPixelInitialized) return;
        (window as any).fbPixelInitialized = true;

        const w = window as any;
        const d = document;
        if (w.fbq) return;
        const n: any = (w.fbq = function () {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        });
        if (!w._fbq) w._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = '2.0';
        n.queue = [];
        const t = d.createElement('script');
        t.async = true;
        t.src = 'https://connect.facebook.net/en_US/fbevents.js';
        const s = d.getElementsByTagName('script')[0];
        if (s?.parentNode) {
            s.parentNode.insertBefore(t, s);
        } else {
            d.head.appendChild(t);
        }

        w.fbq('init', FB_PIXEL_ID);
        w.fbq('track', 'PageView');

        console.log('📊 Meta Pixel inicializado');
    } catch (e) {
        console.warn('⚠️ No se pudo inicializar el Meta Pixel (bloqueador de anuncios?):', e);
    }
};

const fbq = (...args: any[]) => {
    if (Platform.OS !== 'web') return;
    try {
        if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq(...args);
        }
    } catch (e) {
        console.warn('⚠️ Meta Pixel: evento no enviado:', e);
    }
};

// --- EVENTOS ---
// Nunca deben poder interrumpir el flujo que las llama (ej. registro de
// empresa): si el pixel falla, el negocio sigue funcionando igual.

// Se dispara cuando una empresa termina de crear su cuenta (el evento que
// le importa a la campaña de Meta Ads: mide registros reales, no solo clics)
export const trackCompleteRegistration = () => {
    fbq('track', 'CompleteRegistration');
};

export const trackLead = () => {
    fbq('track', 'Lead');
};
