import { collection, doc, increment, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

// --- REFERENCIAS ---
const STATS_DOC_REF = doc(db, "stats", "global_counters");
const LOGS_COLLECTION_REF = collection(db, "system_logs");

// --- INTERFACES ---
type StatKey = 'totalUsers' | 'totalLogins' | 'totalScans' | 'totalShares';

// --- FUNCIONES DE MÉTRICAS (ATÓMICAS) ---

/**
 * Incrementa un contador global de manera eficiente.
 */
export const trackStat = async (key: StatKey) => {
    try {
        // Usamos setDoc con merge para crear el doc si no existe
        await setDoc(STATS_DOC_REF, {
            [key]: increment(1),
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error("❌ Error tracking stat:", key, error);
        // Fallback silencioso para no interrumpir al usuario
    }
};

/**
 * Registra un login diario.
 * (Para esto usamos una estructura simple: 'dailyLogins.YYYY-MM-DD': increment(1))
 */
export const trackDailyLogin = async () => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        await setDoc(STATS_DOC_REF, {
            [`dailyLogins.${today}`]: increment(1),
            totalLogins: increment(1)
        }, { merge: true });
    } catch (error) {
        console.error("❌ Error tracking daily login:", error);
    }
};

/**
 * Registra un nuevo usuario con fecha.
 */
export const trackNewUser = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        await setDoc(STATS_DOC_REF, {
            [`dailyNewUsers.${today}`]: increment(1),
            totalUsers: increment(1)
        }, { merge: true });
    } catch (error) {
        console.error("❌ Error tracking new user:", error);
    }
};

/**
 * Registra un scan con fecha.
 */
export const trackDailyScan = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        await setDoc(STATS_DOC_REF, {
            [`dailyScans.${today}`]: increment(1),
            totalScans: increment(1)
        }, { merge: true });
    } catch (error) {
        console.error("❌ Error tracking daily scan:", error);
    }
};

// --- FUNCIONES DE LOGS (ERRORES CRÍTICOS) ---

/**
 * Escribe un error en la colección de logs.
 * Útil para disparar alertas o revisar fallos post-mortem.
 */
export const logError = async (context: string, error: any, severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'WARNING') => {
    try {
        const user = auth.currentUser;
        const logEntry = {
            timestamp: new Date().toISOString(),
            severity,
            context, // Ej: "Gemini Analysis"
            message: error.message || JSON.stringify(error),
            userId: user ? user.uid : 'anonymous',
            userEmail: user ? user.email : 'anonymous',
            device: typeof navigator !== 'undefined' ? navigator.userAgent : 'native'
        };

        // Creamos un nuevo doc en 'system_logs'
        await setDoc(doc(LOGS_COLLECTION_REF), logEntry);
        console.log(`📝 System Log [${severity}]: ${context}`);

        // TODO: Aquí iría la Cloud Function para enviar email si es CRITICAL
    } catch (e) {
        console.error("❌ Failed to log system error:", e);
    }
};
/**
 * Registra el login de un usuario específico.
 * Incrementa su contador personal y actualiza la fecha.
 */
export const trackUserLogin = async (uid: string, role: 'candidate' | 'company') => {
    try {
        const collectionName = role === 'company' ? 'users_empresas' : 'users_candidatos';
        const userRef = doc(db, collectionName, uid);

        await setDoc(userRef, {
            loginCount: increment(1),
            lastLoginAt: new Date().toISOString()
        }, { merge: true });

        // También registramos el login global
        await trackDailyLogin();

    } catch (error) {
        console.error("❌ Error tracking user login:", error);
    }
};
