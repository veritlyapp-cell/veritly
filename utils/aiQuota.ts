import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// Analisis IA del mes calendario (la cuota del plan es mensual): candidatos con
// matchScore > 0 y analyzedAt dentro del mes. Los CVs recien subidos tambien
// traen analyzedAt pero con matchScore 0, por eso el doble filtro.
//
// Antes el dashboard y la pantalla de cada vacante DESCARGABAN todos los
// candidatos (con analisis y a veces el CV en base64) para contarlos en el
// navegador: era lo que mas demoraba la carga. Ahora Firestore cuenta sin
// enviar documentos. Indice: candidates (matchScore, analyzedAt) en
// firestore.indexes.json.

const monthStartIso = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
};

async function countForJob(jobId: string, startIso: string): Promise<number> {
    const ref = collection(db, 'jobs', jobId, 'candidates');
    try {
        const snap = await getCountFromServer(query(ref, where('matchScore', '>', 0), where('analyzedAt', '>=', startIso)));
        return snap.data().count;
    } catch (e) {
        // Respaldo (ej. indice aun construyendose): la forma anterior, solo los analizados
        console.warn('Conteo de analisis por agregacion fallo, usando respaldo:', e);
        const docs = await getDocs(query(ref, where('matchScore', '>', 0)));
        return docs.docs.filter((d) => {
            const raw = d.data().analyzedAt;
            const date = raw?.toDate ? raw.toDate() : new Date(raw);
            return !isNaN(date.getTime()) && date.toISOString() >= startIso;
        }).length;
    }
}

// Analisis del mes por vacante: { jobId: cantidad }
export async function countMonthlyAnalysesByJob(jobIds: string[]): Promise<Record<string, number>> {
    const startIso = monthStartIso();
    const counts = await Promise.all(jobIds.map((id) => countForJob(id, startIso).catch(() => 0)));
    return Object.fromEntries(jobIds.map((id, i) => [id, counts[i]]));
}
