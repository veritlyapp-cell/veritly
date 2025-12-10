import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { FileText, Home, LogOut, PlusCircle, UserCircle } from 'lucide-react-native';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { auth } from '../../../config/firebase'; // Adjust path as needed

// Logo
const LocalLogo = require('../../../assets/images/veritly3.png');

function CustomDrawerContent(props: any) {
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await auth.signOut();
            router.replace('/empresa/signin');
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
                {/* Header del Drawer */}
                <View style={{ padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center', marginBottom: 10 }}>
                    <Image source={LocalLogo} style={{ width: 60, height: 60, borderRadius: 12, marginBottom: 10 }} resizeMode="contain" />
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, letterSpacing: 1 }}>VERITLY</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>Empresas</Text>
                </View>

                {/* Items del Menú */}
                <DrawerItemList {...props} />
            </DrawerContentScrollView>

            {/* Footer / Logout */}
            <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: '#1e293b' }}>
                <TouchableOpacity onPress={handleLogout} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <LogOut size={20} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Cerrar Sesión</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function DashboardLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Drawer
                drawerContent={(props) => <CustomDrawerContent {...props} />}
                screenOptions={{
                    headerShown: false, // Ocultamos el header por defecto para usar nuestros propios headers personalizados
                    drawerStyle: {
                        backgroundColor: '#0f172a',
                        width: 280,
                    },
                    drawerActiveBackgroundColor: '#1e293b',
                    drawerActiveTintColor: '#38bdf8',
                    drawerInactiveTintColor: '#94a3b8',
                    drawerLabelStyle: {
                        marginLeft: -20,
                        fontWeight: '600'
                    }
                }}
            >
                <Drawer.Screen
                    name="index"
                    options={{
                        drawerLabel: "Inicio",
                        drawerIcon: ({ color }) => <Home size={22} color={color} />,
                        title: "Inicio"
                    }}
                />
                <Drawer.Screen
                    name="new-profile"
                    options={{
                        drawerLabel: "Nuevo Análisis",
                        drawerIcon: ({ color }) => <PlusCircle size={22} color={color} />,
                        title: "Nuevo Análisis"
                    }}
                />
                <Drawer.Screen
                    name="history"
                    options={{
                        drawerLabel: "Historial",
                        drawerIcon: ({ color }) => <FileText size={22} color={color} />,
                        title: "Historial"
                    }}
                />
                <Drawer.Screen
                    name="profile"
                    options={{
                        drawerLabel: "Mi Perfil",
                        drawerIcon: ({ color }) => <UserCircle size={22} color={color} />,
                        title: "Mi Perfil"
                    }}
                />
                {/* Ocultamos rutas que no queremos en el menú pero que necesitan estar en el stack del drawer si fuera necesario, 
                     aunque idealmente profile-edit podría estar linkeado */}
            </Drawer>
        </GestureHandlerRootView>
    );
}
