import { Stack } from 'expo-router';

export default function RootLayout() {
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