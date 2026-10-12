// Pagina de empleos en la raiz: vjobs.app/{slug} (y veritlyapp.com/{slug}).
// Es la misma pantalla que /e/{slug}. Las rutas fijas de la app (signin,
// privacy, etc.) tienen prioridad; por eso estan en RESERVED_SLUGS de
// netlify/functions/landing-page.ts y no se pueden elegir como link.
export { default } from '../e/[slug]';
