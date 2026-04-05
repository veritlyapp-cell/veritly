



const API_KEY = process.env.EXPO_PUBLIC_COMPANY_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("⚠️ No hay API KEY configurada para empresa. Configura EXPO_PUBLIC_COMPANY_API_KEY o EXPO_PUBLIC_GEMINI_API_KEY en .env");
}

// 🔄 Modelos para EMPRESA (Priorizamos capacidad sobre velocidad si es necesario)
const MODELS_TO_TRY = [
    "gemini-2.5-flash",
    "gemini-2.0-flash"
];

const fetchWithFallback = async (body: any) => {
    if (!API_KEY) throw new Error("Falta configurar la API KEY de Empresa (EXPO_PUBLIC_COMPANY_API_KEY).");

    let lastError = null;

    for (const model of MODELS_TO_TRY) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, generationConfig: { temperature: 0.2 } }) // Un poco más de creatividad para Job Descriptions
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return data;

        } catch (e: any) {
            lastError = e;
            if (model === MODELS_TO_TRY[MODELS_TO_TRY.length - 1]) break;
        }
    }
    throw lastError;
};

// 0. VALIDAR TIPO DE DOCUMENTO
export const validateDocumentType = async (text: string): Promise<{ isJobProfile: boolean; detectedType: string; confidence: number }> => {
    const prompt = `
    Analiza el siguiente texto y determina qué tipo de documento es.
    
    TEXTO:
    """
    ${text.substring(0, 2000)}
    """
    
    TIPOS POSIBLES:
    - "job_profile": Descripción de puesto, perfil de búsqueda, requisitos de un cargo
    - "cv": Currículum vitae, hoja de vida, resumen profesional de una persona
    - "contract": Contrato laboral, acuerdo de servicios
    - "policy": Política de empresa, reglamento interno
    - "other": Otro tipo de documento

    RESPONDE SOLO JSON:
    {
        "detectedType": "(uno de los tipos anteriores)",
        "confidence": (0-100),
        "reason": "Breve explicación de por qué es este tipo"
    }
    `;

    try {
        const response = await fetchWithFallback({
            contents: [{ parts: [{ text: prompt }] }]
        });
        const candidate = response.candidates[0].content.parts[0].text;
        const jsonString = candidate.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(jsonString);

        return {
            isJobProfile: result.detectedType === 'job_profile',
            detectedType: result.detectedType,
            confidence: result.confidence || 0
        };
    } catch (e) {
        console.error("Error validando tipo de documento:", e);
        // En caso de error, asumimos que es válido para no bloquear
        return { isJobProfile: true, detectedType: 'unknown', confidence: 0 };
    }
};


// 1. EXTRAER DATOS ESTRUCTURADOS (Desde Texto o PDF convertido)
export const extractJobData = async (text: string) => {
    const prompt = `
    Analiza la siguiente Descripción de Puesto y extrae los datos clave en formato JSON estrictamente.
    
    TEXTO DEL PUESTO:
    """
    ${text}
    """

    SCHEMA REQUERIDO:
    {
        "jobTitle": "Título normalizado del puesto",
        "requiredExperience": "Años o nivel de experiencia (ej: '2-3 años', 'Senior')",
        "hardSkills": ["Lista", "de", "habilidades", "técnicas"],
        "softSkills": ["Lista", "de", "habilidades", "blandas"],
        "education": "Requisitos educativos",
        "location": "Ubicación si se menciona",
        "salaryRange": "Rango salarial si se menciona o null"
    }

    Responde SOLO con el JSON válido.
    `;

    try {
        const response = await fetchWithFallback({
            contents: [{ parts: [{ text: prompt }] }]
        });

        const candidate = response.candidates[0].content.parts[0].text;
        // Limpiamos bloques de código si Gemini los pone
        const jsonString = candidate.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Error al extraer datos del puesto:", e);
        throw e;
    }
};

// 2. OPTIMIZAR DESCRIPCIÓN CON CONTEXTO DE EMPRESA
interface CompanyContext {
    nombreComercial?: string;
    rubro?: string;
    beneficios?: string;
}

