import { doc, getDoc, increment, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";

// --- CONFIGURACIÓN DINÁMICA ---
export interface CreditPackage {
    id: string;
    name: string;
    credits: number;
    priceUSD: number;
    pricePEN: number;
    active?: boolean;
}

export interface AppConfig {
    packagesEnabled: boolean;
    packages: CreditPackage[];
    freeCreditsPerMonth: number;
}

// Fallback estático (mientras carga Firestore)
export const DEFAULT_CREDIT_PACKAGES: CreditPackage[] = [
    { id: 'starter', name: 'Starter', credits: 3, priceUSD: 3, pricePEN: 11, active: true },
    { id: 'plus', name: 'Plus', credits: 5, priceUSD: 4, pricePEN: 15, active: true },
    { id: 'pro', name: 'Pro', credits: 10, priceUSD: 8, pricePEN: 30, active: true },
];

export const STATIC_FREE_CREDITS = 3;

/**
 * Obtiene la configuración global de la app desde Firestore.
 */
export const getAppConfig = async (): Promise<AppConfig> => {
    try {
        const configRef = doc(db, 'config', 'credits');
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            return configSnap.data() as AppConfig;
        }

        // Si no existe, creamos la config inicial (desactivada por defecto)
        const initialConfig: AppConfig = {
            packagesEnabled: false,
            packages: DEFAULT_CREDIT_PACKAGES,
            freeCreditsPerMonth: STATIC_FREE_CREDITS
        };
        await setDoc(configRef, initialConfig);
        return initialConfig;
    } catch (error) {
        console.error("❌ Error getting app config:", error);
        return {
            packagesEnabled: false,
            packages: DEFAULT_CREDIT_PACKAGES,
            freeCreditsPerMonth: STATIC_FREE_CREDITS
        };
    }
};

/**
 * Actualiza la configuración global.
 */
export const updateAppConfig = async (newConfig: Partial<AppConfig>) => {
    try {
        const configRef = doc(db, 'config', 'credits');
        await setDoc(configRef, newConfig, { merge: true });
        console.log("✅ App Config updated successfully");
    } catch (error) {
        console.error("❌ Error updating app config:", error);
        throw error;
    }
};

// --- INTERFACES ---
export interface UserCredits {
    paidCredits: number;           // Purchased credits (never expire)
    freeCreditsUsedThisMonth: number; // Free credits used this month
    lastFreeResetMonth: string;    // "2026-01" format
    totalCreditsUsed: number;      // Lifetime counter
    purchaseHistory: Array<{
        packageId: string;
        credits: number;
        amountUSD: number;
        purchasedAt: string;
        paymentMethod?: string;
    }>;
}

// --- HELPER: Get current month string ---
const getCurrentMonthKey = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// --- GET USER CREDITS ---
export const getUserCredits = async (uid: string): Promise<UserCredits> => {
    try {
        const creditsRef = doc(db, 'user_credits', uid);
        const creditsSnap = await getDoc(creditsRef);

        const currentMonth = getCurrentMonthKey();

        if (!creditsSnap.exists()) {
            // Initialize new user credits
            const initialCredits: UserCredits = {
                paidCredits: 0,
                freeCreditsUsedThisMonth: 0,
                lastFreeResetMonth: currentMonth,
                totalCreditsUsed: 0,
                purchaseHistory: []
            };
            await setDoc(creditsRef, initialCredits);
            return initialCredits;
        }

        const data = creditsSnap.data() as UserCredits;

        // Check if we need to reset free credits (new month)
        if (data.lastFreeResetMonth !== currentMonth) {
            const updatedCredits = {
                ...data,
                freeCreditsUsedThisMonth: 0,
                lastFreeResetMonth: currentMonth
            };
            await setDoc(creditsRef, updatedCredits, { merge: true });
            return updatedCredits;
        }

        return data;
    } catch (error) {
        console.error("❌ Error getting user credits:", error);
        throw error;
    }
};

