import { Stack } from 'expo-router';

export default function CompanyLayout() {
  return (
    <Stack screenOptions={{ 
      headerStyle: { backgroundColor: '#F8F9FA' },
      headerTintColor: '#333',
      headerTitleStyle: { fontWeight: 'bold' },
    }}>
      {/* Dashboard: Pantalla principal, ocultamos el botón back si viniera de login */}
      <Stack.Screen 
        name="dashboard" 
        options={{ 
          title: "Dashboard",
          headerShown: false // Ocultamos el header default para usar el nuestro personalizado
        }} 
      />
      
      {/* Crear Vacante */}
      <Stack.Screen 
        name="job/create" 
        options={{ title: "Nueva Vacante" }} 
      />

      {/* Detalle de Vacante (Dinámica) */}
      <Stack.Screen 
        name="job/[id]" 
        options={{ title: "Gestión de Candidatos" }} 
      />
    </Stack>
  );
}
