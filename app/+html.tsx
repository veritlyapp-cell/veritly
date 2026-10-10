import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Plantilla HTML de todas las paginas pre-generadas (web, output "static").
//
// Las paginas que cambian de diseño segun el ancho (landing, logins, panel) se
// pre-generan sin saber el ancho de pantalla, o sea en version movil. En
// computadora eso se veia un instante y luego saltaba al diseño de escritorio.
// Este script marca <html> si la pantalla es ancha, y el CSS oculta esas
// paginas (las que llevan HYDRATION_GATE) hasta que la app termina de cargar y
// quita la marca (ver app/_layout.tsx). En celular no se oculta nada.
// Por seguridad, si la app tarda mas de 4 s (conexion lenta o error de JS) se
// muestra igual, para nunca dejar la pagina en blanco.
const PRE_HYDRATION_SCRIPT = `if (window.innerWidth >= 768) {
  var el = document.documentElement;
  el.classList.add('pre-hydration-desktop');
  setTimeout(function () { el.classList.remove('pre-hydration-desktop'); }, 4000);
}`;
const PRE_HYDRATION_CSS = `.pre-hydration-desktop [data-hydration-gate] { opacity: 0 !important; }`;

// Pagina de vacante: pide la vacante (y la empresa, si no es confidencial) a la
// API REST de Firestore mientras se descarga la app, en vez de despues de que
// arranca. La consume utils/jobPrefetch.ts; si falla, la pagina lee como siempre.
// La API key es la publica del cliente web (la misma de config/firebase.ts).
const JOB_PREFETCH_SCRIPT = `(function () {
  var m = window.location.pathname.match(/^\\/vacante\\/([A-Za-z0-9_-]{10,40})\\/?$/);
  if (!m || !window.fetch) return;
  var base = 'https://firestore.googleapis.com/v1/projects/vinku-3a3af/databases/(default)/documents/';
  var key = '?key=AIzaSyBbQwiklf0kWnz5V2_l6PgPeL679NyGEJ8';
  var get = function (path) { return fetch(base + path + key).then(function (r) { return r.ok ? r.json() : null; }); };
  window.__VERITLY_JOB_PREFETCH = {
    jobId: m[1],
    promise: get('jobs/' + m[1]).then(function (job) {
      var f = job && job.fields;
      var companyId = f && f.companyId && f.companyId.stringValue;
      var confidential = f && f.isConfidential && f.isConfidential.booleanValue;
      if (!companyId || confidential) return { job: job, company: null };
      return get('users_empresas/' + companyId).then(function (company) { return { job: job, company: company }; }, function () { return { job: job, company: null }; });
    })
  };
})();`;

// Si un archivo de la app no carga (404 o HTML en vez de JS), la pagina es una
// copia vieja de un deploy anterior (pasa con navegadores internos como el de
// LinkedIn, que guardan la pagina aunque se les pida no hacerlo). Se recarga
// una sola vez pidiendo una version fresca (_v= evita la copia guardada). Debe
// ir antes que los <script> del bundle para escuchar sus errores.
const STALE_RELOAD_SCRIPT = `(function () {
  function reloadFresh() {
    try {
      var last = Number(sessionStorage.getItem('veritly-stale-reload') || 0);
      if (Date.now() - last < 60000) return;
      sessionStorage.setItem('veritly-stale-reload', String(Date.now()));
    } catch (e) { return; }
    var url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT' && /\\/_expo\\/static\\//.test(t.src || '')) return reloadFresh();
    if (/\\/_expo\\/static\\//.test(e.filename || '') && /Unexpected token|expected expression/.test(e.message || '')) reloadFresh();
  }, true);
})();`;

export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="es">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                <script dangerouslySetInnerHTML={{ __html: STALE_RELOAD_SCRIPT }} />
                <script dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_SCRIPT }} />
                <script dangerouslySetInnerHTML={{ __html: JOB_PREFETCH_SCRIPT }} />
                <style dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_CSS }} />
                <ScrollViewStyleReset />
            </head>
            <body>{children}</body>
        </html>
    );
}
