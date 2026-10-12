// Modalidad y ubicacion de una vacante: una vacante = un pais + una ciudad
// (o remoto). La lista de ciudades es corta a proposito (las principales de
// cada pais) para que los reportes no tengan "Lima", "lima" y "LIMA" como
// ciudades distintas; lo demas va en "Otra". Sin dependencias de React Native:
// tambien lo usan las Netlify Functions (submit-application, landing-page).

export type WorkMode = 'presencial' | 'hibrido' | 'remoto';

export const WORK_MODES: { value: WorkMode; label: string }[] = [
    { value: 'presencial', label: 'Presencial' },
    { value: 'hibrido', label: 'Híbrido' },
    { value: 'remoto', label: 'Remoto' },
];

export const OTHER_CITY = 'Otra';

// Mismo orden y nombres que LATAM_COUNTRIES (create.tsx y vacante/[id].tsx)
export const MAIN_CITIES: Record<string, string[]> = {
    'Perú': ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco'],
    'Colombia': ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga'],
    'México': ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Querétaro'],
    'Chile': ['Santiago', 'Valparaíso', 'Concepción', 'Antofagasta'],
    'Argentina': ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza'],
    'Ecuador': ['Quito', 'Guayaquil', 'Cuenca'],
    'Bolivia': ['Santa Cruz', 'La Paz', 'Cochabamba'],
    'Uruguay': ['Montevideo', 'Maldonado'],
    'Paraguay': ['Asunción', 'Ciudad del Este'],
    'Panamá': ['Ciudad de Panamá', 'Colón'],
    'Costa Rica': ['San José', 'Alajuela', 'Heredia'],
    'República Dominicana': ['Santo Domingo', 'Santiago de los Caballeros'],
    'El Salvador': ['San Salvador', 'Santa Ana'],
    'Guatemala': ['Ciudad de Guatemala', 'Quetzaltenango'],
    'Honduras': ['Tegucigalpa', 'San Pedro Sula'],
    'Nicaragua': ['Managua', 'León'],
};

export const COUNTRY_NAMES = Object.keys(MAIN_CITIES);

export const citiesFor = (country?: string | null) => (country && MAIN_CITIES[country]) || [];

const fold = (s?: string | null) =>
    String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Otros nombres con los que la gente escribe las ciudades de la lista
const CITY_ALIASES: Record<string, string> = {
    'cuzco': 'Cusco',
    'cdmx': 'Ciudad de México', 'df': 'Ciudad de México', 'mexico df': 'Ciudad de México', 'ciudad de mexico df': 'Ciudad de México',
    'bogota dc': 'Bogotá', 'santa fe de bogota': 'Bogotá',
    'santiago de chile': 'Santiago',
    'caba': 'Buenos Aires', 'capital federal': 'Buenos Aires', 'ciudad de buenos aires': 'Buenos Aires', 'ciudad autonoma de buenos aires': 'Buenos Aires',
    'lima metropolitana': 'Lima', 'lima callao': 'Lima',
    'santa cruz de la sierra': 'Santa Cruz',
    'guatemala': 'Ciudad de Guatemala', 'ciudad guatemala': 'Ciudad de Guatemala', 'xela': 'Quetzaltenango',
    'panama': 'Ciudad de Panamá', 'ciudad panama': 'Ciudad de Panamá',
    'santiago rd': 'Santiago de los Caballeros',
    'vina del mar': 'Valparaíso',
};
const ALL_CITIES = Object.values(MAIN_CITIES).flat();

// Nombre de la lista si el texto es una ciudad conocida ("cuzco", "CDMX"), o el
// texto tal cual si no (una ciudad escrita en "Otra")
export function canonicalCity(text?: string | null): string {
    const t = fold(text);
    if (!t) return '';
    return CITY_ALIASES[t] || ALL_CITIES.find((c) => fold(c) === t) || String(text).trim();
}

export const sameCity = (a?: string | null, b?: string | null) => !!fold(a) && fold(canonicalCity(a)) === fold(canonicalCity(b));

// Texto libre ("lima metropolitana", "PERU") -> nombre de la lista, si coincide
export function matchCountry(text?: string | null): string | null {
    const t = fold(text);
    if (!t) return null;
    return COUNTRY_NAMES.find((c) => fold(c) === t || t.includes(fold(c))) || null;
}

export function matchCity(country: string | null, text?: string | null): string | null {
    const t = fold(text);
    if (!t) return null;
    return citiesFor(country).find((c) => fold(c) === t || t.startsWith(fold(c))) || null;
}

export const workModeLabel = (mode?: string | null) => WORK_MODES.find((m) => m.value === mode)?.label || '';

// "Trujillo, Perú" (o el texto libre de vacantes anteriores a estos campos)
export function jobPlace(job: { workMode?: string; city?: string; country?: string; location?: string } | null | undefined): string {
    if (!job) return '';
    if (job.workMode) {
        if (job.workMode === 'remoto') return '';
        return [job.city, job.country].filter(Boolean).join(', ');
    }
    // Vacantes anteriores: texto libre que saco la IA del aviso; si es largo
    // ("A nivel nacional (Perú/Multinacional - no especifica...)") no se muestra
    const legacy = String(job.location || '').trim();
    return legacy.length <= 40 ? legacy : '';
}

// Resumen de la posicion: "Presencial · Trujillo, Perú", "Remoto", o el texto
// libre de vacantes antiguas
export function formatJobLocation(job: { workMode?: string; city?: string; country?: string; location?: string } | null | undefined): string {
    if (!job) return '';
    return [workModeLabel(job.workMode), jobPlace(job)].filter(Boolean).join(' · ');
}

// El candidato vive en otra ciudad que la de una vacante presencial/hibrida.
// No descarta: solo se marca y la IA lo considera.
export function livesInOtherCity(job: { workMode?: string; city?: string; country?: string }, candidate: { city?: string; country?: string }): boolean {
    if (!job.workMode || job.workMode === 'remoto' || !job.city || !candidate.city) return false;
    if (job.country && candidate.country && job.country !== candidate.country) return true;
    return !sameCity(job.city, candidate.city);
}

// Contexto para el analisis con IA (se agrega a la descripcion del puesto)
export function locationNoteForAI(job: { workMode?: string; city?: string; country?: string; location?: string }, candidate?: { city?: string; country?: string }): string {
    const where = formatJobLocation(job);
    if (!where) return '';
    let note = `\n\nUBICACIÓN DE LA VACANTE: ${where}.`;
    if (candidate?.city || candidate?.country) {
        note += `\nUBICACIÓN DEL CANDIDATO: vive en ${[candidate.city, candidate.country].filter(Boolean).join(', ')}.`;
        if (livesInOtherCity(job, candidate)) {
            note += '\nEl candidato vive en otra ciudad que la de esta vacante presencial/híbrida: menciónalo en los puntos débiles (cons) y considéralo al puntuar, sin descartarlo (podría mudarse o viajar).';
        }
    }
    return note;
}
