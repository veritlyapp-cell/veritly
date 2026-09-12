import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { initFbPixel } from '../utils/fbPixel';
import { initGA } from '../utils/ga';
import { initClarity } from '../utils/clarity';
import { setConsent } from '../utils/cookieConsent';

interface Props {
    onResolved: () => void;
}

// Solo se muestra en Web (no aplica a apps nativas, que no usan cookies de
// navegador). Bloquea GA / Meta Pixel / Clarity hasta que el usuario decida.
export default function CookieBanner({ onResolved }: Props) {
    const router = useRouter();
    if (Platform.OS !== 'web') return null;

    const handleAccept = () => {
        setConsent('accepted');
        initGA();
        initFbPixel();
        initClarity();
        onResolved();
    };

    const handleReject = () => {
        setConsent('rejected');
        onResolved();
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.text}>
                    Usamos cookies propias y de terceros (Google Analytics, Meta Pixel, Microsoft Clarity) para entender cómo usas Veritly y mejorar tu experiencia.{' '}
                    <Text style={styles.link} onPress={() => router.push('/privacy')}>
                        Ver política de privacidad
                    </Text>
                </Text>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                        <Text style={styles.rejectText}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                        <Text style={styles.acceptText}>Aceptar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...(Platform.OS === 'web' ? { position: 'fixed' as any } : { position: 'absolute' }),
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#111827',
        paddingVertical: 16,
        paddingHorizontal: 20,
        zIndex: 9999,
        elevation: 20,
    },
    content: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
    },
    text: {
        color: '#E5E7EB',
        fontSize: 13,
        lineHeight: 19,
        flexGrow: 1,
        flexBasis: 280,
        maxWidth: 720,
    },
    link: {
        color: '#818CF8',
        textDecorationLine: 'underline',
        fontWeight: 'bold',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    rejectBtn: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#4B5563',
    },
    rejectText: {
        color: '#D1D5DB',
        fontWeight: '600',
        fontSize: 13,
    },
    acceptBtn: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        backgroundColor: '#4F46E5',
    },
    acceptText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 13,
    },
});
