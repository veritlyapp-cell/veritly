
import { Handler } from '@netlify/functions';
import { initializeApp } from 'firebase/app';
import { arrayUnion, doc, getDoc, getFirestore, increment, setDoc } from 'firebase/firestore';

// Firebase configuration (using same as config/firebase.ts)
const firebaseConfig = {
    apiKey: "AIzaSyBbQwiklf0kWnz5V2_l6PgPeL679NyGEJ8",
    authDomain: "auth.veritlyapp.com",
    projectId: "vinku-3a3af",
    storageBucket: "vinku-3a3af.firebasestorage.app",
    messagingSenderId: "1052083063406",
    appId: "1:1052083063406:web:20b981e0bf896caa7ab47f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export const handler: Handler = async (event) => {
    // A-01 FIX: CORS restringido a los dominios de Veritly (no wildcard)
    const allowedOrigins = ['https://www.veritlyapp.com', 'https://veritlyapp.com'];
    const origin = event.headers.origin || event.headers.Origin || '';
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Vary': 'Origin',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const { jobData, uid, cvText: providedCvText } = JSON.parse(event.body || '{}');

        if (!jobData || (!uid && !providedCvText)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: jobData and (uid or cvText)' })
            };
        }

        let cvText = providedCvText;

        // If UID is provided and no cvText, try to fetch it from Firestore
        if (uid && !cvText) {
            // Check multiple collections and fields for robustness
            // 'users' is where ProfileScreen saves detailed info
            // 'users_candidatos' is the base profile collection
            const collections = ['users', 'users_candidatos'];

            for (const colName of collections) {
                const userSnap = await getDoc(doc(db, colName, uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
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

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
            await setDoc(doc(db, 'users', uid), {
                history: arrayUnion(resultItem)
            }, { merge: true });

            // Deduct credit if applicable (simplified here)
            await setDoc(doc(db, 'user_credits', uid), {
                totalCreditsUsed: increment(1)
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
