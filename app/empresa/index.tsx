import { useRouter } from 'expo-router';
import { BarChart3, Brain, Clock, TrendingUp, Users, Zap } from 'lucide-react-native';
import React from 'react';
import { Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const LocalLogo = require('../../assets/images/veritly3.png');
const CompanyHeroImage = require('../../assets/images/company_hero.png');
const AIFeatureImage = require('../../assets/images/ai_feature.png');

export default function VeritlyCompanyLandingPage() {
    const router = useRouter();

    const features = [
        {
            icon: Brain,
            title: "IA que Selecciona por Ti",
            description: "Deja que la inteligencia artificial analice CVs y encuentre los candidatos perfectos automáticamente"
        },
        {
            icon: Clock,
            title: "Ahorra 80% del Tiempo",
            description: "Screening automático de candidatos en segundos en lugar de horas de revisión manual"
        },
        {
            icon: BarChart3,
            title: "Matching Preciso",
            description: "Algoritmos avanzados que evalúan habilidades, experiencia y compatibilidad cultural"
        },
        {
            icon: TrendingUp,
            title: "Mejores Contrataciones",
            description: "Datos objetivos y análisis profundo para tomar decisiones informadas y acertadas"
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
                                <Text style={styles.badgeText}>AI-Powered Recruitment</Text>
                            </View>
                            <Text style={styles.heroTitle}>
                                Contrata talento{'\n'}
                                <Text style={styles.heroTitleHighlight}>80% más rápido</Text>
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                <Text style={{ fontSize: 16, color: '#10b981', fontWeight: '700', fontStyle: 'italic' }}>
                                    ✨ Antes de contratar, Veritly
                                </Text>
                            </View>
                            <Text style={styles.heroSubtitle}>
                                Deja que la IA analice CVs, evalúe candidatos y te muestre solo los perfiles que realmente encajan. Veritly convierte semanas de reclutamiento en horas.
                            </Text>

                            {/* CTA BUTTONS */}
                            <View style={styles.ctaContainer}>
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={() => router.push('/empresa/dashboard/onboarding')}
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

                {/* CTA SECTION */}
                <View style={styles.ctaSection}>
                    <Text style={styles.ctaTitle}>¿Listo para transformar tu reclutamiento?</Text>
                    <Text style={styles.ctaSubtitle}>Únete a las empresas que ya contratan más rápido y mejor con IA</Text>
                    <TouchableOpacity
                        style={styles.ctaButton}
                        onPress={() => router.push('/empresa/dashboard/onboarding')}
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
                    <Text style={styles.copyright}>© 2024 Veritly. Todos los derechos reservados.</Text>
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
    copyright: { textAlign: 'center', color: '#64748b', fontSize: 14, paddingVertical: 20 }
});
