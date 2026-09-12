// Consentimiento de cookies (GA / Meta Pixel / Clarity) - solo aplica en Web.
// En apps nativas no existen cookies de navegador, así que se trata como
// consentimiento implícito.

import { Platform } from 'react-native';

const STORAGE_KEY = 'veritly_cookie_consent';

export type ConsentStatus = 'accepted' | 'rejected' | null;

export const getConsent = (): ConsentStatus => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return 'accepted';
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        if (value === 'accepted' || value === 'rejected') return value;
        return null;
    } catch (e) {
        return null;
    }
};

export const setConsent = (status: 'accepted' | 'rejected') => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, status);
    } catch (e) {}
};
