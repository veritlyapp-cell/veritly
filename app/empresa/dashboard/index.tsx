import { DrawerActions } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import { ChevronRight, FileText, Menu, PlusCircle, UserCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../../config/firebase';
import { getUserProfileFromCloud } from '../../../services/storage';

// Logo
const LocalLogo = require('../../../assets/images/veritly3.png');

export default function CompanyHomeScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const [checkingProfile, setCheckingProfile] = useState(true);
    const [companyName, setCompanyName] = useState("");

    useEffect(() => {
        checkProfileStatus();
    }, []);

    const checkProfileStatus = async () => {
        const user = auth.currentUser;
        if (!user) {
            setCheckingProfile(false);
            return;
        }

        try {
            const profile = await getUserProfileFromCloud(user.uid);
            if (!profile || !profile.ruc || !profile.isProfileComplete) {
                router.replace('/empresa/dashboard/profile');
                return;
            }
            setCompanyName(profile.nombreComercial || profile.razonSocial || "Empresa");
        } catch (e) {
            console.error("Error checking profile", e);
        } finally {
            setCheckingProfile(false);
        }
    };

    const menuItems = [
        {
            title: "Nuevo Análisis de Perfil",
            subtitle: "Sube un PDF y encuentra candidatos",
            icon: <PlusCircle size={24} color="#3b82f6" />,
            route: "/empresa/dashboard/new-profile",
            color: "rgba(59, 130, 246, 0.1)"
        },
        {
            title: "Mi Perfil de Empresa",
            subtitle: "Datos fiscales, contacto y ubicación",
            icon: <UserCircle size={24} color="#10b981" />,
            route: "/empresa/dashboard/profile",
            color: "rgba(16, 185, 129, 0.1)"
        },
        {
            title: "Historial de Perfiles",
            subtitle: "Ver análisis anteriores",
            icon: <FileText size={24} color="#f59e0b" />,
            route: "/empresa/dashboard/history",
            color: "rgba(245, 158, 11, 0.1)"
        }
    ];

    if (checkingProfile) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: '#94a3b8', marginTop: 15 }}>Verificando perfil...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
                    <Menu size={28} color="white" />
                </TouchableOpacity>
                <View style={styles.logoContainer}>
                    <Image source={LocalLogo} style={styles.logoImage} resizeMode="contain" />
                </View>
                <View style={{ width: 28 }} />
            </View>

            <View style={styles.welcomeSection}>
                <Text style={styles.welcomeLabel}>Bienvenido,</Text>
                <Text style={styles.welcomeName}>{companyName}</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Acciones Rápidas</Text>

                <View style={styles.grid}>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.card}
                            onPress={() => router.push(item.route as any)}
                        >
                            <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                                {item.icon}
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                            </View>
                            <ChevronRight size={20} color="#64748b" />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { padding: 20, paddingTop: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    logoContainer: { flexDirection: 'row', alignItems: 'center' },
    logoImage: { width: 30, height: 30 },
    welcomeSection: { padding: 20, paddingBottom: 10 },
    welcomeLabel: { color: '#94a3b8', fontSize: 14 },
    welcomeName: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    content: { flex: 1, padding: 20 },
    sectionTitle: { color: '#38bdf8', fontSize: 14, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
    grid: { gap: 15 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
    iconBox: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    cardContent: { flex: 1 },
    cardTitle: { color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
    cardSubtitle: { color: '#94a3b8', fontSize: 12 }
});