// --- CALCULATE AVAILABLE CREDITS ---
export const getAvailableCredits = (credits: UserCredits, freeLimit: number = STATIC_FREE_CREDITS): { free: number; paid: number; total: number } => {
    const freeRemaining = Math.max(0, freeLimit - credits.freeCreditsUsedThisMonth);
    return {
        free: freeRemaining,
        paid: credits.paidCredits,
        total: freeRemaining + credits.paidCredits
    };
};

// --- CHECK IF USER CAN ANALYZE ---
export const canUserAnalyze = async (uid: string): Promise<{ canAnalyze: boolean; credits: UserCredits; available: ReturnType<typeof getAvailableCredits>; reason?: string }> => {
    try {
        const [credits, config] = await Promise.all([
            getUserCredits(uid),
            getAppConfig()
        ]);
        const available = getAvailableCredits(credits, config.freeCreditsPerMonth);

        if (available.total > 0) {
            return { canAnalyze: true, credits, available };
        }

        return {
            canAnalyze: false,
            credits,
            available,
            reason: config.packagesEnabled ? "No tienes créditos disponibles. Compra un paquete para continuar." : "Has agotado tus créditos gratuitos mensuales."
        };
    } catch (error) {
        console.error("❌ Error checking if user can analyze:", error);
        return {
            canAnalyze: false,
            credits: {} as UserCredits,
            available: { free: 0, paid: 0, total: 0 },
            reason: "Error al verificar créditos."
        };
    }
};

// --- DEDUCT ONE CREDIT ---
export const deductCredit = async (uid: string): Promise<boolean> => {
    try {
        const [credits, config] = await Promise.all([
            getUserCredits(uid),
            getAppConfig()
        ]);
        const available = getAvailableCredits(credits, config.freeCreditsPerMonth);

        if (available.total <= 0) {
            console.error("❌ No credits available to deduct");
            return false;
        }

        const creditsRef = doc(db, 'user_credits', uid);

        // Use free credits first, then paid
        if (available.free > 0) {
            await setDoc(creditsRef, {
                freeCreditsUsedThisMonth: increment(1),
                totalCreditsUsed: increment(1)
            }, { merge: true });
            console.log("✅ Deducted 1 FREE credit");
        } else {
            await setDoc(creditsRef, {
                paidCredits: increment(-1),
                totalCreditsUsed: increment(1)
            }, { merge: true });
            console.log("✅ Deducted 1 PAID credit");
        }

        return true;
    } catch (error) {
        console.error("❌ Error deducting credit:", error);
        return false;
    }
};

// --- ADD CREDITS (after purchase) ---
export const addPurchasedCredits = async (
    uid: string,
    packageId: string,
    credits: number,
    amountUSD: number,
    paymentMethod?: string
): Promise<boolean> => {
    try {
        const creditsRef = doc(db, 'user_credits', uid);
        const userCredits = await getUserCredits(uid);

        const purchaseRecord = {
            packageId,
            credits,
            amountUSD,
            purchasedAt: new Date().toISOString(),
            paymentMethod
        };

        await setDoc(creditsRef, {
            paidCredits: userCredits.paidCredits + credits,
            purchaseHistory: [...userCredits.purchaseHistory, purchaseRecord]
        }, { merge: true });

        console.log(`✅ Added ${credits} credits for user ${uid}`);
        return true;
    } catch (error) {
        console.error("❌ Error adding purchased credits:", error);
        return false;
    }
};

// --- GET CREDITS DISPLAY STRING ---
export const getCreditsDisplayText = (available: ReturnType<typeof getAvailableCredits>): string => {
    if (available.total === 0) {
        return "0 créditos";
    }

    const parts = [];
    if (available.free > 0) {
        parts.push(`${available.free} gratis`);
    }
    if (available.paid > 0) {
        parts.push(`${available.paid} comprados`);
    }

    return parts.join(" + ");
};
