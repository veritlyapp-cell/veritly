import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text } from 'react-native';

// Redirector de enlaces cortos de vacante: veritlyapp.com/v/{slug}
// -> resuelve el slug via job-slug.ts y manda a la pagina real /vacante/{id}.
// Existe solo para que el link que se comparte en LinkedIn/WhatsApp se vea
// corto, en vez del ID largo de Firestore.
export default function ShortJobLinkRedirect() {
    const { slug } = useLocalSearchParams();
    const router = useRouter();
    const [error, setError] = useState('');

    useEffect(() => {
        const resolve = async () => {
            try {
                const res = await fetch('/.netlify/functions/job-slug', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'resolve', slug })
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'No se pudo resolver el enlace');
                router.replace(`/vacante/${json.jobId}` as any);
            } catch (e: any) {
                setError(e.message);
            }
        };
        if (slug) resolve();
    }, [slug]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            {error ? (
                <>
                    <Text style={styles.errorTitle}>Enlace no encontrado</Text>
                    <Text style={styles.errorText}>{error}</Text>
                </>
            ) : (
                <ActivityIndicator color="#38bdf8" size="large" />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
    errorTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 8 },
    errorText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
});
