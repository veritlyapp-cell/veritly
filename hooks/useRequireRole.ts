import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import { getCurrentUserRole, UserRole } from '../services/auth-service';

/**
 * Hook to protect routes based on user role
 * Redirects unauthorized users to appropriate pages
 * 
 * @param requiredRole - The role required to access this route
 * @returns loading and authorized states
 */
export function useRequireRole(requiredRole: UserRole) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        // Mark component as mounted
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const checkAuthorization = async (retryCount = 0) => {
            const MAX_RETRIES = 12; // 12 seconds total
            const RETRY_DELAY = 1000;

            try {
                const user = auth.currentUser;

                // 1. Verificar Autenticación
                if (!user) {
                    // Si no hay usuario, esperamos un poco (a veces Auth tarda en inicializar)
                    if (retryCount < 3) {
                        console.log(`⏳ [useRequireRole] Waiting for Firebase Auth (Attempt ${retryCount + 1})...`);
                        setTimeout(() => { if (isMounted) checkAuthorization(retryCount + 1); }, 500);
                        return;
                    }

                    console.log('↩️ [useRequireRole] Redirecting to empresa signin (No user)');
                    setTimeout(() => {
                        if (isMounted) router.replace('/empresa/signin');
                    }, 100);
                    setLoading(false);
                    return;
                }

                console.log(`🔍 [useRequireRole] Checking Role for ${user.email} (UID: ${user.uid.substring(0, 5)}...)`);

                // 2. Verificar Rol en Firestore (Forzando servidor en auth-service)
                const userRole = await getCurrentUserRole(user.uid);
                console.log(`🎭 [useRequireRole] Role found: ${userRole || 'NONE'}`);

                if (!userRole) {
                    if (retryCount < MAX_RETRIES) {
                        console.log(`⏳ [useRequireRole] Role NOT found yet. Retrying in ${RETRY_DELAY}ms... (${retryCount + 1}/${MAX_RETRIES})`);
                        setTimeout(() => { if (isMounted) checkAuthorization(retryCount + 1); }, RETRY_DELAY);
                        return;
                    }

                    console.error('❌ [useRequireRole] Role check FAILED after all retries.');

                    // EXCEPCIÓN CRÍTICA: Si el usuario está en Onboarding, lo dejamos quedarse
                    // Esto evita que el loop de redirección lo expulse mientras intenta completar su perfil
                    if (pathname && pathname.includes('onboarding')) {
                        console.warn('⚠️ [useRequireRole] Role missing but on onboarding page. Granting temporary access.');
                        setAuthorized(true);
                        setLoading(false);
                        return;
                    }

                    // En lugar de botar a /, intentamos ir al signin por si la sesión expiró o es inválida
                    setTimeout(() => {
                        if (isMounted) router.replace('/empresa/signin');
                    }, 100);
                    setLoading(false);
                    return;
                }

                // 3. Verificar si el rol coincide
                if (userRole !== requiredRole) {
                    console.log(`❌ [useRequireRole] Wrong role: has ${userRole}, needs ${requiredRole}`);
                    setTimeout(() => {
                        if (!isMounted) return;
                        router.replace(userRole === 'candidato' ? '/(tabs)' : '/empresa/dashboard');
                    }, 100);
                    setLoading(false);
                    return;
                }

                // Éxito
                console.log(`✅ [useRequireRole] Authorized as ${requiredRole}`);
                setAuthorized(true);
                setLoading(false);

            } catch (error) {
                console.error('❌ [useRequireRole] Fatal Error:', error);
                if (retryCount < MAX_RETRIES) {
                    setTimeout(() => { if (isMounted) checkAuthorization(retryCount + 1); }, RETRY_DELAY);
                } else {
                    setLoading(false);
                }
            }
        };

        checkAuthorization();
    }, [requiredRole, router, isMounted]);

    return { loading, authorized };
}
