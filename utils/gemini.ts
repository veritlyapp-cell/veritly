import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// 🔄 LISTA DE MODELOS OFICIALES (Actualizada dic 2025)
// La app probará en este orden hasta que uno funcione.
const MODELS_TO_TRY = [
    "gemini-2.5-flash",       // 1. Equilibrio ideal
    "gemini-2.5-flash-lite",  // 2. Respaldo rápido y eficiente
    "gemini-2.0-flash",       // 3. Versión anterior estable
    "gemini-2.5-pro",         // 4. Alta capacidad (si los flash fallan)
    "gemini-3-pro"            // 5. Última generación (si está disponible)
];

// --- FUNCIÓN INTELIGENTE DE PETICIÓN ---
const fetchWithFallback = async (body: any) => {
    let lastError = null;

    if (!API_KEY) throw new Error("Falta la API KEY en el archivo .env (EXPO_PUBLIC_GEMINI_API_KEY)");

    for (const model of MODELS_TO_TRY) {
        try {
            // console.log(`📡 Probando con modelo: ${model}...`); 
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
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

export const getBase64 = async (uri: string, webFile?: any) => {
    if (Platform.OS === 'web') {
        if (!webFile) throw new Error("Falta archivo Web");
        return await blobToBase64(webFile);
    } else {
        // En nativo usamos FileSystem para leer el binario a Base64
        return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
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
    RESPONDE JSON: { "questions": ["P1", "P2", "P3"] }
  `;

    try {
        if (mode === 'image') {
            const imageBase64 = await getBase64(jobData.uri, jobData.webFile);
            parts = [{ text: basePrompt }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }];
        } else {
            parts = [{ text: `${basePrompt}\n\nVACANTE: "${jobData}"` }];
        }

        const data = await fetchWithFallback({ contents: [{ parts }] });
        const cleanJson = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

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

// 5. ANALIZAR PERFIL DE PUESTO (JOB PROFILE)
// 5. ANALIZAR PERFIL DE PUESTO (JOB PROFILE)
// 5. ANALIZAR PERFIL DE PUESTO (JOB PROFILE) - Refactorizado estilo profile.tsx
export const analyzeJobProfile = async (fileUri: string, webFile?: any, mimeType: string = "application/pdf") => {
    try {
        // Leemos el archivo a Base64 aquí mismo, igual que en extractTextFromPDF
        const base64Data = await getBase64(fileUri, webFile);

        const prompt = `
        Actúa como un Experto en RRHH y Copywriter. Lee el siguiente documento (Perfil de Puesto o Descripción de Vacante).
        
        TAREAS:
        1.  Extrae los datos clave: Título del Puesto, Responsabilidades, Requisitos, Habilidades.
        2.  Genera un "Job Post" atractivo y profesional listo para publicar en LinkedIn/Bolsas de Trabajo.
        
        RESPONDE JSON: 
        { 
            "jobTitle": "Título del Puesto", 
            "summary": "Breve resumen del perfil",
            "structuredData": {
                "responsibilities": ["- Resp 1", "- Resp 2"],
                "requirements": ["- Req 1", "- Req 2"]
            },
            "jobPostContent": "Título: ... \\n\\n🚀 Buscamos... \\n\\n..." 
        }
        `;

        const body = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: base64Data } }
                ]
            }]
        };

        const data = await fetchWithFallback(body);
        const text = data.candidates[0].content.parts[0].text;
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (error: any) {
        console.error("Error Job Profile:", error);
        throw error;
    }
};

// 6. ANALIZAR MATCH DE CANDIDATOS (CVs vs JOB)
export const analyzeCVMatchBatch = async (cvFiles: { uri: string, webFile?: any, name: string, mimeType?: string }[], jobContext: string) => {
    // Gemini puede procesar múltiples archivos en una sola request si el modelo lo permite (Flash 2.0+), 
    // pero para seguridad y manejo de errores, procesaremos en paralelo o secuencia.
    // Dado que el usuario menciona "carpeta de 5 CVs", haremos promesas paralelas.

    const processSingleCV = async (cv: { uri: string, webFile?: any, name: string, mimeType?: string }) => {
        try {
            const base64CV = await getBase64(cv.uri, cv.webFile);

            const prompt = `
            Actúa como Senior Recruiter. 
            CONTEXTO DEL PUESTO: "${jobContext.substring(0, 1000)}..." (Resumen)
            
            TAREA: Analiza este CV y compáralo con el Puesto.
            
            RESPONDE JSON:
            {
                "candidateName": "Nombre completo extraído o 'Candidato'",
                "contact": { "email": "...", "phone": "..." },
                "matchPercentage": (0-100),
                "summary": "Justificación breve del match",
                "pros": ["Pro 1", "Pro 2"],
                "cons": ["Contra 1", "Contra 2"],
                "reason": "Veredicto final breve"
            }
            `;

            const body = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: cv.mimeType || "application/pdf", data: base64CV } }
                    ]
                }]
            };

            const data = await fetchWithFallback(body);
            const text = data.candidates[0].content.parts[0].text;
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);

            return { ...result, fileName: cv.name, originalUri: cv.uri };

        } catch (error: any) {
            console.error(`Error analizando CV ${cv.name}:`, error);
            return {
                candidateName: "Error leyendo CV",
                matchPercentage: 0,
                summary: "No se pudo procesar este archivo.",
                fileName: cv.name,
                originalUri: cv.uri,
                error: true
            };
        }
    };

    // Lanzamos todas las peticiones (Ojo con rate limits en producción, veritly funciona bien con pocas requests)
    const results = await Promise.all(cvFiles.map(processSingleCV));

    // Ordenar por match descendente
    return results.sort((a, b) => b.matchPercentage - a.matchPercentage);
};

// ... (Tu código existente llega hasta generateCareerAdvice)

// ==========================================
// 🚀 NUEVAS FUNCIONES PARA EL MÓDULO EMPRESA
// ==========================================

// 5. ANALIZAR DESCRIPCIÓN DE PUESTO (Etapa 1: Creación)
// 5. ANALIZAR DESCRIPCIÓN DE PUESTO (Texto Manual)
export const analyzeJobDescription = async (rawDescription: string) => {
    const prompt = `
        Actúa como un experto en RRHH y Copywriting.
        TAREA: Analiza esta descripción cruda de puesto.
        
        DESCRIPCIÓN RAW: "${rawDescription}"
        
        RESPONDE JSON:
        { 
            "jobTitle": "Título del Puesto", 
            "summary": "Breve resumen del perfil",
            "structuredData": {
                "responsibilities": ["- Resp 1", "- Resp 2"],
                "requirements": ["- Req 1", "- Req 2"]
            },
            "jobPostContent": "Título: ... \\n\\n🚀 Buscamos... \\n\\n..." 
        }
    `;

    try {
        const body = { contents: [{ parts: [{ text: prompt }] }] };
        const data = await fetchWithFallback(body);
        const cleanJson = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error: any) {
        console.error("Error analizando Job Description:", error);
        throw error;
    }
};

// 6. ANALIZAR CANDIDATO MODO EMPRESA (Etapa 3: Batch Processing)
export const analyzeCandidateForCompany = async (cvText: string, jobDescription: string) => {
    const prompt = `
      Actúa como Reclutador Senior.
      TAREA: Analiza este CV contra la Descripción del Puesto.
      
      PUESTO: "${jobDescription.substring(0, 2000)}" 
      CV: "${cvText.substring(0, 3000)}"
      
      RESPONDE JSON EXCLUSIVAMENTE:
      {
        "name": "Nombre Candidato",
        "email": "email@ejemplo.com (o null)",
        "score": number (0-100),
        "summary": "Resumen de 3 líneas justificando el score.",
        "pros": ["Pro 1", "Pro 2"],
        "cons": ["Contra 1", "Contra 2"]
      }
    `;

    try {
        const body = { contents: [{ parts: [{ text: prompt }] }] };
        const data = await fetchWithFallback(body);
        const cleanJson = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error: any) {
        console.error("Error analizando Candidato:", error);
        return null;
    }
};