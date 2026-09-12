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