export const optimizeJobDescription = async (text: string, companyContext?: CompanyContext) => {
    const companyIntro = companyContext?.nombreComercial && companyContext?.rubro
        ? `La empresa "${companyContext.nombreComercial}", del sector ${companyContext.rubro}, está en la búsqueda de...`
        : '';

    const beneficiosSection = companyContext?.beneficios
        ? `\nIncluye estos beneficios en la sección de "Ofrecemos": ${companyContext.beneficios}`
        : '';

    const prompt = `
    Actúa como un reclutador experto. Genera una OFERTA DE TRABAJO profesional y atractiva basada en el perfil de puesto.
    
    ${companyIntro ? `IMPORTANTE: Inicia la oferta mencionando: "${companyIntro}"` : ''}
    ${beneficiosSection}
    
    PERFIL DE PUESTO:
    """
    ${text}
    """
    
    INSTRUCCIONES DE FORMATO (ESTRICTO):
    1. NO uses saludos ni frases conversacionales como "¡Excelente!", "Aquí tienes...", "Espero que te guste".
    2. NO uses formato Markdown de encabezados (#, ##, ###) ni negritas (**texto**).
    3. Usa SOLO texto plano y viñetas simples (• o -) para listas.
    4. Estructura:
       - Título del puesto (en mayúsculas)
       - Párrafo de introducción (empresa y propósito del puesto)
       - Responsabilidades (usa viñetas)
       - Requisitos (usa viñetas)
       - Ofrecemos (usa viñetas, incluye los beneficios de la empresa si hay)
       - Cómo postular

    Empieza DIRECTAMENTE con el Título del Puesto.
    `;

    try {
        const response = await fetchWithFallback({
            contents: [{ parts: [{ text: prompt }] }]
        });
        return response.candidates[0].content.parts[0].text;
    } catch (e) {
        throw new Error("No se pudo optimizar la descripción.");
    }
};

// 3. ANALIZAR CANDIDATO vs PUESTO
export const analyzeCandidateForCompany = async (cvText: string, jobDescription: string) => {
    const prompt = `
    Actúa como un Senior Recruiter. Analiza el siguiente CV contra la Descripción del Puesto.
    
    DESCRIPCIÓN DEL PUESTO:
    """${jobDescription}"""

    TEXTO DEL CV:
    """${cvText}"""

    TAREA:
    1. Extrae DATOS DE CONTACTO:
       - Nombre: Busca nombre completo del candidato
       - Email: Busca cualquier correo electrónico (ej: nombre@gmail.com)
       - Teléfono: IMPORTANTE - Busca números de celular peruanos que:
         * Tienen 9 dígitos
         * Inician con 9 (ej: 987654321, 912345678)
         * Pueden tener espacios, guiones o paréntesis (ej: 987-654-321, (987) 654 321, 987 654 321)
         * Si encuentras un número con código de país +51, quítalo y usa solo los 9 dígitos
         * Devuelve SOLO los 9 dígitos sin formato (ejemplo: "987654321")
    2. Evalúa la COINCIDENCIA (0-100) basándote en Skills y Experiencia.
    3. Genera un RESUMEN breve, PROS (Puntos fuertes) y CONS (Puntos débiles o faltantes).

    RESPONDE SOLO JSON:
    {
        "name": "Nombre completo detectado o 'Candidato'",
        "email": "Email o null",
        "phoneNumber": "Teléfono de 9 dígitos o null",
        "matchScore": (0-100),
        "summary": "Resumen de 2 lineas del perfil",
        "pros": ["Punto fuerte 1", "Punto fuerte 2"],
        "cons": ["Faltante 1", "Faltante 2"]
    }
    `;

    try {
        const response = await fetchWithFallback({
            contents: [{ parts: [{ text: prompt }] }]
        });
        const candidate = response.candidates[0].content.parts[0].text;
        const jsonString = candidate.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonString);

        // Defensive: If AI returns "score" instead of "matchScore", map it
        if (parsed.score && !parsed.matchScore) {
            parsed.matchScore = parsed.score;
            delete parsed.score;
        }

        console.log("AI Analysis Result:", parsed);
        return parsed;
    } catch (e) {
        console.error("Error al analizar candidato:", e);
        throw new Error(`Análisis IA falló: ${(e as any)?.message || String(e)}`);
    }
};

