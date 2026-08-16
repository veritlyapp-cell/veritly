import { useRouter } from 'expo-router';
import { ArrowLeft, LogOut } from 'lucide-react-native';
import React from 'react';
import { Alert, Image, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';

const LocalLogo = require('../assets/images/veritly3.png');
const RacsoLogo = require('../assets/images/racso-logo.png');

interface AppHeaderProps {
    showAuthButtons?: boolean;
    title?: string;
    showBackButton?: boolean;
    homeRoute?: string;
    minimal?: boolean;
    lightTheme?: boolean;
}

export default function AppHeader({
    showAuthButtons = true,
    title,
    showBackButton = true,
    homeRoute = '/',
    minimal = false,
    lightTheme = false
}: AppHeaderProps) {
    const router = useRouter();

    const handleLogout = async () => {
        const confirmLogout = () => {
            auth.signOut().then(() => {
                router.replace('/');
            });
        };

        if (Platform.OS === 'web') {
            const confirmed = window.confirm('¿Cerrar sesión?');
            if (confirmed) confirmLogout();
        } else {
            Alert.alert(
                'Cerrar Sesión',
                '¿Estás seguro que quieres salir?',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Salir', onPress: confirmLogout, style: 'destructive' }
                ]
            );
        }
    };

    const handleOpenRacso = () => {
        Linking.openURL('https://racso.app/ingreso');
    };

    const activeHeaderStyle = [
        styles.header,
        lightTheme && { backgroundColor: '#F8FAFF', borderBottomColor: '#E5E7EB' }
    ];

    const activeBackBtnStyle = [
        styles.backButton,
        minimal && { borderRightWidth: 0, paddingRight: 0 }
    ];

    return (
        <View style={activeHeaderStyle}>
            <View style={styles.leftSection}>
                {showBackButton && (
                    <TouchableOpacity
                        style={activeBackBtnStyle}
                        onPress={() => {
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace(homeRoute as any);
                            }
                        }}
                    >
                        <ArrowLeft size={20} color={lightTheme ? '#4B5563' : '#94a3b8'} />
                        <Text style={[styles.backButtonText, lightTheme && { color: '#4B5563' }]}>Atrás</Text>
                    </TouchableOpacity>
                )}

                {!minimal && (
                    <TouchableOpacity
                        style={styles.logoSection}
                        onPress={() => router.replace(homeRoute as any)}
                    >
                        <Image source={LocalLogo} style={styles.logoImage} resizeMode="contain" />
                        <Text style={styles.appName}>{title || 'VERITLY'}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {showAuthButtons && !minimal && (
                <View style={styles.buttonSection}>
                    <TouchableOpacity style={styles.racsoButton} onPress={handleOpenRacso}>
                        <Image source={RacsoLogo} style={styles.racsoLogo} />
                        <Text style={styles.racsoButtonText}>Racso</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <LogOut size={18} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#1e293b',
        borderBottomWidth: 1,
        borderBottomColor: '#334155'
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingRight: 10,
        borderRightWidth: 1,
        borderRightColor: '#334155',
        height: 30, // Asegurar alineación vertical
    },
    backButtonText: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '600'
    },
    logoSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    logoImage: {
        width: 40,
        height: 40
    },
    appName: {
        fontSize: 16,
        fontWeight: '900',
        color: 'white',
        letterSpacing: 2
    },
    buttonSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    racsoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
        borderWidth: 1,
        borderColor: '#4F46E5'
    },
    racsoLogo: {
        width: 16,
        height: 16,
        borderRadius: 8
    },
    racsoButtonText: {
        color: '#4F46E5',
        fontSize: 12,
        fontWeight: 'bold'
    },
    logoutButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ef4444'
    }
});
