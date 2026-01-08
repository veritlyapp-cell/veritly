// Sentry Error Tracking for Veritly
// Configuración para capturar errores en producción

import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

const SENTRY_DSN = 'https://89fdfb10689a57bb7497db7cd5a244ce@o4510660612784128.ingest.us.sentry.io/4510660634542080';

// Inicializar Sentry (llamar una vez al cargar la app)
export const initSentry = () => {
    // Solo inicializar en producción o si estamos en web
    if (__DEV__ && Platform.OS !== 'web') {
        console.log('🔧 Sentry: Modo desarrollo, no inicializado');
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,

        // Environment
        environment: __DEV__ ? 'development' : 'production',

        // Configuración de performance
        tracesSampleRate: 0.2, // 20% de las transacciones

        // Opciones adicionales
        enableAutoSessionTracking: true,
        sessionTrackingIntervalMillis: 30000,

        // Filtrar errores de desarrollo
        beforeSend(event) {
            // No enviar errores en desarrollo (excepto web para testing)
            if (__DEV__ && Platform.OS !== 'web') {
                return null;
            }
            return event;
        },
    });

    console.log('📊 Sentry inicializado correctamente');
};

// --- FUNCIONES HELPER ---

// Capturar error manualmente
export const captureError = (error: Error, context?: Record<string, any>) => {
    if (context) {
        Sentry.setContext('extra', context);
    }
    Sentry.captureException(error);
};

// Capturar mensaje
export const captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
    Sentry.captureMessage(message, level);
};

// Establecer usuario actual
export const setUser = (userId: string, email?: string) => {
    Sentry.setUser({
        id: userId,
        email: email,
    });
};

// Limpiar usuario (logout)
export const clearUser = () => {
    Sentry.setUser(null);
};

// Agregar breadcrumb (rastro de navegación)
export const addBreadcrumb = (category: string, message: string, data?: Record<string, any>) => {
    Sentry.addBreadcrumb({
        category,
        message,
        data,
        level: 'info',
    });
};

// Wrapper para funciones async que pueden fallar
export const withErrorTracking = async <T>(
    fn: () => Promise<T>,
    context: string
): Promise<T | null> => {
    try {
        return await fn();
    } catch (error) {
        captureError(error as Error, { context });
        throw error;
    }
};