// 3.5 ANALIZAR CANDIDATO DESDE EXCEL
export const analyzeExcelRowForCompany = async (rowDataString: string, jobDescription: string, keywords: string = "") => {
    const prompt = `
    Actúa como un Senior Recruiter. Analiza los siguientes datos de un candidato ( provenientes de una fila de Excel ) contra la Descripción del Puesto.
    
    DESCRIPCIÓN DEL PUESTO:
    """${jobDescription}"""

    PALABRAS CLAVE ESENCIALES (KEYWORDS):
    "${keywords}"

    DATOS DEL CANDIDATO (EXCEL ROW):
    """${rowDataString}"""

    TAREA:
    1. Extrae DATOS DE CONTACTO:
       - Nombre: Busca el nombre
       - Email: Correo
       - Teléfono: Sólo números
    2. Evalúa la COINCIDENCIA (0-100) basándote en la información dada. Usa inferencia lógica si la información es escasa pero concisa.
    3. Genera un RESUMEN breve, PROS (Puntos fuertes) y CONS (Gaps o Puntos débiles).
    4. Valida si posee las PALABRAS CLAVE ESENCIALES. Responde de forma clara para cada una (Presente o No Presente).

    RESPONDE SOLO JSON:
    {
        "name": "Nombre completo detectado o 'Candidato'",
        "email": "Email o null",
        "phoneNumber": "Teléfono o null",
        "matchScore": (0-100),
        "summary": "Resumen de 2 lineas",
        "pros": ["Fuerte 1", "Fuerte 2"],
        "cons": ["Gap 1", "Gap 2"],
        "keywordsValidation": "Resumen de la validación de keywords (ej: Inglés: Presente, Python: No Presente)"
    }
    `;

    try {
        const response = await fetchWithFallback({
            contents: [{ parts: [{ text: prompt }] }]
        });
        const candidate = response.candidates[0].content.parts[0].text;
        const jsonString = candidate.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonString);

        if (parsed.score && !parsed.matchScore) {
            parsed.matchScore = parsed.score;
        }

        return parsed;
    } catch (e) {
        throw new Error(`Análisis Excel falló: ${(e as any)?.message || String(e)}`);
    }
};

// 4. ANALIZAR Y DAR SUGERENCIAS SOBRE LA PUBLICACIÓN DEL PUESTO
export const analyzeJobPosting = async (text: string) => {
    const prompt = `
    Actúa como un **Experto en Reclutamiento y Employer Branding**.
    
    Analiza esta descripción de puesto:
    """
    ${text}
    """
    
    TAREA:
    1. Evalúa la CALIDAD de esta publicación (0-100) considerando:
       - Claridad de responsabilidades
       - Especificidad de requisitos
       - Atractivo para candidatos
       - Estructura y formato
       - Inclusividad del lenguaje
    
    2. Identifica:
       - PUNTOS FUERTES: Qué está bien en la publicación
       - DEBILIDADES: Qué falta o está mal
       - SUGERENCIAS: 3-5 recomendaciones específicas de mejora
       - KEYWORDS IMPORTANTES: Términos clave que deberían estar presentes
    
    3. Da un CONSEJO PRINCIPAL para mejorar el atractivo de la oferta
    
    RESPONDE SOLO JSON:
    {
      "qualityScore": (0-100),
      "strengths": ["Punto fuerte 1", "Punto fuerte 2"],
      "weaknesses": ["Debilidad 1", "Debilidad 2"],
      "improvements": ["Mejora específica 1", "Mejora específica 2", "Mejora específica 3"],
      "missingKeywords": ["keyword1", "keyword2", "keyword3"],
      "mainAdvice": "Consejo principal en 1-2 líneas"
    }
    `;

    try {
        const response = await fetchWithFallback({
            contents: [{ parts: [{ text: prompt }] }]
        });
        const candidate = response.candidates[0].content.parts[0].text;
        const jsonString = candidate.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Error al analizar publicación:", e);
        throw new Error(`Análisis de publicación falló: ${(e as any)?.message || String(e)}`);
    }
};
