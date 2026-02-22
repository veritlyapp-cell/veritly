
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { CandidateProfile, CompanyProfile } from './auth-service';

export const getAllCandidates = async (): Promise<CandidateProfile[]> => {
    try {
        const q = query(collection(db, 'users_candidatos'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as CandidateProfile);
    } catch (error) {
        console.error("Error fetching candidates:", error);
        return [];
    }
};

export const getAllCompanies = async (): Promise<CompanyProfile[]> => {
    try {
        const q = query(collection(db, 'users_empresas'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as CompanyProfile);
    } catch (error) {
        console.error("Error fetching companies:", error);
        return [];
    }
};
