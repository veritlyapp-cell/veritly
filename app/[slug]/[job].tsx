import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { openAppPath } from '../../utils/publicLinks';

// Link de vacante bajo la pagina de la empresa: vjobs.app/{empresa}/{vacante}.
// Resuelve el slug via job-slug.ts (que valida que la vacante sea de esa empresa
// y no confidencial) y manda a la pagina real /vacante/{id} en veritlyapp.com.
export default function CompanyJobLinkRedirect() {
    const { slug, job } = useLocalSearchParams();
    const router = useRouter();
    const [error, setError] = useState('');

    useEffect(() => {
        const resolve = async () => {
            try {
                const res = await fetch('/.netlify/functions/job-slug', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'resolve', slug: String(job).toLowerCase(), companySlug: String(slug).toLowerCase() }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'No se pudo abrir la vacante');
                openAppPath(router, `/vacante/${json.jobId}`, true);
            } catch (e: any) {
                setError(e.message);
            }
        };
        if (slug && job) resolve();
    }, [slug, job]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            {error ? (
                <>
                    <Text style={styles.errorTitle}>Vacante no encontrada</Text>
                    <Text style={styles.errorText}>Puede que ya no esté disponible.</Text>
                    <TouchableOpacity onPress={() => router.replace(`/${String(slug)}` as any)} style={{ marginTop: 16 }}>
                        <Text style={styles.link}>Ver las vacantes abiertas</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <ActivityIndicator color="#4F46E5" size="large" />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
    errorTitle: { color: '#111827', fontSize: 18, fontWeight: '700', marginBottom: 8 },
    errorText: { color: '#6B7280', fontSize: 14, textAlign: 'center' },
    link: { color: '#4F46E5', fontWeight: '700' },
});
