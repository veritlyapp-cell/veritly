// Fecha de nacimiento y genero del candidato: se piden una vez (al postular
// por primera vez) solo para estadisticas anonimas del mercado laboral.
// La empresa NO los ve y la IA NO los usa: en Veritly no se filtra por edad
// ni por genero. Lo unico que se exige es ser mayor de edad.
// Sin dependencias de React Native (lo usa submit-application.ts).

export const MIN_AGE = 18;

export const GENDERS = [
    { value: 'mujer', label: 'Mujer' },
    { value: 'hombre', label: 'Hombre' },
    { value: 'otro', label: 'Otro' },
    { value: 'no_dice', label: 'Prefiero no decir' },
];

export const isValidGender = (g: unknown) => GENDERS.some((x) => x.value === g);

// 'YYYY-MM-DD' de una fecha real (no 31/02) entre 1920 y hoy, o null
export function toBirthDate(day: string | number, month: string | number, year: string | number): string | null {
    const d = Number(day), m = Number(month), y = Number(year);
    if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
    if (y < 1920 || date.getTime() > Date.now()) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const isValidBirthDate = (iso: unknown) =>
    typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && toBirthDate(iso.slice(8, 10), iso.slice(5, 7), iso.slice(0, 4)) === iso;

export function ageAt(birthIso: string, at: Date = new Date()): number {
    const [y, m, d] = birthIso.split('-').map(Number);
    let age = at.getUTCFullYear() - y;
    if (at.getUTCMonth() + 1 < m || (at.getUTCMonth() + 1 === m && at.getUTCDate() < d)) age--;
    return age;
}

// Rangos para los reportes (nunca se guarda la edad exacta en la data de mercado)
export function ageBracket(age: number): string {
    if (age < 25) return '18-24';
    if (age < 35) return '25-34';
    if (age < 45) return '35-44';
    if (age < 55) return '45-54';
    return '55+';
}
