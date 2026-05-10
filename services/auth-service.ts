import { createUserWithEmailAndPassword, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocFromServer, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { sendAdminNotification } from './notification-service';

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
        plan: string;
        aiAnalysisLimit: number;
        internalVacanciesLimit: number;
        publicVacanciesLimit: number;
        candidatesAnalyzed: number;
        status?: 'active' | 'expired' | 'trial';
        updatedAt?: any;
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

        // Notify Admin (Async, don't block)
        sendAdminNotification('candidate', {
            name: profileData?.fullName || 'Nuevo Candidato',
            email: user.email || email,
            phone: profileData?.phone
        });

        return user;
    } catch (error: any) {
        console.error('Error creating candidate user:', error);
        throw error;
    }
}

/**
 * Checks if an email is already in use by ANY role (candidate or company)
 */
export async function checkEmailAvailability(email: string): Promise<{ available: boolean; existingRole?: UserRole }> {
    try {
        // Check candidates
        const candidatesRef = collection(db, 'users_candidatos');
        const qCand = query(candidatesRef, where('email', '==', email));
        const candSnap = await getDocs(qCand);

        if (!candSnap.empty) return { available: false, existingRole: 'candidato' };

        // Check companies
        const companiesRef = collection(db, 'users_empresas');
        const qComp = query(companiesRef, where('email', '==', email));
        const compSnap = await getDocs(qComp);

        if (!compSnap.empty) return { available: false, existingRole: 'empresa' };

        return { available: true };
    } catch (error) {
        console.error("Error checking email availability:", error);
        // A-03 FIX: En lugar de asumir que el email está disponible (lo que puede crear duplicados),
        // propagamos el error para que el UI informe al usuario de verificar su conexión.
        throw new Error("No se pudo verificar el correo. Comprueba tu conexión e intenta de nuevo.");
    }
}

/**
 * Checks if a Company ID (RUC or DNI) is already registered
 */
export async function checkCompanyIdAvailability(idValue: string): Promise<boolean> {
    try {
        const companiesRef = collection(db, 'users_empresas');
        // Check RUC match
        const qRuc = query(companiesRef, where('company.ruc', '==', idValue));
        const rucSnap = await getDocs(qRuc);
        if (!rucSnap.empty) return false;

        // Check DNI match (for independent recruiters)
        const qDni = query(companiesRef, where('company.dni', '==', idValue));
        const dniSnap = await getDocs(qDni);
        if (!dniSnap.empty) return false;

        return true;
    } catch (error) {
        console.error("Error checking ID availability:", error);
        return true;
    }
}

/**
 * Creates a new company user in Firebase Auth and Firestore
 */
export async function createCompanyUser(
    email: string,
    password: string,
    companyDataInput: {
        name: string,
        type: 'empresa' | 'independiente',
        ruc?: string,
        dni?: string,
        razonSocial?: string // [NEW] Accept Reason Social specifically
    }
): Promise<User> {
    try {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create company document in Firestore
        const companyProfile: CompanyProfile = {
            uid: user.uid,
            email: user.email || email,
            role: 'empresa',
            company: {
                name: companyDataInput.name, // Commercial Name (can be empty)
                ...(companyDataInput.type === 'empresa' ? {
                    ruc: companyDataInput.ruc,
                    razonSocial: companyDataInput.razonSocial
                } : {}),
                ...(companyDataInput.type === 'independiente' ? { dni: companyDataInput.dni } : {}),
                type: companyDataInput.type // Guardar el tipo para referencia
            } as any, // Cast to any to allow dynamic fields if interface is strict
            subscription: {
                plan: 'beta_free',
                aiAnalysisLimit: 200,
                internalVacanciesLimit: 5,
                publicVacanciesLimit: 3,
                candidatesAnalyzed: 0,
                status: 'active'
            },
            profileCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log(`📡 [auth-service] Creando documento Firestore para empresa: ${user.uid}`);
        await setDoc(doc(db, 'users_empresas', user.uid), companyProfile);
        console.log('✅ [auth-service] Documento Firestore creado exitosamente.');

        // Notify Admin
        sendAdminNotification('company', {
            name: companyProfile.company.name,
            email: user.email || email,
            id: companyProfile.company.ruc || (companyProfile.company as any).dni
        });

        return user;
    } catch (error: any) {
        console.error('❌ [auth-service] Error creating company user:', error);
        throw error;
    }
}

/**
 * Gets the role of the current user from Firestore
 * Includes fallback to legacy 'companies' collection for existing users
 */
export async function getCurrentUserRole(uid: string): Promise<UserRole | null> {
    const startTime = Date.now();
    try {
        console.log(`🔍 [getCurrentUserRole] Checking role for UID: ${uid.substring(0, 8)}...`);

        // Check user auth to find email
        const user = auth.currentUser;
        if (user && user.uid === uid && user.email === 'oscar@veritlyapp.com') {
            console.log(`👑 [getCurrentUserRole] Forcing 'empresa' role for SuperAdmin`);
            return 'empresa';
        }

        // Parallel checks for better performance - and BYPASSING CACHE
        // We use getDocFromServer to ensure we don't get a "null" result from local cache 
        // right after account creation.
        const [candidateSnap, companySnap, legacySnap] = await Promise.all([
            getDocFromServer(doc(db, 'users_candidatos', uid)).catch(e => {
                console.warn('⚠️ [getCurrentUserRole] users_candidatos check failed:', e.message);
                return getDoc(doc(db, 'users_candidatos', uid));
            }),
            getDocFromServer(doc(db, 'users_empresas', uid)).catch(e => {
                console.warn('⚠️ [getCurrentUserRole] users_empresas check failed:', e.message);
                return getDoc(doc(db, 'users_empresas', uid));
            }),
            getDocFromServer(doc(db, 'companies', uid)).catch(e => {
                console.warn('⚠️ [getCurrentUserRole] legacy companies check failed:', e.message);
                return getDoc(doc(db, 'companies', uid));
            })
        ]);

        const duration = Date.now() - startTime;
        if (candidateSnap.exists()) {
            console.log(`✅ [getCurrentUserRole] Found 'candidato' in ${duration}ms`);
            return 'candidato';
        }

        if (companySnap.exists()) {
            console.log(`✅ [getCurrentUserRole] Found 'empresa' (new) in ${duration}ms`);
            return 'empresa';
        }

        if (legacySnap.exists()) {
            console.log(`⚠️ [getCurrentUserRole] Found 'empresa' (legacy) in ${duration}ms`);
            return 'empresa';
        }

        console.error(`❌ [getCurrentUserRole] User NOT found in any collection after ${duration}ms!`);
        return null;
    } catch (error: any) {
        console.error(`❌ [getCurrentUserRole] Fatal Error after ${Date.now() - startTime}ms:`, error);
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
