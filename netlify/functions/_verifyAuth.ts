/**
 * _verifyAuth.ts — Verifica el idToken de Firebase enviado por el cliente
 * usando Admin SDK, para no confiar nunca en un uid que el cliente afirme
 * ser el suyo. Prefijo _ para que Netlify NO lo exponga como endpoint.
 */
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from './_firebaseAdmin'; // tambien asegura que la app de Admin SDK ya esté inicializada

export async function verifyIdToken(idToken: string | undefined): Promise<{ uid: string; email?: string } | null> {
    if (!idToken) return null;
    try {
        const decoded = await getAuth().verifyIdToken(idToken);
        return { uid: decoded.uid, email: decoded.email };
    } catch {
        return null;
    }
}

// El usuario es el dueño de la cuenta de empresa o un miembro de su equipo.
export async function isCompanyMember(uid: string, companyId: string): Promise<boolean> {
    if (uid === companyId) return true;
    const snap = await adminDb.collection('team_members').doc(uid).get();
    if (!snap.exists) return false;
    return snap.data()?.companyId === companyId;
}
