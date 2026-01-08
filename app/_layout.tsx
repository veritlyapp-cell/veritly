import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { initGA } from '../utils/ga';
import { initSentry } from '../utils/sentry';

export default function RootLayout() {
  useEffect(() => {
    initGA();
    initSentry();
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