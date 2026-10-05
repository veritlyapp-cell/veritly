import {
    addDoc,
    arrayUnion,
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
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
//
// El CV en base64 NO se guarda en este documento: si va inline aca, cada
// lectura de la lista de candidatos (getJobCandidates) descarga el CV
// completo de TODOS los candidatos aunque solo se necesiten nombre/score.
// Se guarda aparte en jobs/{jobId}/candidates/{id}/private/cv y se trae
// bajo demanda solo cuando se abre ese candidato puntual (ver
// getCandidateCvBase64 mas abajo).
export const saveCandidateAnalysis = async (jobId: string, analysis: CandidateAnalysis) => {
    try {
        const { cvBase64, ...rest } = analysis as any;
        // Ruta: jobs -> {jobId} -> candidates -> {candidateId}
        const candidateRef = doc(db, "jobs", jobId, "candidates", analysis.id);
        // Agregamos companyId al documento para facilitar búsquedas futuras
        const dataToSave = {
            ...rest,
            companyId: auth.currentUser?.uid // Aseguramos que tenga el ID de empresa para filtros
        };
        await setDoc(candidateRef, dataToSave);

        if (cvBase64) {
            await saveCandidateCvBase64(jobId, analysis.id, cvBase64);
        }
    } catch (e) {
        console.error("Error guardando candidato: ", e);
        throw e;
    }
};

// Guarda el CV en base64 en un sub-documento aparte del candidato (ver nota arriba)
export const saveCandidateCvBase64 = async (jobId: string, candidateId: string, cvBase64: string) => {
    const cvRef = doc(db, "jobs", jobId, "candidates", candidateId, "private", "cv");
    await setDoc(cvRef, { cvBase64 });
};

// Trae el CV en base64 de un candidato puntual bajo demanda (al abrirlo/analizarlo),
// nunca como parte de la lista completa de candidatos.
export const getCandidateCvBase64 = async (jobId: string, candidateId: string): Promise<string | null> => {
    try {
        const cvRef = doc(db, "jobs", jobId, "candidates", candidateId, "private", "cv");
        const snap = await getDoc(cvRef);
        return snap.exists() ? (snap.data().cvBase64 || null) : null;
    } catch (e) {
        console.error("Error obteniendo CV del candidato: ", e);
        return null;
    }
};

// Timestamp de Firestore (o string ISO ya guardado) -> ISO
const timestampToIso = (v: any): string | null =>
    !v ? null : typeof v === 'string' ? v : (v.toDate?.().toISOString?.() || null);

// 4. Obtener Candidatos de una Vacante específica
export const getJobCandidates = async (jobId: string) => {
    try {
        const q = query(collection(db, "jobs", jobId, "candidates"));
        const querySnapshot = await getDocs(q);
        const candidates: CandidateAnalysis[] = [];
        querySnapshot.forEach((docSnap) => {
            const raw = docSnap.data();

            const cvUrl = raw.cvUrl || raw.originalFileUrl || raw.cv_url || raw.fileUrl || raw.profile?.cv || raw.about?.file;
            const cvBase64 = raw.cvBase64 || '';
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
                summary = (cvUrl || cvBase64) 
                    ? 'Postulante externo pendiente de análisis IA. CV disponible para revisión manual.'
                    : 'Postulante externo (Sincronización incompleta: No se detectó archivo adjunto).';
            }

            const normalized: CandidateAnalysis = {
                id: docSnap.id,
                jobId: raw.jobId || jobId,
                name: raw.name || raw.fullName || 'Candidato Externo',
                email: raw.email || null,
                phoneNumber: raw.phone || raw.phoneNumber,
                salaryExpectation: raw.salaryExpectation || raw.salary || 0,
                matchScore: raw.matchScore ?? (isSalaryRejected || isKillerRejected ? 0 : undefined),
                matchStatus: raw.matchStatus || (isSalaryRejected || isKillerRejected ? 'red' : 'yellow'),
                summary: summary,
                pros: raw.pros || [],
                cons: raw.cons || [],
                keywordsValidation: raw.keywordsValidation,
                killerAnswers: raw.killerAnswers || null,
                // Para saber si un descarte fue automatico y si el candidato ya lo ve
                // (ver isClosurePending en empresa/job/[id].tsx)
                failureReason: raw.failureReason || '',
                statusUpdatedAt: timestampToIso(raw.statusUpdatedAt),
                originalFileUrl: cvUrl,
                cvUrl: cvUrl,
                cvBase64: cvBase64,
                cvMimeType: raw.cvMimeType,
                recruitmentStatus: raw.recruitmentStatus || raw.status || 'new',
                analyzedAt: raw.analyzedAt
                    ? (typeof raw.analyzedAt === 'string' ? raw.analyzedAt : (raw.analyzedAt.toDate?.().toISOString?.() || new Date().toISOString()))
                    : (raw.appliedAt?.toDate?.().toISOString?.() || raw.createdAt || new Date().toISOString()),
                originalJobTitle: raw.originalJobTitle,
                // LinkedIn sourced fields
                linkedinUrl: raw.linkedinUrl,
                role: raw.role,
                about: raw.about,
                experience: raw.experience,
            } as any;
            candidates.push(normalized);
        });
        // M-01 FIX: Uso de ?? -1 para que candidatos sin score (pendiente IA) vayan al final del ranking
        return candidates.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
    } catch (e) {
        console.error("Error leyendo candidatos: ", e);
        return [];
    }
};

