import { createUserWithEmailAndPassword, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocFromServer, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { sendAdminNotification } from './notification-service';
import { trackCompleteRegistration } from '../utils/fbPixel';

export type UserRole = 'candidato' | 'empresa';

// Cache to prevent redundant DB calls during session navigation
const userRoleCache: Record<string, UserRole> = {};

// Helper to clear cache (e.g. on logout if needed)
export function clearUserRoleCache() {
    for (const key in userRoleCache) {
        delete userRoleCache[key];
    }
}

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
        planId?: string;
        plan: string;
        aiAnalysisLimit: number;
        internalVacanciesLimit: number;
        publicVacanciesLimit: number;
        killerQuestionsLimit?: number;
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
        userRoleCache[user.uid] = 'candidato';

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
        // Las reglas de Firestore restringen "list" sobre estas colecciones a
        // dueño/admin (para que nadie enumere candidatos/empresas), así que este
        // chequeo previo SIEMPRE falla por permisos para un visitante anónimo
        // registrándose. No bloqueamos el registro por esto: Firebase Auth ya
        // impide de raíz dos cuentas con el mismo email (createUserWithEmailAndPassword
        // lanza 'auth/email-already-in-use'), así que en el peor caso el usuario
        // ve ese error nativo en vez de nuestro mensaje amigable.
        console.warn("No se pudo verificar disponibilidad de email (se omite el chequeo previo):", error);
        return { available: true };
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
                planId: 'beta_free',
                plan: 'beta_free',
                aiAnalysisLimit: 100,
                internalVacanciesLimit: 5,
                publicVacanciesLimit: 5,
                killerQuestionsLimit: 3,
                candidatesAnalyzed: 0,
                status: 'active'
            },
            profileCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log(`📡 [auth-service] Creando documento Firestore para empresa: ${user.uid}`);
        await setDoc(doc(db, 'users_empresas', user.uid), companyProfile);
        userRoleCache[user.uid] = 'empresa';
        console.log('✅ [auth-service] Documento Firestore creado exitosamente.');

        // Notify Admin
        sendAdminNotification('company', {
            name: companyProfile.company.name,
            email: user.email || email,
            id: companyProfile.company.ruc || (companyProfile.company as any).dni
        });

        // Reporta la conversión real a Meta Ads (no solo el clic al anuncio)
        trackCompleteRegistration();

        return user;
    } catch (error: any) {
        console.error('❌ [auth-service] Error creating company user:', error);
        throw error;
    }
}

// Cache for team membership resolution (uid -> companyId or null if not a team member)
const effectiveCompanyIdCache: Record<string, string> = {};

/**
 * Resolves the Firestore "companyId" a user's data actually lives under.
 * For the account owner this is their own uid. For an invited team member
 * (recruiter/admin added via Team invites), their own uid is different from
 * the company's uid, so we look up team_members/{uid} to find the real one.
 */
export async function getEffectiveCompanyId(uid: string): Promise<string> {
    if (effectiveCompanyIdCache[uid]) {
        return effectiveCompanyIdCache[uid];
    }
    try {
        const teamMemberSnap = await getDoc(doc(db, 'team_members', uid));
        if (teamMemberSnap.exists()) {
            const companyId = teamMemberSnap.data().companyId as string;
            effectiveCompanyIdCache[uid] = companyId;
            return companyId;
        }
    } catch (error) {
        console.warn('⚠️ [getEffectiveCompanyId] team_members check failed, falling back to own uid:', error);
    }
    effectiveCompanyIdCache[uid] = uid;
    return uid;
}

export type CompanyMembership = { companyId: string; role: 'owner' | 'admin' | 'reclutador' };
const membershipCache: Record<string, CompanyMembership> = {};

/**
 * Like getEffectiveCompanyId, but also returns the user's role within the
 * company: 'owner' (the original account, uid === companyId), or the role
 * assigned in team_members ('admin' | 'reclutador') for invited members.
 */
export async function getEffectiveMembership(uid: string): Promise<CompanyMembership> {
    if (membershipCache[uid]) {
        return membershipCache[uid];
    }
    try {
        const teamMemberSnap = await getDoc(doc(db, 'team_members', uid));
        if (teamMemberSnap.exists()) {
            const data = teamMemberSnap.data();
            const membership: CompanyMembership = { companyId: data.companyId, role: data.role };
            membershipCache[uid] = membership;
            return membership;
        }
    } catch (error) {
        console.warn('⚠️ [getEffectiveMembership] team_members check failed, falling back to owner:', error);
    }
    const membership: CompanyMembership = { companyId: uid, role: 'owner' };
    membershipCache[uid] = membership;
    return membership;
}

/**
 * Gets the role of the current user from Firestore
 * Includes fallback to legacy 'companies' collection for existing users
 */
export async function getCurrentUserRole(uid: string): Promise<UserRole | null> {
    const startTime = Date.now();
    try {
        if (userRoleCache[uid]) {
            console.log(`⚡ [getCurrentUserRole] Cache hit for UID: ${uid.substring(0, 8)}... -> ${userRoleCache[uid]}`);
            return userRoleCache[uid];
        }

        console.log(`🔍 [getCurrentUserRole] Checking role for UID: ${uid.substring(0, 8)}...`);

        // Check user auth to find email
        const user = auth.currentUser;
        if (user && user.uid === uid && user.email === 'oscar@veritlyapp.com') {
            console.log(`👑 [getCurrentUserRole] Forcing 'empresa' role for SuperAdmin`);
            userRoleCache[uid] = 'empresa';
            return 'empresa';
        }

        // Parallel checks for better performance - and BYPASSING CACHE
        // We use getDocFromServer to ensure we don't get a "null" result from local cache 
        // right after account creation.
        const [candidateSnap, companySnap, legacySnap, teamMemberSnap] = await Promise.all([
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
            }),
            getDocFromServer(doc(db, 'team_members', uid)).catch(e => {
                console.warn('⚠️ [getCurrentUserRole] team_members check failed:', e.message);
                return getDoc(doc(db, 'team_members', uid));
            })
        ]);

        const duration = Date.now() - startTime;

        if (companySnap.exists()) {
            console.log(`✅ [getCurrentUserRole] Found 'empresa' (new) in ${duration}ms`);
            userRoleCache[uid] = 'empresa';
            return 'empresa';
        }

        if (teamMemberSnap.exists()) {
            console.log(`✅ [getCurrentUserRole] Found 'empresa' (miembro de equipo) in ${duration}ms`);
            userRoleCache[uid] = 'empresa';
            return 'empresa';
        }

        if (legacySnap.exists()) {
            console.log(`⚠️ [getCurrentUserRole] Found 'empresa' (legacy) in ${duration}ms`);
            userRoleCache[uid] = 'empresa';
            return 'empresa';
        }

        if (candidateSnap.exists()) {
            console.log(`✅ [getCurrentUserRole] Found 'candidato' in ${duration}ms`);
            userRoleCache[uid] = 'candidato';
            return 'candidato';
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
