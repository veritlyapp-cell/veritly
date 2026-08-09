/**
 * _verifyAuth.ts — Verifica el idToken de Firebase enviado por el cliente
 * usando Admin SDK, para no confiar nunca en un uid que el cliente afirme
 * ser el suyo. Prefijo _ para que Netlify NO lo exponga como endpoint.
 */
import { getAuth } from 'firebase-admin/auth';
import './_firebaseAdmin'; // asegura que la app de Admin SDK ya esté inicializada

export async function verifyIdToken(idToken: string | undefined): Promise<{ uid: string; email?: string } | null> {
    if (!idToken) return null;
    try {
        const decoded = await getAuth().verifyIdToken(idToken);
        return { uid: decoded.uid, email: decoded.email };
    } catch {
        return null;
    }
}
