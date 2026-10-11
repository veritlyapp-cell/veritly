// Vacante publica (netlify/functions/job-public.ts) pedida por app/+html.tsx
// apenas carga el HTML, en paralelo con la descarga de la app, en vez de
// esperar a que arranque (~2 s de JS). La pagina de vacante la usa si esta; si
// no, o si fallo, la pide ella misma con fetchPublicJob.

export type PublicJob = Record<string, any> & {
    id: string;
    company: { name: string; logoUrl: string; type: string };
    salaryRange: { min: number; max: number } | null;
};

export async function fetchPublicJob(jobId: string): Promise<PublicJob | null> {
    const res = await fetch(`/.netlify/functions/job-public?id=${encodeURIComponent(jobId)}`);
    return res.ok ? res.json() : null;
}

export async function getPrefetchedJob(jobId: string): Promise<PublicJob | null> {
    if (typeof window === 'undefined') return null;
    const p = (window as any).__VERITLY_JOB_PREFETCH;
    if (!p || p.jobId !== jobId) return null;
    (window as any).__VERITLY_JOB_PREFETCH = null; // solo sirve para la primera carga
    try {
        return (await p.promise) || null;
    } catch {
        return null;
    }
}
