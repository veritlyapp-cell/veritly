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

export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="es">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                <script dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_SCRIPT }} />
                <style dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_CSS }} />
                <ScrollViewStyleReset />
            </head>
            <body>{children}</body>
        </html>
    );
}
