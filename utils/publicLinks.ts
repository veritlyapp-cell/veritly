import { Platform } from 'react-native';

// Direcciones publicas que ven y comparten las empresas: un solo lugar para
// cambiarlas. Dominio corto vjobs.app (reglas de rutas en public/_redirects):
//   vjobs.app/{link-de-la-empresa}   pagina de empleos
//   vjobs.app/v/{link-de-la-vacante} link corto de una vacante
// Los links ya compartidos con veritlyapp.com/e/ y /v/ siguen funcionando.

export const JOBS_PAGE_BASE = 'vjobs.app/';
export const JOB_SHORT_BASE = 'vjobs.app/v/';

export const jobsPageUrl = (slug: string) => `https://${JOBS_PAGE_BASE}${slug}`;
export const jobShortUrl = (slug: string) => `https://${JOB_SHORT_BASE}${slug}`;

// Link de una vacante: bajo la pagina de la empresa (vjobs.app/acme/ventas-lima)
// si tiene link de pagina de empleos y no es confidencial; si no, el corto
// generico (vjobs.app/v/ventas-lima), que no revela la empresa.
export const jobLinkBase = (companySlug?: string | null, confidential?: boolean) =>
    companySlug && !confidential ? `${JOBS_PAGE_BASE}${companySlug}/` : JOB_SHORT_BASE;
export const jobLinkUrl = (jobSlug: string, companySlug?: string | null, confidential?: boolean) =>
    `https://${jobLinkBase(companySlug, confidential)}${jobSlug}`;

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
