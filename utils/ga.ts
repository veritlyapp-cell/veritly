// Google Analytics 4 - Utility for Veritly
// Funciona solo en Web (en native se ignora silenciosamente)

import { Platform } from 'react-native';

// Tu ID de medición de GA4
const GA_MEASUREMENT_ID = 'G-D94XZ14J2S';

// Inicializar GA4 (llamar una vez al cargar la app)
export const initGA = () => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    // Evitar doble inicialización
    if ((window as any).gaInitialized) return;

    // Crear script de gtag
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script1);

    // Configurar gtag
    const script2 = document.createElement('script');
    script2.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            send_page_view: true
        });
    `;
    document.head.appendChild(script2);

    (window as any).gaInitialized = true;
    console.log('📊 Google Analytics inicializado');
};

// Helper para enviar eventos
const gtag = (...args: any[]) => {
    if (Platform.OS !== 'web') return;
    if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag(...args);
    }
};

// --- EVENTOS DE USUARIO ---

export const trackPageView = (pageName: string) => {
    gtag('event', 'page_view', {
        page_title: pageName,
        page_path: `/${pageName}`
    });
};

export const trackLogin = (method: string = 'email') => {
    gtag('event', 'login', {
        method: method
    });
};

export const trackSignUp = (method: string = 'email') => {
    gtag('event', 'sign_up', {
        method: method
    });
};

// --- EVENTOS DE NEGOCIO ---

export const trackScan = (scanType: 'image' | 'text' | 'link') => {
    gtag('event', 'scan_analysis', {
        scan_type: scanType,
        event_category: 'engagement'
    });
};

export const trackProfileComplete = () => {
    gtag('event', 'profile_complete', {
        event_category: 'engagement'
    });
};

export const trackCreditPurchase = (packageName: string, credits: number, amount: number) => {
    gtag('event', 'purchase', {
        currency: 'USD',
        value: amount,
        items: [{
            item_name: packageName,
            quantity: credits
        }]
    });
};

// --- EVENTOS DE EMPRESA ---

export const trackJobCreated = () => {
    gtag('event', 'job_created', {
        event_category: 'company'
    });
};

export const trackCandidateAnalyzed = () => {
    gtag('event', 'candidate_analyzed', {
        event_category: 'company'
    });
};

// --- CONFIGURAR USUARIO ---

export const setUserId = (userId: string) => {
    gtag('config', GA_MEASUREMENT_ID, {
        user_id: userId
    });
};

export const setUserProperties = (properties: Record<string, any>) => {
    gtag('set', 'user_properties', properties);
};
