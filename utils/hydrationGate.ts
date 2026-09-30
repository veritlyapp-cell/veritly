// Se esparce en el contenedor raiz de las paginas cuyo diseño depende del ancho
// de pantalla (useWindowDimensions). Ver app/+html.tsx: en computadora quedan
// ocultas hasta que la app carga, para no mostrar primero el diseño movil.
// React Native Web convierte dataSet en el atributo data-hydration-gate.
export const HYDRATION_GATE: any = { dataSet: { hydrationGate: 'responsive' } };

// Quita la marca de <html> puesta por el script de app/+html.tsx. Se llama una
// vez al montar la app; dos frames despues para que el diseño correcto ya este pintado.
export function releaseHydrationGate() {
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        document.documentElement.classList.remove('pre-hydration-desktop');
    }));
}
