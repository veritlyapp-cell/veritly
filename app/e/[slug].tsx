import { useLocalSearchParams, useRouter } from 'expo-router';
import { Briefcase, ChevronRight, Clock, MapPin, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { openAppPath } from '../../utils/publicLinks';

// Pagina de empleos publica de una empresa o reclutador (veritlyapp.com/e/{slug}).
// Todas las cuentas tienen una, armada con el logo y los datos de su
// Configuracion; el plan Gold suma banner y color de marca. Datos desde
// netlify/functions/landing-page.ts (solo campos publicos, sin confidenciales).

const EMPLOYMENT_LABELS: Record<string, string> = {
    tiempo_completo: 'Tiempo completo',
    medio_tiempo: 'Medio tiempo',
    honorarios: 'Freelance / Honorarios',
    practicas: 'Prácticas',
};

const timeAgo = (iso?: string | null) => {
    if (!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (isNaN(days)) return '';
    if (days <= 0) return 'Publicada hoy';
    if (days === 1) return 'Publicada ayer';
    if (days < 30) return `Publicada hace ${days} días`;
    return `Publicada el ${new Date(iso).toLocaleDateString()}`;
};

export default function CompanyJobsPage() {
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
                    body: JSON.stringify({ action: 'get_by_slug', slug: String(slug || '').toLowerCase() })
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
            <SafeAreaView style={[styles.container, styles.centered]}>
                <ActivityIndicator color="#4F46E5" size="large" />
            </SafeAreaView>
        );
    }

    if (error || !data) {
        return (
            <SafeAreaView style={[styles.container, styles.centered]}>
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                <Briefcase size={40} color="#9CA3AF" />
                <Text style={styles.errorTitle}>Página no encontrada</Text>
                <Text style={styles.errorText}>Revisa el link o pide a la empresa uno actualizado.</Text>
                <TouchableOpacity onPress={() => openAppPath(router, '/')} style={{ marginTop: 16 }}>
                    <Text style={styles.link}>Ir a Veritly</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const brand = data.brandColor || '#4F46E5';

    const openRacso = () => {
        // Mismo registro de clics que los botones de Racso en la vacante
        addDoc(collection(db, 'racso_clicks'), {
            jobId: null,
            jobTitle: null,
            companyName: data.companyName || 'Desconocido',
            platform: Platform.OS,
            context: 'pagina_empleos',
            createdAt: new Date(),
        }).catch(() => {});
        Linking.openURL('https://racso.app/ingreso');
    };
    const jobs: any[] = data.jobs || [];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <ScrollView contentContainerStyle={styles.scroll}>
                {data.bannerUrl && <Image source={{ uri: data.bannerUrl }} style={styles.banner} resizeMode="cover" />}

                <View style={styles.header}>
                    <View style={[styles.logo, { borderColor: `${brand}33`, backgroundColor: `${brand}12` }]}>
                        {data.logoUrl
                            ? <Image source={{ uri: data.logoUrl }} style={styles.logoImage} />
                            : <Text style={[styles.logoInitial, { color: brand }]}>{(data.companyName || '?').charAt(0).toUpperCase()}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.companyName}>{data.companyName}</Text>
                        <Text style={styles.companyMeta}>
                            {data.companyType === 'independiente' ? 'Reclutador independiente' : 'Empresa'}
                            {data.rubro ? `  ·  ${data.rubro}` : ''}
                        </Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>
                    {jobs.length === 0 ? 'Vacantes' : jobs.length === 1 ? '1 vacante abierta' : `${jobs.length} vacantes abiertas`}
                </Text>

                {jobs.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No hay vacantes abiertas en este momento. Vuelve pronto.</Text>
                    </View>
                ) : (
                    jobs.map((job) => (
                        <TouchableOpacity key={job.id} style={styles.jobCard} onPress={() => openAppPath(router, `/vacante/${job.id}`)}>
                            <View style={[styles.jobIcon, { backgroundColor: `${brand}14` }]}>
                                <Briefcase color={brand} size={20} />
                            </View>
                            <View style={{ flex: 1, gap: 4 }}>
                                <Text style={styles.jobTitle}>{job.jobTitle}</Text>
                                <View style={styles.metaRow}>
                                    {job.employmentType && (
                                        <View style={styles.meta}><Clock size={12} color="#6B7280" /><Text style={styles.metaText}>{EMPLOYMENT_LABELS[job.employmentType] || 'Tiempo completo'}</Text></View>
                                    )}
                                    {job.location && (
                                        <View style={styles.meta}><MapPin size={12} color="#6B7280" /><Text style={styles.metaText}>{job.location}</Text></View>
                                    )}
                                </View>
                                {job.createdAt && <Text style={styles.metaText}>{timeAgo(job.createdAt)}</Text>}
                            </View>
                            <View style={styles.applyPill}>
                                <Text style={[styles.applyText, { color: brand }]}>Postular</Text>
                                <ChevronRight size={16} color={brand} />
                            </View>
                        </TouchableOpacity>
                    ))
                )}

                {/* Freemium: invitacion a Racso (candidatos) y a Veritly (reclutadores) */}
                {data.tier === 'free' && (
                    <>
                        <TouchableOpacity style={styles.promoCard} onPress={openRacso}>
                            <Image source={require('../../assets/images/racso-logo.png')} style={styles.promoLogo} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.promoTitle}>¿Vas a postular? Potencia tu CV con Racso</Text>
                                <Text style={styles.promoText}>Arma un CV de alto impacto y prepárate para tus entrevistas.</Text>
                            </View>
                            <ChevronRight size={18} color="#6B7280" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.promoCard} onPress={() => openAppPath(router, '/?utm_source=pagina_empleos&utm_medium=referral')}>
                            <View style={[styles.promoLogo, styles.promoVeritly]}><Zap size={18} color="#f59e0b" /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.promoTitle}>Publica empleos gratis hoy mismo en Veritly</Text>
                                <Text style={styles.promoText}>Crea tu página de empleos y recibe candidatos pre-filtrados con IA.</Text>
                            </View>
                            <ChevronRight size={18} color="#6B7280" />
                        </TouchableOpacity>
                    </>
                )}

                {/* Planes de pago: una linea que invita a publicar en Veritly (Gold: nada) */}
                {data.tier === 'paid' && (
                    <TouchableOpacity style={styles.footer} onPress={() => openAppPath(router, '/?utm_source=pagina_empleos&utm_medium=referral')}>
                        <Zap size={12} color="#f59e0b" />
                        <Text style={styles.footerText}>¿Reclutas? <Text style={{ color: '#f59e0b', fontWeight: 'bold' }}>Publica empleos gratis hoy mismo en Veritly →</Text></Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    scroll: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 40 },
    banner: { width: '100%', aspectRatio: 3, borderRadius: 16, marginBottom: 20, backgroundColor: '#F3F4F6' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
    logo: { width: 72, height: 72, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    logoImage: { width: 72, height: 72 },
    logoInitial: { fontSize: 28, fontWeight: '800' },
    companyName: { fontSize: 24, fontWeight: '800', color: '#111827' },
    companyMeta: { fontSize: 14, color: '#6B7280', marginTop: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 12 },
    empty: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 24, alignItems: 'center' },
    emptyText: { color: '#6B7280', fontSize: 14, textAlign: 'center' },
    jobCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, marginBottom: 12, backgroundColor: '#FFFFFF' },
    jobIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    jobTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: '#6B7280' },
    applyPill: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    applyText: { fontSize: 13, fontWeight: '700' },
    promoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
    promoLogo: { width: 36, height: 36, borderRadius: 18 },
    promoVeritly: { backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
    promoTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
    promoText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 28 },
    footerText: { color: '#9CA3AF', fontSize: 12 },
    errorTitle: { color: '#111827', fontSize: 18, fontWeight: '700', marginTop: 12 },
    errorText: { color: '#6B7280', fontSize: 14, textAlign: 'center', marginTop: 6 },
    link: { color: '#4F46E5', fontWeight: '700' },
});
