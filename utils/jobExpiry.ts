// Una vacante publicada queda activa 60 dias; despues pasa a inactiva sola
// (netlify/functions/expire-jobs.ts, todos los dias). "Republicar" la reactiva
// con fecha nueva y los mismos postulantes; "Copiar" crea otra vacante igual,
// sin postulantes. Sin dependencias de React Native (lo usan las funciones).

export const JOB_ACTIVE_DAYS = 60;
const DAY_MS = 86_400_000;

const toMs = (v: any): number | null => {
    if (!v) return null;
    if (typeof v === 'string' || typeof v === 'number') {
        const t = new Date(v).getTime();
        return isNaN(t) ? null : t;
    }
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    return null;
};

// Fecha desde la que corre el plazo: la ultima publicacion (republicar la renueva)
export const jobPublishedMs = (job: any): number | null => toMs(job?.publishedAt) ?? toMs(job?.createdAt);

export function jobExpiresAt(job: any): Date | null {
    const published = jobPublishedMs(job);
    return published === null ? null : new Date(published + JOB_ACTIVE_DAYS * DAY_MS);
}

export function isJobExpired(job: any, now = Date.now()): boolean {
    const expires = jobExpiresAt(job);
    return !!expires && expires.getTime() <= now;
}

// Dias que le quedan (0 si ya vencio, null si no se sabe la fecha)
export function daysUntilExpiry(job: any, now = Date.now()): number | null {
    const expires = jobExpiresAt(job);
    if (!expires) return null;
    return Math.max(0, Math.ceil((expires.getTime() - now) / DAY_MS));
}
