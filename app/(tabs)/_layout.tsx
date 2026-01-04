import { Tabs } from 'expo-router';
import { BarChart2, FileText, ScanFace, Settings } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { auth } from '../../config/firebase';

const ADMIN_EMAILS = ['test+1@gmail.com', 'oscar@veritlyapp.com', 'oscar@relielabs.com'];

export default function TabLayout() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Escuchar cambios de auth para actualizar el tab en tiempo real
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log("👤 Auth Check:", user?.email);
      if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });
    return unsubscribe;
  }, []);

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

      {/* 1. SCANNER */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color }) => <ScanFace size={26} color={color} />,
        }}
      />

      {/* 2. MI CV */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mi CV',
          tabBarIcon: ({ color }) => <FileText size={26} color={color} />,
        }}
      />

      {/* 3. ANALYTICS (Solo Admin) */}
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => <BarChart2 size={26} color={color} />,
          href: isAdmin ? '/(tabs)/analytics' : null,
        }}
      />

      {/* 4. CONFIG (Solo Admin) */}
      <Tabs.Screen
        name="admin_config"
        options={{
          title: 'Config',
          tabBarIcon: ({ color }) => <Settings size={26} color={color} />,
          href: isAdmin ? '/(tabs)/admin_config' : null,
        }}
      />

      {/* 4. EXPLORE (Oculto) */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}