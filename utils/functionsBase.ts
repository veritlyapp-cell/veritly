// Base de las Netlify Functions para llamadas desde el navegador.
// En la web se llama al mismo sitio donde esta abierta la app (veritlyapp.com,
// staging--veritly.netlify.app, un deploy de prueba): sin CORS y cada entorno
// usa sus propias funciones. Antes era siempre www.veritlyapp.com, y la IA no
// funcionaba en staging (el servidor de produccion rechaza otros origenes).
// En desarrollo local (expo start, sin funciones) y en la app nativa se usa
// produccion.
const PROD = 'https://www.veritlyapp.com';

export function functionsBase(): string {
    const host = typeof window !== 'undefined' ? window.location?.hostname : undefined;
    if (!host || host === 'localhost' || host === '127.0.0.1') return PROD;
    return '';
}

export const functionUrl = (name: string) => `${functionsBase()}/.netlify/functions/${name}`;
