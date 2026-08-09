import { useLocalSearchParams, useRouter } from 'expo-router';
import { Briefcase, MapPin } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CompanyLandingPage() {
    const { slug } = useLocalSearchParams();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/.netlify/functions/landing-page', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_by_slug', slug })
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'No se pudo cargar la página');
                setData(json);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        if (slug) load();
    }, [slug]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator color="#38bdf8" size="large" />
            </SafeAreaView>
        );
    }

    if (error || !data) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
                <Text style={styles.errorTitle}>Página no encontrada</Text>
                <Text style={styles.errorText}>{error || 'Esta empresa no tiene una página de empleos activa.'}</Text>
            </SafeAreaView>
        );
    }

    const brandColor = data.brandColor || '#4F46E5';

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {data.bannerUrl && (
                    <Image source={{ uri: data.bannerUrl }} style={styles.banner} resizeMode="contain" />
                )}
                <View style={styles.header}>
                    {data.logoUrl && (
                        <Image source={{ uri: data.logoUrl }} style={styles.logo} />
                    )}
                    <Text style={styles.companyName}>{data.companyName}</Text>
                    <Text style={styles.subtitle}>Vacantes activas</Text>
                </View>

                <View style={{ paddingHorizontal: 20 }}>
                    {data.jobs.length === 0 ? (
                        <Text style={styles.emptyText}>Esta empresa no tiene vacantes publicadas por ahora.</Text>
                    ) : (
                        data.jobs.map((job: any) => (
                            <TouchableOpacity
                                key={job.id}
                                style={styles.jobCard}
                                onPress={() => router.push(`/vacante/${job.id}` as any)}
                            >
                                <View style={[styles.jobIcon, { backgroundColor: `${brandColor}22` }]}>
                                    <Briefcase color={brandColor} size={20} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.jobTitle}>{job.jobTitle}</Text>
                                    {job.location && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <MapPin size={12} color="#64748b" />
                                            <Text style={styles.jobLocation}>{job.location}</Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                <Text style={styles.footer}>Powered by Veritly</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
    errorTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 8 },
    errorText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
    banner: { width: '100%', height: 160, backgroundColor: '#1e293b' },
    header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
    logo: { width: 72, height: 72, borderRadius: 36, marginBottom: 12, backgroundColor: '#1e293b' },
    companyName: { color: 'white', fontSize: 22, fontWeight: '800', textAlign: 'center' },
    subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 6 },
    emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 30 },
    jobCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
    jobIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    jobTitle: { color: 'white', fontSize: 15, fontWeight: '700' },
    jobLocation: { color: '#64748b', fontSize: 12, marginLeft: 4 },
    footer: { color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 30 },
});
