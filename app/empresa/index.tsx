import { useRouter } from 'expo-router';
import { BarChart3, Brain, Check, Clock, TrendingUp, Users, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const LocalLogo = require('../../assets/images/veritly3.png');
const CompanyHeroImage = require('../../assets/images/company_hero.png');
const AIFeatureImage = require('../../assets/images/ai_feature.png');

export default function VeritlyCompanyLandingPage() {
    const router = useRouter();

    const [plans, setPlans] = useState<any[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const snap = await getDocs(collection(db, 'config_plans'));
                const plansData = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as any))
                    .filter((p: any) => !p.isHidden);
                plansData.sort((a, b) => (a.priceMonthly || 0) - (b.priceMonthly || 0));
                setPlans(plansData);
            } catch (e) {
                console.error("Error cargando planes:", e);
            } finally {
                setPlansLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const features = [
        {
            icon: Brain,
            title: "Bandeja Unificada",
            description: "Junta todas tus postulaciones (WhatsApp, correo, portales) en un solo panel ordenado y visual."
        },
        {
            icon: Zap,
            title: "Matching por IA",
            description: "Calificación automática e instantánea que evalúa habilidades y experiencia contra tus requerimientos."
        },
        {
            icon: BarChart3,
            title: "Fichas de Candidatos",
            description: "Reportes automáticos con fortalezas, áreas de mejora y preguntas sugeridas para la entrevista."
        },
        {
            icon: Users,
            title: "Menos Abandono",
            description: "Los candidatos postulan en segundos subiendo su CV sin tener que llenar formularios repetitivos."
        }
    ];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
            <ScrollView contentContainerStyle={styles.content}>

                {/* NAVIGATION BAR */}
                <View style={styles.navbar}>
                    <View style={styles.navLogo}>
                        <Image source={LocalLogo} style={styles.navLogoImage} resizeMode="contain" />
                        <Text style={styles.navBrand}>Veritly</Text>
                        <View style={styles.navBadge}>
                            <Text style={styles.navBadgeText}>Para Empresas</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/empresa/signin')}>
                        <Text style={styles.navLink}>Iniciar Sesión</Text>
                    </TouchableOpacity>
                </View>

                {/* HERO SECTION WITH IMAGE */}
                <View style={styles.hero}>
                    <View style={styles.heroContent}>
                        <View style={styles.heroLeft}>
                            <View style={styles.badge}>
                                <Brain color="#10b981" size={14} />
                                <Text style={styles.badgeText}>Reclutamiento Inteligente</Text>
                            </View>
                            <Text style={styles.heroTitle}>
                                Centraliza tu{'\n'}
                                <Text style={styles.heroTitleHighlight}>Reclutamiento</Text>
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                <Text style={{ fontSize: 16, color: '#10b981', fontWeight: '700', fontStyle: 'italic' }}>
                                    ✨ Veritly: Tu reclutamiento centralizado
                                </Text>
                            </View>
                            <Text style={styles.heroSubtitle}>
                                Recibe y ordena tus candidatos en un solo lugar. Nuestra IA analiza los CVs, calcula el Score de Match y te prepara el reporte de entrevista al instante.
                            </Text>

                            {/* CTA BUTTONS */}
                            <View style={styles.ctaContainer}>
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={() => router.push('/empresa/signin?register=true')}
                                >
                                    <Text style={styles.primaryButtonText}>Comenzar Gratis</Text>
                                    <Zap color="white" size={20} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => router.push('/empresa/signin')}
                                >
                                    <Text style={styles.secondaryButtonText}>Login Empresa</Text>
                                </TouchableOpacity>
                            </View>

                            {/* TRUST INDICATORS */}
                            <View style={styles.stats}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>10x</Text>
                                    <Text style={styles.statLabel}>Más eficiente</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>95%</Text>
                                    <Text style={styles.statLabel}>Precisión</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>24/7</Text>
                                    <Text style={styles.statLabel}>Disponible</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.heroRight}>
                            <View style={styles.heroImageContainer}>
                                <Image source={CompanyHeroImage} style={styles.heroImage} resizeMode="cover" />
                                <View style={styles.heroImageOverlay} />
                            </View>
                        </View>
                    </View>
                </View>

                {/* AI FEATURE SHOWCASE */}
                <View style={styles.aiSection}>
                    <View style={styles.aiImageContainer}>
                        <Image source={AIFeatureImage} style={styles.aiImage} resizeMode="contain" />
                    </View>
                    <View style={styles.aiContent}>
                        <Text style={styles.aiTitle}>IA que entiende tu puesto y encuentra el match perfecto</Text>
                        <Text style={styles.aiDescription}>
                            Sube tu descripción de puesto y los CVs. Nuestra IA analiza habilidades, experiencia y compatibilidad para darte un ranking objetivo de candidatos con análisis detallado.
                        </Text>
                    </View>
                </View>

                {/* FEATURES GRID */}
                <View style={styles.features}>
                    <Text style={styles.sectionTitle}>Todo lo que necesitas para reclutar mejor</Text>
                    <View style={styles.featureGrid}>
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <View key={index} style={styles.featureCard}>
                                    <View style={styles.featureIconContainer}>
                                        <Icon color="#10b981" size={28} />
                                    </View>
                                    <Text style={styles.featureTitle}>{feature.title}</Text>
                                    <Text style={styles.featureDescription}>{feature.description}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* TESTIMONIAL / SOCIAL PROOF */}
                <View style={styles.proofSection}>
                    <Text style={styles.proofTitle}>Empresas que ya confían en Veritly</Text>
                    <View style={styles.metricsContainer}>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricNumber}>500+</Text>
                            <Text style={styles.metricLabel}>Empresas activas</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricNumber}>10K+</Text>
                            <Text style={styles.metricLabel}>CVs analizados</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricNumber}>85%</Text>
                            <Text style={styles.metricLabel}>Tiempo ahorrado</Text>
                        </View>
                    </View>
                </View>

                {/* PRICING SECTION */}
                <View style={styles.pricingSection}>
                    <Text style={styles.sectionTitle}>Planes simples, sin sorpresas</Text>
                    {plansLoading ? (
                        <ActivityIndicator size="large" color="#10b981" style={{ marginVertical: 30 }} />
                    ) : (
                        <View style={styles.pricingGrid}>
                            {plans.map((plan) => (
                                <View
                                    key={plan.id}
                                    style={[styles.pricingCard, plan.isRecommended && styles.pricingCardRecommended]}
                                >
                                    {plan.isRecommended && (
                                        <View style={styles.recommendedBadge}>
                                            <Text style={styles.recommendedBadgeText}>RECOMENDADO</Text>
                                        </View>
                                    )}
                                    <Text style={styles.pricingPlanName}>{plan.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 }}>
                                        <Text style={styles.pricingPrice}>S/ {plan.priceMonthly || 0}</Text>
                                        <Text style={styles.pricingPeriod}>/mes</Text>
                                    </View>
                                    <View style={{ marginTop: 16, gap: 10 }}>
                                        <View style={styles.pricingFeatureRow}>
                                            <Check size={16} color="#10b981" />
                                            <Text style={styles.pricingFeatureText}>{plan.aiAnalysisLimit || 0} análisis de IA/mes</Text>
                                        </View>
                                        <View style={styles.pricingFeatureRow}>
                                            <Check size={16} color="#10b981" />
                                            <Text style={styles.pricingFeatureText}>{plan.internalVacanciesLimit || 0} vacantes activas</Text>
                                        </View>
                                        {(plan.features || []).slice(0, 3).map((f: string, i: number) => (
                                            <View key={i} style={styles.pricingFeatureRow}>
                                                <Check size={16} color="#10b981" />
                                                <Text style={styles.pricingFeatureText}>{f}</Text>
                                            </View>
                                        ))}
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.pricingButton, plan.isRecommended && styles.pricingButtonRecommended]}
                                        onPress={() => router.push('/empresa/signin?register=true')}
                                    >
                                        <Text style={[styles.pricingButtonText, plan.isRecommended && { color: '#065f46' }]}>
                                            {plan.priceMonthly > 0 ? 'Elegir Plan' : 'Empezar Gratis'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* CTA SECTION */}
                <View style={styles.ctaSection}>
                    <Text style={styles.ctaTitle}>¿Listo para transformar tu reclutamiento?</Text>
                    <Text style={styles.ctaSubtitle}>Únete a las empresas que ya contratan más rápido y mejor con IA</Text>
                    <TouchableOpacity
                        style={styles.ctaButton}
                        onPress={() => router.push('/empresa/dashboard/profile')}
                    >
                        <Text style={styles.ctaButtonText}>Empezar ahora - Gratis</Text>
                        <TrendingUp color="white" size={20} />
                    </TouchableOpacity>
                </View>

                {/* CANDIDATE LINK */}
                <View style={styles.footer}>
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={styles.candidateLink}
                        onPress={() => router.push('/')}
                    >
                        <Users color="#3b82f6" size={20} />
                        <Text style={styles.candidateLinkText}>
                            ¿Eres candidato? Encuentra tu trabajo ideal en Veritly
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.copyright}>© {new Date().getFullYear()} Relié Labs LLC. Veritly es un producto de Relié Labs LLC.</Text>
                    <View style={styles.legalLinks}>
                        <TouchableOpacity onPress={() => router.push('/privacy')}>
                            <Text style={styles.legalLinkText}>Términos y Condiciones</Text>
                        </TouchableOpacity>
                        <Text style={styles.legalLinkSeparator}>·</Text>
                        <TouchableOpacity onPress={() => router.push('/privacy')}>
                            <Text style={styles.legalLinkText}>Política de Privacidad</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0f1e' },
    content: { paddingBottom: 40 },

    // Navigation
    navbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 30, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    navLogo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    navLogoImage: { width: 32, height: 32 },
    navBrand: { fontSize: 24, fontWeight: '900', color: 'white', letterSpacing: -0.5 },
    navBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    navBadgeText: { color: '#10b981', fontSize: 11, fontWeight: '700' },
    navLink: { color: '#10b981', fontSize: 16, fontWeight: '600' },

    // Hero Section
    hero: { paddingHorizontal: 30, paddingTop: 40, paddingBottom: 60 },
    heroContent: { flexDirection: 'row', gap: 30, alignItems: 'center' },
    heroLeft: { flex: 1 },
    badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, alignSelf: 'flex-start', marginBottom: 20 },
    badgeText: { color: '#10b981', fontWeight: '700', fontSize: 12 },
    heroTitle: { fontSize: 48, fontWeight: '900', color: 'white', marginBottom: 20, lineHeight: 56, letterSpacing: -1.5 },
    heroTitleHighlight: { color: '#10b981' },
    heroSubtitle: { fontSize: 18, color: '#94a3b8', lineHeight: 28, marginBottom: 30 },
    heroRight: { flex: 1, display: 'none' }, // Hidden on mobile
    heroImageContainer: { position: 'relative', borderRadius: 24, overflow: 'hidden', elevation: 10 },
    heroImage: { width: '100%', height: 400 },
    heroImageOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16, 185, 129, 0.1)' },

    // CTA Buttons
    ctaContainer: { flexDirection: 'row', gap: 12, marginBottom: 40 },
    primaryButton: { backgroundColor: '#10b981', flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12, alignItems: 'center', gap: 8, elevation: 5, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    primaryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    secondaryButton: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#10b981', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    secondaryButtonText: { color: '#10b981', fontWeight: 'bold', fontSize: 16 },

    // Stats
    stats: { flexDirection: 'row', gap: 20 },
    statItem: { flex: 1 },
    statNumber: { fontSize: 24, fontWeight: '900', color: '#10b981', marginBottom: 4 },
    statLabel: { fontSize: 12, color: '#64748b' },

    // AI Section
    aiSection: { paddingHorizontal: 30, paddingVertical: 60, backgroundColor: '#111827', marginBottom: 40 },
    aiImageContainer: { width: '100%', height: 200, marginBottom: 30 },
    aiImage: { width: '100%', height: '100%' },
    aiContent: { alignItems: 'center' },
    aiTitle: { fontSize: 32, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 16 },
    aiDescription: { fontSize: 16, color: '#94a3b8', textAlign: 'center', lineHeight: 24 },

    // Features
    features: { paddingHorizontal: 30, marginBottom: 60 },
    sectionTitle: { fontSize: 36, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 40 },
    featureGrid: { gap: 16 },
    featureCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#334155' },
    featureIconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(16, 185, 129, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    featureTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 10 },
    featureDescription: { fontSize: 15, color: '#94a3b8', lineHeight: 22 },

    // Proof Section
    proofSection: { paddingHorizontal: 30, paddingVertical: 60, backgroundColor: '#0f172a', marginBottom: 40 },
    proofTitle: { fontSize: 28, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 40 },
    metricsContainer: { flexDirection: 'row', gap: 12 },
    metricCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#10b981' },
    metricNumber: { fontSize: 32, fontWeight: '900', color: '#10b981', marginBottom: 5 },
    metricLabel: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },

    // Pricing Section
    pricingSection: { paddingHorizontal: 30, marginBottom: 60 },
    pricingGrid: { gap: 16 },
    pricingCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: '#334155', position: 'relative' },
    pricingCardRecommended: { borderColor: '#10b981', borderWidth: 2 },
    recommendedBadge: { position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: '#10b981', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 100 },
    recommendedBadgeText: { color: '#0a0f1e', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
    pricingPlanName: { color: 'white', fontSize: 20, fontWeight: '800', marginBottom: 8 },
    pricingPrice: { color: 'white', fontSize: 40, fontWeight: '900' },
    pricingPeriod: { color: '#64748b', fontSize: 14, marginLeft: 4, marginBottom: 8 },
    pricingFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pricingFeatureText: { color: '#cbd5e1', fontSize: 14, flex: 1 },
    pricingButton: { marginTop: 24, backgroundColor: '#334155', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    pricingButtonRecommended: { backgroundColor: '#10b981' },
    pricingButtonText: { color: 'white', fontWeight: 'bold', fontSize: 15 },

    // CTA Section
    ctaSection: { paddingHorizontal: 30, paddingVertical: 60, backgroundColor: '#065f46', alignItems: 'center', marginBottom: 40, borderRadius: 24, marginHorizontal: 20 },
    ctaTitle: { fontSize: 36, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 16 },
    ctaSubtitle: { fontSize: 18, color: '#d1fae5', textAlign: 'center', marginBottom: 30 },
    ctaButton: { backgroundColor: 'white', flexDirection: 'row', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 12, alignItems: 'center', gap: 10, elevation: 8 },
    ctaButtonText: { color: '#065f46', fontWeight: 'bold', fontSize: 18 },

    // Footer
    footer: { paddingHorizontal: 30, paddingTop: 40 },
    divider: { height: 1, backgroundColor: '#334155', marginBottom: 30 },
    candidateLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 12, borderWidth: 1, borderColor: '#3b82f6', gap: 10, marginBottom: 20 },
    candidateLinkText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
    copyright: { textAlign: 'center', color: '#64748b', fontSize: 14, paddingTop: 20 },
    legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 20 },
    legalLinkText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
    legalLinkSeparator: { fontSize: 12, color: '#475569' }
});
