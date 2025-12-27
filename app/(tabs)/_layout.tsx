import { Tabs } from 'expo-router';
import { FileText, ScanFace } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

export default function TabLayout() {
  // Note: Removed useRequireRole check - candidato pages are accessible without forced auth
  // Individual pages handle their own authentication as needed

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Sin header nativo (usamos el nuestro)
        tabBarStyle: Platform.select({
          ios: { position: 'absolute', backgroundColor: '#0f172a', borderTopColor: '#334155', height: 60, paddingBottom: 5 },
          default: { backgroundColor: '#0f172a', borderTopColor: '#334155', height: 60, paddingBottom: 10 },
        }),
        tabBarActiveTintColor: '#38bdf8', // Azul Cyan brillante
        tabBarInactiveTintColor: '#64748b', // Gris apagado
        tabBarLabelStyle: { fontSize: 12, fontWeight: 'bold', marginTop: -5 }
      }}>

      {/* 1. SCANNER (Antes Home) - Ahora es la herramienta principal */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color }) => <ScanFace size={26} color={color} />,
        }}
      />

      {/* 2. MI CV (Antes Profile) - Ahora enfocado en el documento */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mi CV',
          tabBarIcon: ({ color }) => <FileText size={26} color={color} />,
        }}
      />

      {/* 3. EXPLORE (Eliminado/Oculto) */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null, // Esto lo hace desaparecer por completo
        }}
      />
    </Tabs>
  );
}