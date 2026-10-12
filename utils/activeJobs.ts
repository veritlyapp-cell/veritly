import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { isJobExpired } from './jobExpiry';

// El limite del plan es de vacantes ACTIVAS (encendidas y sin vencer), no del
// total: las inactivas no cuentan. Se revisa al crear, copiar, reactivar y
// republicar una vacante.
export const isJobActive = (job: any) => job?.status !== 'Closed' && !isJobExpired(job);

export async function getActiveJobsUsage(companyId: string): Promise<{ active: number; limit: number }> {
    const [jobsSnap, companySnap] = await Promise.all([
        getDocs(query(collection(db, 'jobs'), where('companyId', '==', companyId))),
        getDoc(doc(db, 'users_empresas', companyId)),
    ]);
    const active = jobsSnap.docs.filter((d) => isJobActive(d.data())).length;
    const limit = companySnap.data()?.subscription?.internalVacanciesLimit || 10;
    return { active, limit };
}

export const activeLimitMessage = (limit: number) =>
    `Tu plan permite ${limit} vacante${limit === 1 ? '' : 's'} activa${limit === 1 ? '' : 's'} a la vez. Desactiva una vacante o pasa a un plan con más vacantes.`;
