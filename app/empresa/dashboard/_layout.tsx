import { Drawer } from 'expo-router/drawer';
import { Briefcase, Settings } from 'lucide-react-native';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRequireRole } from '../../../hooks/useRequireRole';

export default function CompanyDrawerLayout() {
    const { loading, authorized } = useRequireRole('empresa');

    // TEMPORARILY DISABLED - DEBUGGING
    // Show loading screen while checking role
    // if (loading) {
    //     return (
    //         <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
    //             <ActivityIndicator size="large" color="#10b981" />
    //         </View>
    //     );
    // }

    // If not authorized, hook already redirected, show nothing
    // if (!authorized) {
    //     return null;
    // }

    // Authorized - show dashboard
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Drawer
                screenOptions={{
                    headerStyle: { backgroundColor: '#0f172a' },
                    headerTintColor: 'white',
                    drawerStyle: { backgroundColor: '#1e293b' },
                    drawerActiveTintColor: '#38bdf8',
                    drawerInactiveTintColor: '#94a3b8',
                    sceneStyle: { backgroundColor: '#0f172a' }
                }}
            >
                <Drawer.Screen
                    name="index"
                    options={{
                        drawerLabel: "Mis Puestos",
                        title: "Mis Puestos de Trabajo",
                        drawerIcon: ({ color, size }) => <Briefcase color={color} size={size} />
                    }}
                />

                <Drawer.Screen
                    name="job/create"
                    options={{
                        drawerLabel: "Match Perfil",
                        title: "Análisis de Perfil",
                        drawerIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
                        drawerItemStyle: { display: 'none' } // Making it hidden from menu to enforce flow via FAB? Or keep separate?
                        // User said: "Area de Flujo de Trabajo: Mis Puestos". "Match Perfil" is an action. 
                        // I will keep it visible as requested before ("Match Perfil"), or hide it if "Mis Puestos" is the only main area.
                        // "Menu Lateral: Mis Puestos, Configuración". 
                        // I will HIDE "Match Perfil" from the drawer and access it via FAB in "Mis Puestos" to be cleaner.
                        // Wait, user asked for "Match Perfil" name previously.
                        // New request: "Menu Lateral: Mis Puestos... Configuración... Recomendaciones".
                        // It seems "Match Perfil" (Create) should be reached FROM "Mis Puestos".
                        // I will hide it from Drawer to strictly follow "Menu Lateral" request.
                    }}
                />

                <Drawer.Screen
                    name="profile"
                    options={{
                        drawerLabel: "Configuración",
                        title: "Configuración",
                        drawerIcon: ({ color, size }) => <Settings color={color} size={size} />
                    }}
                />



                {/* OCULTO: Recomendaciones (Próximamente) */}
                <Drawer.Screen
                    name="recommendations"
                    options={{
                        drawerLabel: "Recomendaciones",
                        title: "Recomendaciones Veritly",
                        drawerItemStyle: { display: 'none' }
                    }}
                />

                {/* OCULTO: Onboarding (No sale en menú) */}
                <Drawer.Screen
                    name="onboarding"
                    options={{
                        drawerLabel: "Onboarding",
                        title: "Completar Perfil",
                        drawerItemStyle: { display: 'none' },
                        headerShown: false,
                        swipeEnabled: false
                    }}
                />
            </Drawer>
        </GestureHandlerRootView>
    );
}
