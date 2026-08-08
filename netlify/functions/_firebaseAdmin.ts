/**
 * _firebaseAdmin.ts — Inicialización compartida de Firebase Admin SDK.
 * Prefijo _ para que Netlify NO lo exponga como endpoint público.
 *
 * A diferencia del SDK de cliente (firebase/firestore), el Admin SDK se
 * autentica con una cuenta de servicio y se salta las reglas de seguridad
 * de Firestore por diseño — por eso solo debe usarse en código de servidor
 * de confianza (estas Functions), nunca en el cliente.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
    const existing = getApps();
    if (existing.length > 0) return existing[0];

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountJson) {
        throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_KEY en las variables de entorno');
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    return initializeApp({
        credential: cert(serviceAccount),
    });
}

export const adminDb = getFirestore(getAdminApp());
