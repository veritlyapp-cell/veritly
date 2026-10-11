import { Platform } from 'react-native';

// Direcciones publicas que ven y comparten las empresas: un solo lugar para
// cambiarlas. Cuando vjobs.app este conectado en Netlify (con sus reglas de
// rutas en public/_redirects), pasar a:
//   JOBS_PAGE_BASE = 'vjobs.app/'     -> vjobs.app/{link-de-la-empresa}
//   JOB_SHORT_BASE = 'vjobs.app/v/'   -> vjobs.app/v/{link-de-la-vacante}
// Los links que eligen las empresas no cambian, solo el dominio delante.

export const JOBS_PAGE_BASE = 'veritlyapp.com/e/';
export const JOB_SHORT_BASE = 'veritlyapp.com/v/';

export const jobsPageUrl = (slug: string) => `https://${JOBS_PAGE_BASE}${slug}`;
export const jobShortUrl = (slug: string) => `https://${JOB_SHORT_BASE}${slug}`;

// El dominio corto solo sirve paginas publicas (pagina de empleos y links
// cortos). Postular, login y el resto viven en veritlyapp.com: asi el candidato
// no tiene una sesion distinta en cada dominio.
export const SHORT_DOMAIN = 'vjobs.app';
export const APP_ORIGIN = 'https://veritlyapp.com';

export const isOnShortDomain = () =>
    Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname.replace(/^www\./, '') === SHORT_DOMAIN;

// Ir a una ruta de la app: navegacion interna en veritlyapp.com, o salto al
// dominio principal si estamos en el corto.
export function openAppPath(router: { push: (p: any) => void; replace: (p: any) => void }, path: string, replace = false) {
    if (isOnShortDomain()) {
        if (replace) window.location.replace(APP_ORIGIN + path);
        else window.location.assign(APP_ORIGIN + path);
        return;
    }
    if (replace) router.replace(path as any);
    else router.push(path as any);
}
