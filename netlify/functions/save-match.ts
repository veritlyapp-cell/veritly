
import { Handler } from '@netlify/functions';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_firebaseAdmin';
import { getCorsHeaders, checkRateLimit } from './_security';

// ⚠️ Sin EXPO_PUBLIC_ — esta key NUNCA sale al cliente
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

// Confirma que el idToken recibido pertenece realmente al uid indicado,
// para que nadie pueda gastar créditos o escribir en el historial de otro usuario.
async function verifyUidFromToken(idToken: string): Promise<string | null> {
    if (!FIREBASE_API_KEY) return null;
    try {
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });
        const data = await res.json();
        if (!res.ok || !data.users || !data.users[0]) return null;
        return data.users[0].localId;
    } catch {
        return null;
    }
}

export const handler: Handler = async (event) => {
    const origin = event.headers.origin || event.headers.Origin || '';
    const headers = getCorsHeaders(origin);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    // ── Rate Limiting ──────────────────────────────────────────────────────
    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({ error: 'Demasiadas solicitudes. Intenta en 1 minuto.' })
        };
    }

    try {
        const { jobData, uid, idToken, cvText: providedCvText } = JSON.parse(event.body || '{}');

        if (!jobData || (!uid && !providedCvText)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: jobData and (uid or cvText)' })
            };
        }

        // Si viene un uid, exigimos probar que el llamante ES ese usuario antes de
        // leer su CV o tocar su historial/créditos.
        if (uid) {
            if (!idToken) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Falta idToken para autenticar al usuario' })
                };
            }
            const verifiedUid = await verifyUidFromToken(idToken);
            if (!verifiedUid || verifiedUid !== uid) {
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ error: 'El idToken no corresponde al uid indicado' })
                };
            }
        }

        let cvText = providedCvText;

        // If UID is provided and no cvText, try to fetch it from Firestore
        if (uid && !cvText) {
            // Check multiple collections and fields for robustness
            // 'users' is where ProfileScreen saves detailed info
            // 'users_candidatos' is the base profile collection
            const collections = ['users', 'users_candidatos'];

            for (const colName of collections) {
                const userSnap = await adminDb.collection(colName).doc(uid).get();
                if (userSnap.exists) {
                    const userData = userSnap.data()!;
                    // Try to find the CV text in various possible fields
                    cvText =
                        userData.profile?.contextForAI ||
                        userData.profile?.bio ||
                        userData.profile?.experience ||
                        userData.profile?.summary ||
                        userData.bio ||
                        userData.contextForAI ||
                        '';

                    if (cvText) {
                        console.log(`✅ Found CV text in collection '${colName}'`);
                        break;
                    }
                }
            }
        }

        if (!cvText) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No CV data found for this user. Please upload your CV first.' })
            };
        }

        // Call Gemini (minimal implementation to avoid too many dependencies)
        const prompt = `
            Actúa como un Senior Recruiter. Analiza la compatibilidad entre este CV y esta Vacante.
            
            CV: "${cvText}"
            VACANTE: "${jobData.title} - ${jobData.company} - ${jobData.description}"
            
            RESPONDE SOLO JSON: {
                "matchScore": (0-100),
                "missingKeywords": ["keyword1", "keyword2"],
                "tips": ["Tip 1", "Tip 2"],
                "role": "Cargo de la vacante",
                "company": "Empresa de la vacante"
            }
        `;

        // Gemini 2.5 se apaga el 16 de octubre de 2026. gemini-3.5-flash-lite es
        // el más rápido de la familia 3.x (~350 tokens/seg, $0.30/$2.50).
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0 }
            })
        });

        if (!geminiRes.ok) {
            const errorData = await geminiRes.json();
            throw new Error(`Gemini API Error: ${errorData.error?.message || geminiRes.statusText}`);
        }

        const geminiData = await geminiRes.json();

        if (!geminiData.candidates || geminiData.candidates.length === 0) {
            console.error("Gemini Response:", JSON.stringify(geminiData));
            throw new Error('El asistente IA no pudo generar una respuesta. Por favor intenta de nuevo.');
        }

        const aiText = geminiData.candidates[0].content.parts[0].text;

        // Clean JSON (more robustly)
        let cleanJson = aiText.trim();
        if (cleanJson.includes('```')) {
            cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        // Final fallback: try to find the first { and last }
        const startIdx = cleanJson.indexOf('{');
        const endIdx = cleanJson.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
            cleanJson = cleanJson.substring(startIdx, endIdx + 1);
        }

        const analysis = JSON.parse(cleanJson);

        // Save to Firestore if UID is provided
        if (uid) {
            const resultItem = {
                ...analysis,
                jobUrl: jobData.url,
                analyzedAt: new Date().toISOString(),
                source: 'extension'
            };

            // Save to user history
            await adminDb.collection('users').doc(uid).set({
                history: FieldValue.arrayUnion(resultItem)
            }, { merge: true });

            // Deduct credit if applicable (simplified here)
            await adminDb.collection('user_credits').doc(uid).set({
                totalCreditsUsed: FieldValue.increment(1)
            }, { merge: true });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(analysis)
        };

    } catch (error: any) {
        console.error("❌ Error in save-match:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal Server Error' })
        };
    }
};
