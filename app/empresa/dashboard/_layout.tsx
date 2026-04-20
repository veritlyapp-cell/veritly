import { Drawer } from 'expo-router/drawer';
import { Briefcase, Settings, Star, Activity, FileText, LogOut, ShieldCheck, TrendingUp, BarChart3 } from 'lucide-react-native';
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
                        drawerLabel: "Home / Créditos",
                        title: "Resumen de Cuenta",
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
                    name="indicadores"
                    options={{
                        drawerLabel: "Indicadores",
                        title: "Indicadores de Reclutamiento",
                        drawerIcon: ({ color, size }) => <BarChart3 color={color} size={size} />
                    }}
                />

                <Drawer.Screen
                    name="pricing"
                    options={{
                        drawerLabel: "Planes y Créditos",
                        title: "Planes para Empresas",
                        drawerIcon: ({ color, size }) => <Star color={color} size={size} />
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
                        drawerIcon: ({ color, size }) => <ShieldCheck color="#3b82f6" size={size} />,
                        drawerItemStyle: { display: (auth.currentUser?.email === 'oscar@veritlyapp.com') ? 'flex' : 'none' }
                    }}
                />

                <Drawer.Screen
                    name="insights"
                    options={{
                        drawerLabel: "Talent Insights",
                        title: "Insights de Talento",
                        drawerIcon: ({ color, size }) => <TrendingUp color="#10b981" size={size} />,
                        drawerItemStyle: { display: (auth.currentUser?.email === 'oscar@veritlyapp.com' || auth.currentUser?.email === 'oscar@relielabs.com') ? 'flex' : 'none' }
                    }}
                />

                <Drawer.Screen
                    name="terms"
                    options={{
                        drawerItemStyle: { display: 'none' }
                    }}
                />

                <Drawer.Screen
                    name="job/create"
                    options={{
                        drawerItemStyle: { display: 'none' }
                    }}
                />

                <Drawer.Screen
                    name="recommendations"
                    options={{
                        drawerItemStyle: { display: 'none' }
                    }}
                />

                <Drawer.Screen
                    name="admin_analytics"
                    options={{
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
