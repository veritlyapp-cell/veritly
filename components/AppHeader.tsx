import { useRouter } from 'expo-router';
import { ArrowLeft, LogOut, Share2 } from 'lucide-react-native';
import React from 'react';
import { Alert, Image, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';

const LocalLogo = require('../assets/images/veritly3.png');

interface AppHeaderProps {
    showAuthButtons?: boolean;
    title?: string;
    showBackButton?: boolean;
    homeRoute?: string;
}

export default function AppHeader({
    showAuthButtons = true,
    title,
    showBackButton = true,
    homeRoute = '/'
}: AppHeaderProps) {
    const router = useRouter();

    const handleLogout = async () => {
        // ... (keep same)
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

    const handleShare = async () => {
        // ... (keep same share logic)
        const shareMessage = {
            title: 'Veritly - IA para tu carrera',
            message: '¡Descubre Veritly! 🚀 Usa IA para analizar vacantes y mejorar tu CV. Antes de postular, Veritly. https://veritly.netlify.app',
            url: 'https://veritly.netlify.app'
        };

        try {
            if (Platform.OS === 'web') {
                if (navigator.share) {
                    await navigator.share({
                        title: shareMessage.title,
                        text: shareMessage.message,
                        url: shareMessage.url
                    });
                } else {
                    await navigator.clipboard.writeText(`${shareMessage.message}\n${shareMessage.url}`);
                    window.alert('¡Link copiado al portapapeles!');
                }
            } else {
                await Share.share({
                    message: shareMessage.message,
                    url: shareMessage.url,
                    title: shareMessage.title
                });
            }
        } catch (error: any) {
            console.log('Error sharing:', error);
        }
    };

    return (
        <View style={styles.header}>
            <View style={styles.leftSection}>
                {showBackButton && (
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <ArrowLeft size={20} color="#94a3b8" />
                        <Text style={styles.backButtonText}>Atrás</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.logoSection}
                    onPress={() => router.replace(homeRoute as any)}
                >
                    <Image source={LocalLogo} style={styles.logoImage} resizeMode="contain" />
                    <View>
                        <Text style={styles.appName}>{title || 'VERITLY'}</Text>
                        <Text style={styles.tagline}>Antes de postular, Veritly</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {showAuthButtons && (
                <View style={styles.buttonSection}>
                    <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                        <Share2 size={18} color="#3b82f6" />
                        <Text style={styles.shareButtonText}>Compartir</Text>
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
    tagline: {
        fontSize: 9,
        color: '#f59e0b',
        fontStyle: 'italic',
        fontWeight: '600'
    },
    buttonSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
        borderWidth: 1,
        borderColor: '#3b82f6'
    },
    shareButtonText: {
        color: '#3b82f6',
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
