import { Drawer } from 'expo-router/drawer';
import { Briefcase, Settings, Star, Activity, FileText, LogOut, ShieldCheck, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { auth } from '../../../config/firebase';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRequireRole } from '../../../hooks/useRequireRole';

export default function CompanyDrawerLayout() {
    const { loading, authorized } = useRequireRole('empresa');

    // Show loading screen while checking role
    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    // If not authorized, hook handles redirection, show nothing
    if (!authorized) {
        return null;
    }

    const CustomDrawerContent = (props: any) => {
        const router = useRouter();
        
        const handleLogout = async () => {
            await auth.signOut();
            router.replace('/empresa/signin');
        };

        return (
            <View style={{ flex: 1 }}>
                <DrawerContentScrollView {...props}>
                    <DrawerItemList {...props} />
                </DrawerContentScrollView>
                
                <View style={styles.logoutContainer}>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <LogOut color="#ef4444" size={20} />
                        <Text style={styles.logoutText}>Cerrar Sesión</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Authorized - show dashboard
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Drawer
                drawerContent={(props) => <CustomDrawerContent {...props} />}
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
                        drawerLabel: "Home",
                        title: "Resumen General",
                        drawerIcon: ({ color, size }) => <Activity color={color} size={size} />
                    }}
                />

                <Drawer.Screen
                    name="puestos"
                    options={{
                        drawerLabel: "Mis Puestos",
                        title: "Gestión de Vacantes",
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

                <Drawer.Screen
                    name="admin"
                    options={{
                        drawerLabel: "Admin B2B",
                        title: "Panel Corporativo",
                        drawerIcon: ({ color, size }) => <ShieldCheck color={auth.currentUser?.email === 'oscar@veritlyapp.com' ? "#3b82f6" : color} size={size} />,
                        drawerItemStyle: { display: auth.currentUser?.email === 'oscar@veritlyapp.com' ? 'flex' : 'none' }
                    }}
                />

                <Drawer.Screen
                    name="pricing"
                    options={{
                        drawerLabel: "Planes y Precios",
                        title: "Planes para Empresas",
                        drawerIcon: ({ color, size }) => <Star color={color} size={size} />
                    }}
                />

                <Drawer.Screen
                    name="terms"
                    options={{
                        drawerItemStyle: { display: 'none' }
                    }}
                />



                <Drawer.Screen
                    name="insights"
                    options={{
                        drawerLabel: "Talent Insights",
                        title: "Insights de Talento",
                        drawerIcon: ({ color, size }) => <TrendingUp color={color} size={size} />,
                        drawerItemStyle: { display: auth.currentUser?.email === 'oscar@veritlyapp.com' ? 'flex' : 'none' }
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

const styles = StyleSheet.create({
    logoutContainer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#334155',
        marginBottom: 20
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10
    },
    logoutText: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: 'bold'
    }
});
