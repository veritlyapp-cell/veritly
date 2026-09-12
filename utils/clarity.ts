// Microsoft Clarity - Utility for Veritly
// Funciona solo en Web (en native se ignora silenciosamente)

import { Platform } from 'react-native';

const CLARITY_PROJECT_ID = 'wtd5oxqm6k';

export const initClarity = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if ((window as any).clarityInitialized) return;
    (window as any).clarityInitialized = true;

    (function (c: any, l: any, a: any, r: any, i: any, t?: any, y?: any) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
};
