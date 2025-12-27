import { useRouter } from 'expo-router';
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

        const checkAuthorization = async () => {
            try {
                const user = auth.currentUser;

                // Not authenticated at all - redirect to signin
                if (!user) {
                    console.log('❌ No authenticated user, redirecting to signin');
                    // Small delay to ensure router is ready
                    setTimeout(() => {
                        if (isMounted) {
                            router.replace('/empresa/signin');
                        }
                    }, 100);
                    setLoading(false);
                    setAuthorized(false);
                    return;
                }

                // Get user role from Firestore
                const userRole = await getCurrentUserRole(user.uid);

                // No role found (shouldn't happen if signup is correct)
                if (!userRole) {
                    console.error('⚠️ User has no role assigned');
                    setTimeout(() => {
                        if (isMounted) {
                            router.replace('/');
                        }
                    }, 100);
                    setLoading(false);
                    setAuthorized(false);
                    return;
                }

                // Check if role matches
                if (userRole !== requiredRole) {
                    console.log(`❌ Wrong role: has ${userRole}, needs ${requiredRole}`);

                    // Redirect to appropriate dashboard based on actual role
                    setTimeout(() => {
                        if (!isMounted) return;
                        if (userRole === 'candidato') {
                            router.replace('/(tabs)');
                        } else {
                            router.replace('/empresa/dashboard');
                        }
                    }, 100);
                    setLoading(false);
                    setAuthorized(false);
                    return;
                }

                // All checks passed
                console.log(`✅ Authorized as ${requiredRole}`);
                setAuthorized(true);
                setLoading(false);

            } catch (error) {
                console.error('Error checking authorization:', error);
                setTimeout(() => {
                    if (isMounted) {
                        router.replace('/');
                    }
                }, 100);
                setLoading(false);
                setAuthorized(false);
            }
        };

        checkAuthorization();
    }, [requiredRole, router, isMounted]);

    return { loading, authorized };
}
