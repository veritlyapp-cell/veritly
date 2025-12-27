import { createUserWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type UserRole = 'candidato' | 'empresa';

export interface CandidateProfile {
    uid: string;
    email: string;
    role: 'candidato';
    profile: {
        fullName?: string;
        phone?: string;
        location?: string;
        cvUrl?: string;
        skills?: string[];
        experience?: string;
    };
    applications: Array<{
        jobId: string;
        status: 'applied' | 'interview' | 'offer' | 'rejected';
        matchScore?: number;
        appliedAt: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

export interface CompanyProfile {
    uid: string;
    email: string;
    role: 'empresa';
    company: {
        name: string;
        ruc?: string;
        razonSocial?: string;
        industry?: string;
        size?: string;
        website?: string;
        description?: string;
        location?: any;
    };
    subscription: {
        plan: 'free' | 'pro' | 'enterprise';
        jobsLimit: number;
        candidatesAnalyzed: number;
    };
    profileCompleted?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Creates a new candidate user in Firebase Auth and Firestore
 */
export async function createCandidateUser(
    email: string,
    password: string,
    profileData?: Partial<CandidateProfile['profile']>
): Promise<User> {
    try {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create candidate document in Firestore
        const candidateData: CandidateProfile = {
            uid: user.uid,
            email: user.email || email,
            role: 'candidato',
            profile: profileData || {},
            applications: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await setDoc(doc(db, 'users_candidatos', user.uid), candidateData);

        return user;
    } catch (error: any) {
        console.error('Error creating candidate user:', error);
        throw error;
    }
}

/**
 * Creates a new company user in Firebase Auth and Firestore
 */
export async function createCompanyUser(
    email: string,
    password: string,
    companyName?: string
): Promise<User> {
    try {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create company document in Firestore
        const companyData: CompanyProfile = {
            uid: user.uid,
            email: user.email || email,
            role: 'empresa',
            company: {
                name: companyName || 'Nueva Empresa'
            },
            subscription: {
                plan: 'free',
                jobsLimit: 5,
                candidatesAnalyzed: 0
            },
            profileCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await setDoc(doc(db, 'users_empresas', user.uid), companyData);

        return user;
    } catch (error: any) {
        console.error('Error creating company user:', error);
        throw error;
    }
}

/**
 * Gets the role of the current user from Firestore
 * Includes fallback to legacy 'companies' collection for existing users
 */
export async function getCurrentUserRole(uid: string): Promise<UserRole | null> {
    try {
        console.log('🔍 [getCurrentUserRole] Checking role for UID:', uid);
        // Check in candidatos collection
        console.log('📂 [getCurrentUserRole] Checking users_candidatos...');
        const candidateDoc = await getDoc(doc(db, 'users_candidatos', uid));
        console.log('   Result:', candidateDoc.exists() ? 'FOUND ✅' : 'Not found');
        if (candidateDoc.exists()) {
            return 'candidato';
        }

        // Check in empresas collection (new)
        console.log('📂 [getCurrentUserRole] Checking users_empresas...');
        const companyDoc = await getDoc(doc(db, 'users_empresas', uid));
        console.log('   Result:', companyDoc.exists() ? 'FOUND ✅' : 'Not found');
        if (companyDoc.exists()) {
            return 'empresa';
        }

        // FALLBACK: Check in old 'companies' collection for existing users
        console.log('📂 [getCurrentUserRole] Checking legacy companies collection...');
        const legacyCompanyDoc = await getDoc(doc(db, 'companies', uid));
        console.log('   Result:', legacyCompanyDoc.exists() ? 'FOUND ✅' : 'Not found');
        if (legacyCompanyDoc.exists()) {
            console.log('⚠️ User found in legacy companies collection, treating as empresa');
            console.log('   Data sample:', { email: legacyCompanyDoc.data()?.email, profileCompleted: legacyCompanyDoc.data()?.profileCompleted });
            return 'empresa';
        }

        console.error('❌ [getCurrentUserRole] User not found in any collection!');
        return null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

/**
 * Gets the user profile from the appropriate collection based on role
 */
export async function getUserProfile(
    uid: string,
    role: UserRole
): Promise<CandidateProfile | CompanyProfile | null> {
    try {
        const collection = role === 'candidato' ? 'users_candidatos' : 'users_empresas';
        const docRef = doc(db, collection, uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as CandidateProfile | CompanyProfile;
        }

        return null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

/**
 * Updates the user profile in the appropriate collection
 */
export async function updateUserProfile(
    uid: string,
    role: UserRole,
    updates: Partial<CandidateProfile> | Partial<CompanyProfile>
): Promise<void> {
    try {
        const collection = role === 'candidato' ? 'users_candidatos' : 'users_empresas';
        const docRef = doc(db, collection, uid);

        await setDoc(docRef, {
            ...updates,
            updatedAt: new Date()
        }, { merge: true });
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
}