// 5. Actualizar Estatus del Candidato (Kanban/ATS)
export const updateCandidateStatus = async (jobId: string, candidateId: string, newStatus: RecruitmentStatus) => {
    try {
        const candidateRef = doc(db, "jobs", jobId, "candidates", candidateId);
        // statusUpdatedAt: el candidato ve en "Mis Postulaciones" que hubo una
        // novedad (ver netlify/functions/my-applications.ts)
        await updateDoc(candidateRef, { recruitmentStatus: newStatus, statusUpdatedAt: serverTimestamp() });
    } catch (e) {
        console.error("Error actualizando status: ", e);
        throw e;
    }
};

// 6. BUSCADOR DE HISTORIAL (Collection Group Query)
// Otras postulaciones de este candidato (por email) en vacantes de ESTA empresa
// (companyId), nunca de otras empresas. Indice: firestore.indexes.json.
export type CandidateHistoryEntry = {
    jobId: string;
    jobTitle: string;
    appliedAt: string | null; // ISO
    status: RecruitmentStatus;
    matchScore: number | null;
};

export const getCandidateHistoryForCompany = async (companyId: string, candidateEmail: string, currentJobId: string): Promise<CandidateHistoryEntry[]> => {
    try {
        // 'collectionGroup' busca en TODAS las colecciones llamadas "candidates" en toda la DB
        const candidatesQuery = query(
            collectionGroup(db, 'candidates'),
            where('email', '==', candidateEmail),
            where('companyId', '==', companyId)
        );

        const snapshot = await getDocs(candidatesQuery);
        // Excluimos la postulacion que estamos viendo actualmente
        const others = snapshot.docs
            .map((d) => ({ jobId: (d.data().jobId || d.ref.parent.parent?.id || '') as string, data: d.data() }))
            .filter((o) => o.jobId && o.jobId !== currentJobId);

        // Nombre de cada vacante (el doc del candidato no lo guarda)
        const jobIds = [...new Set(others.map((o) => o.jobId))];
        const titles = new Map<string, string>();
        await Promise.all(jobIds.map(async (jobId) => {
            try {
                const jobSnap = await getDoc(doc(db, 'jobs', jobId));
                if (jobSnap.exists()) titles.set(jobId, jobSnap.data().jobTitle || jobSnap.data().title);
            } catch { /* sin acceso o eliminada: queda el titulo de respaldo */ }
        }));

        const history: CandidateHistoryEntry[] = others.map(({ jobId, data }) => ({
            jobId,
            jobTitle: titles.get(jobId) || data.originalJobTitle || 'Vacante eliminada',
            appliedAt: timestampToIso(data.appliedAt) || timestampToIso(data.analyzedAt) || timestampToIso(data.createdAt),
            status: (data.recruitmentStatus || data.status || 'new') as RecruitmentStatus,
            matchScore: typeof data.matchScore === 'number' ? data.matchScore : null,
        }));

        return history.sort((a, b) => (b.appliedAt || '').localeCompare(a.appliedAt || ''));
    } catch (e: any) {
        console.error("Error buscando historial (Posible falta de índice): ", e);
        // Firebase lanzará un error con un LINK en la consola para crear el índice requerido.
        return [];
    }
};

// Necesario importar auth para obtener el ID actual en saveCandidateAnalysis
