
import { Platform } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// 🔄 LISTA DE MODELOS OFICIALES (Actualizada dic 2025)
// La app probará en este orden hasta que uno funcione.
const MODELS_TO_TRY = [
    "gemini-2.5-flash",       // 1. Equilibrio ideal
    "gemini-2.5-flash-lite",  // 2. Respaldo rápido y eficiente
    "gemini-2.0-flash",       // 3. Versión anterior estable
    "gemini-2.5-pro"         // 4. Alta capacidad (si los flash fallan)
    //"gemini-3-pro"            // 5. Última generación (si está disponible)
];

// --- FUNCIÓN INTELIGENTE DE PETICIÓN ---
const fetchWithFallback = async (body: any) => {
    let lastError = null;

    for (const model of MODELS_TO_TRY) {
        try {
            // console.log(`📡 Probando con modelo: ${model}...`); 
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, generationConfig: { temperature: 0 } })
            });

            const data = await response.json();

            // Si hay error, probamos el siguiente modelo
            if (data.error) {
                console.warn(`⚠️ Falló ${model}:`, data.error.message);
                throw new Error(data.error.message);
            }

            console.log(`✅ ¡Conectado con ${model}!`);
            return data;

        } catch (e: any) {
            lastError = e;
            // Si es el último modelo y falló, nos rendimos
            if (model === MODELS_TO_TRY[MODELS_TO_TRY.length - 1]) break;
        }
    }
    throw lastError;
};

// Helpers de Archivos
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
    });
};

const getBase64 = async (uri: string, webFile?: any) => {
    if (Platform.OS === 'web') {
        if (!webFile) throw new Error("Falta archivo Web");
        return await blobToBase64(webFile);
    } else {
        const response = await fetch(uri);
        const blob = await response.blob();
        return await blobToBase64(blob);
    }
}

// 1. LEER PDF
export const extractTextFromPDF = async (fileUri: string, webFile?: any) => {
    try {
        const base64Data = await getBase64(fileUri, webFile);

        const body = {
            contents: [{
                parts: [
                    { text: "Eres un experto en RRHH. Extrae del CV: Perfil, Skills y Experiencia. Haz un resumen claro." },
                    { inline_data: { mime_type: "application/pdf", data: base64Data } }
                ]
            }]
        };

        const data = await fetchWithFallback(body);
        return data.candidates[0].content.parts[0].text;

    } catch (error: any) {
        throw new Error(error.message);
    }
};

// 2. ANALIZAR MATCH
export const analyzeWithGemini = async (profile: string, jobData: string | any, mode: 'link' | 'text' | 'image', aspirations: string = "") => {
    let parts: any[] = [];
    const basePrompt = `
    Actúa como un **Senior Technical Recruiter**.
    DATOS: CANDIDATO: "${profile}", ASPIRACIONES: "${aspirations}"
    INSTRUCCIONES:
    1. Extrae CARGO y EMPRESA (o "No especificado").
    2. Detecta SOBRECALIFICACIÓN en 'reason' si aplica.
    3. Calcula MATCH (0-100) siendo estricto.
    RESPONDE JSON: { "role": "Cargo", "company": "Empresa", "match": (0-100), "reason": "Veredicto", "tips": ["Tip 1", "Tip 2", "Tip 3"] }
  `;

    try {
        if (mode === 'image') {
            const imageBase64 = await getBase64(jobData.uri, jobData.webFile);
            parts = [{ text: basePrompt + "\n\nVACANTE (IMAGEN):" }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }];
        } else {
            parts = [{ text: `${basePrompt}\n\nVACANTE (${mode}): "${jobData}"` }];
        }

        const data = await fetchWithFallback({ contents: [{ parts }] });
        const cleanJson = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (error: any) {
        throw error;
    }
};

// 3. GENERAR PREGUNTAS
export const generateInterviewQuestions = async (profile: string, jobData: string | any, mode: 'link' | 'text' | 'image') => {
    let parts: any[] = [];
    const basePrompt = `
    Actúa como Headhunter. Genera 3 preguntas de entrevista difíciles para: "${profile}".
    IMPORTANTE: RESPONDE SOLO CON EL JSON. NO ESCRIBAS NADA MÁS.
    FORMATO: { "questions": ["P1", "P2", "P3"] }
  `;

    try {
        if (mode === 'image') {
            const imageBase64 = await getBase64(jobData.uri, jobData.webFile);
            parts = [{ text: basePrompt }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }];
        } else {
            parts = [{ text: `${basePrompt}\n\nVACANTE: "${jobData}"` }];
        }

        const data = await fetchWithFallback({ contents: [{ parts }] });
        const textResponse = data.candidates[0].content.parts[0].text;

        // Extracción robusta de JSON (busca el primer { y el último })
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("La respuesta no contiene JSON válido: " + textResponse.substring(0, 50));

        return JSON.parse(jsonMatch[0]);

    } catch (error: any) {
        console.error("Error Entrevista:", error);
        throw error;
    }
};

// 4. COACH DE CARRERA
export const generateCareerAdvice = async (historyJson: string) => {
    const prompt = `Actúa como Coach de Carrera. Analiza: ${historyJson}. RESPONDE JSON: { "advice": "Consejo breve..." }`;
    try {
        const data = await fetchWithFallback({ contents: [{ parts: [{ text: prompt }] }] });
        const cleanJson = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error: any) {
        return { advice: "Sigue guardando análisis." };
    }
};