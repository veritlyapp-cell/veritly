

const API_KEY = process.env.EXPO_PUBLIC_COMPANY_API_KEY;

if (!API_KEY) {
    console.warn("⚠️ EXPO_PUBLIC_COMPANY_API_KEY no está definido en .env");
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

// 2. OPTIMIZAR DESCRIPCIÓN (Opcional)
export const optimizeJobDescription = async (text: string) => {
    const prompt = `
    Actúa como un reclutador experto. Reescribe la siguiente descripción de puesto para que sea más atractiva, clara y profesional.
    Usa formato Markdown con viñetas para Responsabilidades y Requisitos.

    TEXTO ORIGINAL:
    """
    ${text}
    """
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
