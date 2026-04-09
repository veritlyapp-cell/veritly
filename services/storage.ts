import {
    addDoc,
    arrayUnion,
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    updateDoc,
    where
} from "firebase/firestore";
import { auth, db } from "../config/firebase"; // <--- AQUÍ: Importa auth junto con db
import { CandidateAnalysis, JobPosting, RecruitmentStatus } from "../types";

// ==========================================
// 👤 MÓDULO CANDIDATO (Tu código original)
// ==========================================

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
export const saveAnalysisToCloud = async (uid: string, analysisItem: any) => {
    try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
            history: arrayUnion(analysisItem)
        }, { merge: true });
    } catch (e) {
        console.error("Error guardando análisis:", e);
        throw e;
    }
};

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

export const getHistoryFromCloud = async (uid: string) => {
    try {
        const userRef = doc(db, "users", uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().history) {
            return [...docSnap.data().history].reverse();
        }
        return [];
    } catch (e) {
        console.error("Error leyendo historial:", e);
        return [];
    }
};

// ==========================================
// 🏢 MÓDULO EMPRESA (NUEVO)
// ==========================================

// 1. Crear una Vacante (Job Posting)
export const createJobPosting = async (jobData: Omit<JobPosting, 'id'>) => {
    try {
        // addDoc genera un ID automático
        const docRef = await addDoc(collection(db, "jobs"), jobData);
        console.log("Vacante creada con ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error creando vacante: ", e);
        throw e;
    }
};

// 2. Obtener Vacantes de una Empresa
export const getCompanyJobs = async (companyId: string) => {
    try {
        const q = query(
            collection(db, "jobs"),
            where("companyId", "==", companyId)
            // orderBy("createdAt", "desc") // Nota: Requiere índice compuesto en Firebase si se usa con 'where'
        );
        const querySnapshot = await getDocs(q);
        const jobs: JobPosting[] = [];
        querySnapshot.forEach((doc) => {
            jobs.push({ id: doc.id, ...doc.data() } as JobPosting);
        });

        // Ordenamos manual JS para evitar error de índice por ahora
        return jobs.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
        console.error("Error obteniendo vacantes: ", e);
        return [];
    }
};

// 3. Guardar Análisis de Candidato (Subcolección)
export const saveCandidateAnalysis = async (jobId: string, analysis: CandidateAnalysis) => {
    try {
        // Ruta: jobs -> {jobId} -> candidates -> {candidateId}
        const candidateRef = doc(db, "jobs", jobId, "candidates", analysis.id);
        // Agregamos companyId al documento para facilitar búsquedas futuras
        const dataToSave = {
            ...analysis,
            companyId: auth.currentUser?.uid // Aseguramos que tenga el ID de empresa para filtros
        };
        await setDoc(candidateRef, dataToSave);
    } catch (e) {
        console.error("Error guardando candidato: ", e);
        throw e;
    }
};

// 4. Obtener Candidatos de una Vacante específica
export const getJobCandidates = async (jobId: string) => {
    try {
        const q = query(collection(db, "jobs", jobId, "candidates"));
        const querySnapshot = await getDocs(q);
        const candidates: CandidateAnalysis[] = [];
        querySnapshot.forEach((docSnap) => {
            const raw = docSnap.data();

            // Normalizar candidatos externos (desde formulario /vacante/[id])
            const isSalaryRejected = raw.recruitmentStatus === 'rejected_salary' || raw.status === 'rejected_salary';
            const isKillerRejected = raw.recruitmentStatus === 'rejected' && raw.failureReason?.includes('críticos');
            const isExternalPending = raw.source === 'external_link';
            
            let summary = raw.summary || "";
            if (isSalaryRejected) {
                summary = `🚫 Descartado automáticamente: Expectativa salarial (S/ ${raw.salaryExpectation?.toLocaleString('es-PE') ?? '–'}) fuera del rango presupuestado.`;
            } else if (isKillerRejected) {
                summary = `🚫 Descartado automáticamente: No cumple con preguntas filtro (Killer Questions).`;
                if (raw.killerAnswers) {
                    summary += `\nRespuestas: ${Object.values(raw.killerAnswers).join(', ')}`;
                }
            } else if (isExternalPending && !summary) {
                summary = 'Postulante externo pendiente de análisis IA. CV disponible para revisión manual.';
            }

            const normalized: CandidateAnalysis = {
                id: docSnap.id,
                jobId: raw.jobId || jobId,
                name: raw.name || raw.fullName || 'Candidato Externo',
                email: raw.email || null,
                phoneNumber: raw.phone || raw.phoneNumber,
                matchScore: raw.matchScore ?? (isSalaryRejected || isKillerRejected ? 0 : undefined),
                matchStatus: raw.matchStatus || (isSalaryRejected || isKillerRejected ? 'red' : 'yellow'),
                summary: summary,
                pros: raw.pros || [],
                cons: raw.cons || [],
                keywordsValidation: raw.keywordsValidation,
                originalFileUrl: raw.cvUrl || raw.originalFileUrl,
                recruitmentStatus: raw.recruitmentStatus || raw.status || 'new',
                analyzedAt: raw.analyzedAt
                    ? (typeof raw.analyzedAt === 'string' ? raw.analyzedAt : (raw.analyzedAt.toDate?.().toISOString?.() || new Date().toISOString()))
                    : (raw.appliedAt?.toDate?.().toISOString?.() || new Date().toISOString()),
                originalJobTitle: raw.originalJobTitle,
            };
            candidates.push(normalized);
        });
        // Ordenar por score (mayor a menor), candidatos externos pending_ai van al final
        return candidates.sort((a, b) => b.matchScore - a.matchScore);
    } catch (e) {
        console.error("Error leyendo candidatos: ", e);
        return [];
    }
};

// 5. Actualizar Estatus del Candidato (Kanban/ATS)
export const updateCandidateStatus = async (jobId: string, candidateId: string, newStatus: RecruitmentStatus) => {
    try {
        const candidateRef = doc(db, "jobs", jobId, "candidates", candidateId);
        await updateDoc(candidateRef, { recruitmentStatus: newStatus });
    } catch (e) {
        console.error("Error actualizando status: ", e);
        throw e;
    }
};

// 6. BUSCADOR DE HISTORIAL (Collection Group Query)
// Busca si este candidato (email) existe en CUALQUIER vacante de esta empresa
export const getCandidateHistoryForCompany = async (companyId: string, candidateEmail: string, currentJobId: string) => {
    try {
        // 'collectionGroup' busca en TODAS las colecciones llamadas "candidates" en toda la DB
        const candidatesQuery = query(
            collectionGroup(db, 'candidates'),
            where('email', '==', candidateEmail),
            where('companyId', '==', companyId)
        );

        const snapshot = await getDocs(candidatesQuery);
        const history: CandidateAnalysis[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data() as CandidateAnalysis;
            // Excluimos el análisis que estamos viendo actualmente
            if (data.jobId !== currentJobId) {
                history.push(data);
            }
        });

        return history.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
    } catch (e: any) {
        console.error("Error buscando historial (Posible falta de índice): ", e);
        // Firebase lanzará un error con un LINK en la consola para crear el índice requerido.
        return [];
    }
};

// Necesario importar auth para obtener el ID actual en saveCandidateAnalysis
