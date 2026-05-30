
import mammoth from 'mammoth';
import { Platform } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// 🔄 LISTA DE MODELOS OFICIALES (Actualizada mayo 2026)
// La app probará en este orden hasta que uno funcione.
const MODELS_TO_TRY = [
    "gemini-2.5-flash",      // 1. Principal — Alta velocidad (880ms)
    "gemini-2.5-flash-lite", // 2. Ligero — Excelente velocidad (~1100ms)
    "gemini-3.1-flash-lite", // 3. Vanguardia — Eficiencia (~1700ms)
    "gemini-2.5-pro"         // 4. Premium — Razonamiento superior como fallback
];

// --- FUNCIÓN INTELIGENTE DE PETICIÓN ---
const fetchWithFallback = async (body: any) => {
    let lastError = null;

    for (const model of MODELS_TO_TRY) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

            // console.log(`📡 Llamando a ${model} vía ${apiVersion}...`);

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

const getBase64 = async (uri: string, webFile?: any): Promise<string> => {
    // 0. Si ya es un Base64 o Data URI, no hacer fetch
    if (uri && (uri.startsWith('data:') || uri.length > 500)) {
        if (uri.startsWith('data:')) return uri.split(',')[1];
        if (!uri.startsWith('http') && !uri.startsWith('blob:') && !uri.startsWith('file:')) return uri;
    }
    // 1. Intento directo con objeto File (optimizado para Web)
    if (Platform.OS === 'web' && webFile) {
        // Verificar que sea un Blob válido
        if (webFile instanceof Blob) {
            const result = await blobToBase64(webFile);
            if (typeof result === 'string' && result.length > 0) {
                return result;
            }
        }
        // Si webFile existe pero no es Blob, intentamos fetch al URI
        console.warn("webFile no es Blob válido, intentando fetch...");
    }

    // 2. Fallback: Fetch al URI (funciona en Native y en Web con blob: URIs)
    try {
        const response = await fetch(uri);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const result = await blobToBase64(blob);
        if (typeof result !== 'string' || result.length === 0) {
            throw new Error("Conversión a base64 falló");
        }
        return result;
    } catch (e: any) {
        throw new Error(`Falló lectura de archivo (${Platform.OS}): ${e.message}`);
    }
}

// 1. LEER DOCUMENTO (PDF, DOCX, TXT)
export const extractTextFromDocument = async (fileUri: string, mimeType: string = 'application/pdf', webFile?: any) => {
    try {
        // DOCX Auto-detection: check if URI is base64 and starts with DOCX/ZIP signature
        const isDocx = (typeof mimeType === 'string' && (mimeType.includes('word') || mimeType.includes('officedocument') || mimeType.includes('msword'))) ||
                       (fileUri && (fileUri.startsWith('UEsDBBQ') || fileUri.startsWith('AQAAIAQAABMAA') || fileUri.startsWith('0M8R4KGx')));

        if (isDocx) {
            console.log("📝 Detectado Word - Usando mammoth para extraer texto...");

            let arrayBuffer: ArrayBuffer;

            if (Platform.OS === 'web' && webFile && webFile instanceof Blob) {
                arrayBuffer = await webFile.arrayBuffer();
            } else if (fileUri && (fileUri.startsWith('data:') || !fileUri.startsWith('http'))) {
                // Es un base64 o data URI
                const rawBase64 = fileUri.includes(',') ? fileUri.split(',')[1] : fileUri;
                try {
                    const byteCharacters = atob(rawBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    arrayBuffer = byteArray.buffer;
                } catch (atobErr) {
                    console.error("Error decodificando base64 para mammoth:", atobErr);
                    throw new Error("El archivo Word parece estar corrupto o en un formato base64 inválido.");
                }
            } else {
                const response = await fetch(fileUri);
                const blob = await response.blob();
                arrayBuffer = await blob.arrayBuffer();
            }

            const result = await mammoth.extractRawText({ arrayBuffer });
            const extractedText = result.value;

            if (!extractedText || extractedText.trim().length === 0) {
                throw new Error("No se pudo extraer texto del documento Word.");
            }

            console.log("✅ Texto extraído de DOCX. Longitud:", extractedText.length);
            return extractedText;
        }

        // PDF y otros: Enviar a Gemini
        const base64Data = await getBase64(fileUri, webFile);

        if (typeof base64Data !== 'string' || base64Data.length === 0) {
            throw new Error("No se pudo convertir el archivo a base64");
        }

        const body = {
            contents: [{
                parts: [
                    { text: "Eres un experto en RRHH. Resume este CV omitiendo saludos o comentarios como 'Aquí está el resumen'. Muestra SOLAMENTE la información pura: Perfil, Skills y Experiencia." },
                    { inline_data: { mime_type: mimeType || 'application/pdf', data: base64Data } }
                ]
            }]
        };

        const data = await fetchWithFallback(body);
        return data.candidates[0].content.parts[0].text;

    } catch (error: any) {
        console.error("❌ Error en extractTextFromDocument:", error);
        throw new Error(error.message);
    }
};

// Alias para compatibilidad
export const extractTextFromPDF = extractTextFromDocument;

// 2. ANALIZAR MATCH CON MEJORAS DE CV
export const analyzeWithGemini = async (profile: string, jobData: string | any, mode: 'link' | 'text' | 'image', aspirations: string = "") => {
    let parts: any[] = [];
    const basePrompt = `
    Actúa como un **Senior Technical Recruiter**.
    
    DATOS DEL CANDIDATO (su CV): "${profile}"
    ASPIRACIONES DEL CANDIDATO: "${aspirations}"
    
    INSTRUCCIONES CLAVE:
    1. **IMPORTANTE**: Extrae el CARGO y EMPRESA de la **VACANTE/ANUNCIO DE TRABAJO** que te proporciono, NO del CV del candidato. Si el anuncio no especifica empresa, pon "No especificado".
    2. Detecta **SOBRECALIFICACIÓN**: Si el perfil excede por mucho la vacante, el match debe ser bajo (30-50%) PERO el tip debe ser: "Adapta tu CV para resaltar humildad y enfoque operativo" (No digas "no postules").
    3. Detecta **CONFLICTO DE INTERESES**: Si el candidato busca Minería y la vacante es Retail, baja el match, y el tip debe ser: "Considera ajustar tus intereses clave (Ej: 'Retail') si te interesa este sector".
    4. Calcula MATCH (0-100) siendo estricto pero justo.
    5. **ANALIZA EL CV**: Identifica qué le FALTA al CV del candidato para esta vacante específica.
    6. **KEYWORDS**: Sugiere keywords clave que debería incluir en su CV para mejorar su match.
    7. **MEJORAS**: Da 2-3 recomendaciones específicas de cómo mejorar el CV para esta vacante.
    
    RESPONDE SOLO JSON: { 
      "role": "Cargo DE LA VACANTE (no del CV)", 
      "company": "Empresa QUE PUBLICA LA VACANTE (no donde trabajó el candidato)", 
      "match": (0-100), 
      "reason": "Veredicto Breve", 
      "tips": ["Tip Estratégico 1", "Tip Estratégico 2", "Tip Estratégico 3"],
      "cvGaps": ["Elemento faltante 1", "Elemento faltante 2"],
      "suggestedKeywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
      "cvImprovements": ["Mejora específica 1", "Mejora específica 2"]
    }
  `;

    try {
        if (mode === 'image') {
            const imageBase64 = await getBase64(jobData.uri, jobData.webFile);
            if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
                throw new Error("No se pudo convertir la imagen a base64");
            }
            parts = [
                { text: basePrompt + "\n\nVACANTE (IMAGEN):" },
                { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
            ];
        } else {
            parts = [{ text: `${basePrompt}\n\nVACANTE (${mode}): "${jobData}"` }];
        }

        const data = await fetchWithFallback({ contents: [{ parts }] });
        const textResponse = data.candidates[0].content.parts[0].text;

        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("La respuesta de IA no contiene un formato válido.");
        
        return JSON.parse(jsonMatch[0]);

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
            if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
                throw new Error("No se pudo convertir la imagen a base64");
            }
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

// 5. OPTIMIZAR PERFIL - Sugerencias para mejorar el CV
export const generateProfileOptimization = async (cvText: string, userInfo: string = "") => {
    const prompt = `
    Actúa como un **Experto en Optimización de CVs y LinkedIn**.
    
    DATOS DEL CV ACTUAL:
    "${cvText}"
    
    INFORMACIÓN ADICIONAL DEL USUARIO:
    "${userInfo}"
    
    INSTRUCCIONES:
    1. Analiza el CV y detecta:
       - Puntos fuertes (qué está bien)
       - Debilidades (qué falta o está mal presentado)
       - Keywords importantes que faltan
       - Errores comunes (buzzwords sin sustento, falta de métricas, etc.)
    
    2. Genera:
       - Un "Perfil Profesional" optimizado (2-3 líneas) listo para copiar
       - 3-5 sugerencias específicas de mejora
       - Lista de keywords que debería incluir
       - Un título profesional sugerido
    
    3. IMPORTANTE: El perfil debe ser:
       - Conciso y poderoso
       - Basado en los logros REALES del CV
       - Con lenguaje orientado a resultados
       - Sin exageraciones
    
    RESPONDE SOLO JSON:
    {
      "suggestedTitle": "Título profesional optimizado",
      "optimizedProfile": "Perfil profesional de 2-3 líneas listo para usar",
      "strengths": ["Fortaleza 1", "Fortaleza 2"],
      "weaknesses": ["Debilidad 1", "Debilidad 2"],
      "improvements": ["Mejora específica 1", "Mejora específica 2", "Mejora específica 3"],
      "missingKeywords": ["keyword1", "keyword2", "keyword3"],
      "overallScore": 75
    }
    `;

    try {
        const data = await fetchWithFallback({ contents: [{ parts: [{ text: prompt }] }] });
        const cleanJson = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error: any) {
        throw new Error(`Error optimizando perfil: ${error.message}`);
    }
};