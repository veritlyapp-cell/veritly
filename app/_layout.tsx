import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { initGA } from '../utils/ga';
import { initFbPixel } from '../utils/fbPixel';
import { initSentry } from '../utils/sentry';

export default function RootLayout() {
  useEffect(() => {
    initGA();
    initFbPixel();
    initSentry();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (function(c: any,l: any,a: any,r: any,i: any,t?: any,y?: any){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "wtd5oxqm6k");
    }
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* MODO AUTOMÁTICO:
          Al no listar las pantallas una por una, Expo detectará
          automáticamente 'index.tsx' y la carpeta '(tabs)'.
          Esto evita errores de nombres viejos.
      */}
    </Stack>
  );
}