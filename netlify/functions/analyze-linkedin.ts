// Netlify Function for Veritly - AI Proxy
// Use this to bypass Google's extension blocking

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (!event.body) throw new Error('Cuerpo vacío');
    const { prompt } = JSON.parse(event.body);
    
    // Usamos el API Key configurado en el servidor (Netlify)
    const API_KEY = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!API_KEY) {
        throw new Error('Configuración incompleta: Falta la variable GEMINI_API_KEY en el servidor.');
    }
    const model = "gemini-1.5-flash"; // El más estable y rápido

    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${API_KEY}`;
    
    // Fetch nativo (soportado en Node 18+)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
      })
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error("Error en Proxy:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
