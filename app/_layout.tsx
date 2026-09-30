import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { initGA } from '../utils/ga';
import { initFbPixel } from '../utils/fbPixel';
import { initSentry } from '../utils/sentry';
import { initClarity } from '../utils/clarity';
import { getConsent } from '../utils/cookieConsent';
import CookieBanner from '../components/CookieBanner';

export default function RootLayout() {
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  // La pestaña del navegador siempre dice "Veritly". React Navigation pone como
  // titulo el nombre de cada ruta (o la URL), y en el panel de empresa el titulo
  // de cada pantalla ya se usa para el encabezado visible, asi que se fija aca.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const APP_TITLE = 'Veritly';
    document.title = APP_TITLE;
    const observer = new MutationObserver(() => {
      if (document.title !== APP_TITLE) document.title = APP_TITLE;
    });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Sentry es monitoreo tecnico de errores, no publicidad/analitica de
    // terceros -- no depende del consentimiento de cookies.
    initSentry();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const consent = getConsent();
      if (consent === 'accepted') {
        initGA();
        initFbPixel();
        initClarity();
      } else if (consent === null) {
        setShowCookieBanner(true);
      }
      // consent === 'rejected' -> no se inicializa GA / Meta Pixel / Clarity
    } else {
      // Apps nativas: no hay cookies de navegador, se mantiene el comportamiento previo.
      initGA();
      initFbPixel();
    }
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {/* MODO AUTOMÁTICO:
            Al no listar las pantallas una por una, Expo detectará
            automáticamente 'index.tsx' y la carpeta '(tabs)'.
            Esto evita errores de nombres viejos.
        */}
      </Stack>
      {showCookieBanner && <CookieBanner onResolved={() => setShowCookieBanner(false)} />}
    </>
  );
}