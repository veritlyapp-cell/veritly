// Direcciones publicas que ven y comparten las empresas: un solo lugar para
// cambiarlas. Cuando vjobs.app este conectado en Netlify (con sus reglas de
// rutas), pasar a:
//   JOBS_PAGE_BASE = 'vjobs.app/'     -> vjobs.app/{link-de-la-empresa}
//   JOB_SHORT_BASE = 'vjobs.app/v/'   -> vjobs.app/v/{link-de-la-vacante}
// Los links que eligen las empresas no cambian, solo el dominio delante.

export const JOBS_PAGE_BASE = 'veritlyapp.com/e/';
export const JOB_SHORT_BASE = 'veritlyapp.com/v/';

export const jobsPageUrl = (slug: string) => `https://${JOBS_PAGE_BASE}${slug}`;
export const jobShortUrl = (slug: string) => `https://${JOB_SHORT_BASE}${slug}`;
