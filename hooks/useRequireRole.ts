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

        let isEffectMounted = true;

        const checkAuthorization = async (retryCount = 0) => {
            const MAX_RETRIES = 12; // 12 seconds total
            const RETRY_DELAY = 1000;

            try {
                // IMPORTANT: Wait for Auth to initialize if it's currently null but might be loading
                // Firebase Auth is sometimes null for a few cycles on startup
                const user = auth.currentUser;

                // 1. Verificar Autenticación
                if (!user) {
                    // Try to wait a bit more for Auth state to stabilize
                    if (retryCount < 4) {
                        console.log(`⏳ [useRequireRole] Waiting for Firebase Auth (Attempt ${retryCount + 1})...`);
                        setTimeout(() => { if (isEffectMounted) checkAuthorization(retryCount + 1); }, 800);
                        return;
                    }

                    console.log('↩️ [useRequireRole] Redirecting to signin (No user found after retries)');
                    if (isEffectMounted) {
                        router.replace(requiredRole === 'empresa' ? '/empresa/signin' : '/signin');
                        setLoading(false);
                    }
                    return;
                }

                console.log(`🔍 [useRequireRole] Checking Role for ${user.email} (UID: ${user.uid.substring(0, 5)}...)`);

                // 2. Verificar Rol en Firestore
                const userRole = await getCurrentUserRole(user.uid);
                console.log(`🎭 [useRequireRole] Role detected: ${userRole || 'NONE'}`);

                if (!userRole) {
                    // If we are ON the onboarding page, we might not have the role set yet in Firestore 
                    // (e.g., right after signup). We allow this as a special case for companies.
                    if (pathname && (pathname.includes('onboarding') || pathname.includes('profile')) && requiredRole === 'empresa') {
                        console.warn('⚠️ [useRequireRole] Role missing but on onboarding/profile page. Granting temporary access.');
                        if (isEffectMounted) {
                            setAuthorized(true);
                            setLoading(false);
                        }
                        return;
                    }

                    if (retryCount < MAX_RETRIES) {
                        console.log(`⏳ [useRequireRole] Role NOT found yet. Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
                        setTimeout(() => { if (isEffectMounted) checkAuthorization(retryCount + 1); }, RETRY_DELAY);
                        return;
                    }

                    console.error('❌ [useRequireRole] Role check FAILED after all retries.');
                    if (isEffectMounted) {
                        router.replace(requiredRole === 'empresa' ? '/empresa/signin' : '/signin');
                        setLoading(false);
                    }
                    return;
                }

                // 3. Verificar si el rol coincide
                if (userRole !== requiredRole) {
                    console.log(`❌ [useRequireRole] Wrong role: has ${userRole}, needs ${requiredRole}`);
                    if (isEffectMounted) {
                        // Redirect logic based on what they HAVE vs what they NEED
                        if (userRole === 'candidato') router.replace('/(tabs)');
                        else if (userRole === 'empresa') router.replace('/empresa/dashboard');
                        setLoading(false);
                    }
                    return;
                }

                // Éxito
                console.log(`✅ [useRequireRole] Authorized as ${requiredRole}`);
                if (isEffectMounted) {
                    setAuthorized(true);
                    setLoading(false);
                }

            } catch (error) {
                console.error('❌ [useRequireRole] Fatal Error:', error);
                if (retryCount < MAX_RETRIES) {
                    setTimeout(() => { if (isEffectMounted) checkAuthorization(retryCount + 1); }, RETRY_DELAY);
                } else {
                    if (isEffectMounted) setLoading(false);
                }
            }
        };

        checkAuthorization();
        return () => { isEffectMounted = false; };
    }, [requiredRole, router, isMounted, pathname]);

    return { loading, authorized };
}
