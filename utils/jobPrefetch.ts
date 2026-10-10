import { Timestamp } from 'firebase/firestore';

// Datos de la vacante pedidos por app/+html.tsx apenas carga el HTML, con la
// API REST de Firestore (un fetch simple), en vez de esperar a que arranque la
// app (~2 s de JS) y al SDK. La pagina de vacante los usa si estan; si no, o si
// fallaron, lee con getDoc como siempre.

type RestValue = Record<string, any>;

function decodeValue(v: RestValue): any {
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('timestampValue' in v) return Timestamp.fromDate(new Date(v.timestampValue));
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
    if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
    if ('referenceValue' in v) return v.referenceValue;
    if ('geoPointValue' in v) return v.geoPointValue;
    if ('bytesValue' in v) return v.bytesValue;
    return undefined;
}

function decodeFields(fields: Record<string, RestValue>): Record<string, any> {
    return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

export type PrefetchedJob = { job: Record<string, any> | null; company: Record<string, any> | null };

export async function getPrefetchedJob(jobId: string): Promise<PrefetchedJob | null> {
    if (typeof window === 'undefined') return null;
    const p = (window as any).__VERITLY_JOB_PREFETCH;
    if (!p || p.jobId !== jobId) return null;
    (window as any).__VERITLY_JOB_PREFETCH = null; // solo sirve para la primera carga
    try {
        const { job, company } = await p.promise;
        if (!job?.fields) return null;
        return { job: decodeFields(job.fields), company: company?.fields ? decodeFields(company.fields) : null };
    } catch {
        return null;
    }
}
