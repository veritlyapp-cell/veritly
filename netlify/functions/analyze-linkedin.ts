// Netlify Function for Veritly - AI Proxy (SECURED)
import { getCorsHeaders, checkRateLimit } from './_security';

export const handler = async (event: any) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
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
    if (!event.body) throw new Error('Cuerpo vacío');
    const { prompt } = JSON.parse(event.body);

    if (!prompt || typeof prompt !== 'string' || prompt.length > 10000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt inválido o demasiado largo.' }) };
    }

    // Key solo en variable de servidor (sin EXPO_PUBLIC_)
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      throw new Error('Configuración incompleta: Falta GEMINI_API_KEY en el servidor.');
    }

    // Gemini 2.5 se apaga el 16 de octubre de 2026. gemini-3.1-flash-lite es
    // el más económico de la familia 3.x ($0.25/$1.50 por millón de tokens).
    const model = "gemini-3.1-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

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

  } catch (error: any) {
    console.error("Error en Proxy:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
