import { arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

// --- PERFIL ---
export const saveUserProfileToCloud = async (uid: string, data: any) => {
    try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
            profile: data,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
        return true;
    } catch (e) {
        console.error("Error guardando perfil:", e);
        throw e;
    }
};

export const getUserProfileFromCloud = async (uid: string) => {
    try {
        const userRef = doc(db, "users", uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            return docSnap.data().profile;
        }
        return null;
    } catch (e) {
        console.error("Error leyendo perfil:", e);
        throw e;
    }
};

// --- HISTORIAL ---

// Guardar un NUEVO análisis (Agregar a la lista)
export const saveAnalysisToCloud = async (uid: string, analysisItem: any) => {
    try {
        const userRef = doc(db, "users", uid);
        // arrayUnion es mágico: agrega sin borrar lo que ya estaba
        await setDoc(userRef, {
            history: arrayUnion(analysisItem)
        }, { merge: true });
    } catch (e) {
        console.error("Error guardando análisis:", e);
        throw e;
    }
};

// Actualizar TODO el historial (Para borrar o cambiar estatus)
export const updateHistoryInCloud = async (uid: string, newHistory: any[]) => {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
            history: newHistory
        });
    } catch (e) {
        console.error("Error actualizando historial:", e);
        throw e;
    }
};

// Leer historial completo
export const getHistoryFromCloud = async (uid: string) => {
    try {
        const userRef = doc(db, "users", uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().history) {
            // Invertimos para ver el más nuevo arriba
            return [...docSnap.data().history].reverse();
        }
        return [];
    } catch (e) {
        console.error("Error leyendo historial:", e);
        return [];
    }
};