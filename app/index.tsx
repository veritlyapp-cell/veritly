import { useRouter } from 'expo-router';
import { Briefcase, CheckCircle, Sparkles, Target, Zap } from 'lucide-react-native';
import React from 'react';
import { Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const LocalLogo = require('../assets/images/veritly3.png');
const FriendlyHero = require('../assets/images/friendly_hero.png');
const SuccessMoment = require('../assets/images/success_moment.png');
const AIFeatureImage = require('../assets/images/ai_feature.png');

export default function VeritlyLandingPage() {
    const router = useRouter();

    const features = [
        {
            icon: Sparkles,
            title: "Match Score Preciso",
            description: "Sube tu CV y cualquier oferta de trabajo. Te mostramos tu compatibilidad al instante"
        },
        {
            icon: Target,
            title: "Consejos Personalizados",
            description: "La IA te dirá exactamente qué agregar o mejorar en tu CV para esa posición"
        },
        {
            icon: Zap,
            title: "Preguntas Clave",
            description: "Con alto match, te compartimos las preguntas que seguro te harán en la entrevista"
        },
        {
            icon: CheckCircle,
            title: "Tracking de Estatus",
            description: "Guarda tus postulaciones y el estado. La IA aprenderá y te dará mejores consejos"
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
                    </View>
                    <TouchableOpacity onPress={() => router.push('/signin')}>
                        <Text style={styles.navLink}>Iniciar Sesión</Text>
                    </TouchableOpacity>
                </View>

                {/* HERO SECTION WITH IMAGE */}
                <View style={styles.hero}>
                    <View style={styles.heroContent}>
                        <View style={styles.heroLeft}>
                            <View style={styles.badge}>
                                <Sparkles color="#3b82f6" size={14} />
                                <Text style={styles.badgeText}>Tu coach personal de IA</Text>
                            </View>
                            <Text style={styles.heroTitle}>
                                Tu próximo trabajo{'\n'}
                                <Text style={styles.heroTitleHighlight}>está a un click</Text>
                            </Text>
                            <Text style={styles.heroSubtitle}>
                                ¿Te has preguntado si tu CV encaja con ese trabajo? Nosotros te lo decimos. Veritly analiza tu perfil vs. cualquier oferta y te da tu % de match + consejos prácticos + preguntas de entrevista.
                            </Text>

                            {/* CTA BUTTONS */}
                            <View style={styles.ctaContainer}>
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={() => router.push('/(tabs)/profile')}
                                >
                                    <Text style={styles.primaryButtonText}>Comenzar Gratis</Text>
                                    <Zap color="white" size={20} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => router.push('/signin')}
                                >
                                    <Text style={styles.secondaryButtonText}>Iniciar Sesión</Text>
                                </TouchableOpacity>
                            </View>

                            {/* TRUST INDICATORS */}
                            <View style={styles.stats}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>95%</Text>
                                    <Text style={styles.statLabel}>Precisión IA</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>2min</Text>
                                    <Text style={styles.statLabel}>Tiempo promedio</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>24/7</Text>
                                    <Text style={styles.statLabel}>Disponible</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.heroRight}>
                            <View style={styles.heroImageContainer}>
                                <Image source={FriendlyHero} style={styles.heroImage} resizeMode="cover" />
                                <View style={styles.heroImageOverlay} />
                            </View>
                        </View>
                    </View>
                </View>

                {/* AI FEATURE SHOWCASE */}
                <View style={styles.aiSection}>
                    <View style={styles.twoColumnSection}>
                        <View style={styles.aiImageContainer}>
                            <Image source={SuccessMoment} style={styles.aiImage} resizeMode="contain" />
                        </View>
                        <View style={styles.aiContent}>
                            <Text style={styles.aiTitle}>¡Prepárate como un pro!</Text>
                            <Text style={styles.aiDescription}>
                                Imagina saber exactamente qué tan bien encajas ANTES de postular. Eso es lo que hacemos: analizamos tu CV con la IA, te decimos tu % de match, qué te falta, y si eres buen candidato, te damos las preguntas clave para esa entrevista.
                            </Text>
                        </View>
                    </View>
                </View>

                {/* FEATURES GRID */}
                <View style={styles.features}>
                    <Text style={styles.sectionTitle}>Cómo funciona (es súper simple)</Text>
                    <View style={styles.featureGrid}>
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <View key={index} style={styles.featureCard}>
                                    <View style={styles.featureIconContainer}>
                                        <Icon color="#3b82f6" size={28} />
                                    </View>
                                    <Text style={styles.featureTitle}>{feature.title}</Text>
                                    <Text style={styles.featureDescription}>{feature.description}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* CTA SECTION */}
                <View style={styles.ctaSection}>
                    <Text style={styles.ctaTitle}>¿Listo para llegar mejor preparado a tus entrevistas?</Text>
                    <Text style={styles.ctaSubtitle}>Miles de personas ya usan Veritly para saber exactamente dónde están parados antes de postular</Text>
                    <TouchableOpacity
                        style={styles.ctaButton}
                        onPress={() => router.push('/(tabs)/profile')}
                    >
                        <Text style={styles.ctaButtonText}>Crear cuenta gratis</Text>
                        <Zap color="white" size={20} />
                    </TouchableOpacity>
                </View>

                {/* COMPANY LINK */}
                <View style={styles.footer}>
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={styles.companyLink}
                        onPress={() => router.push('/empresa')}
                    >
                        <Briefcase color="#10b981" size={20} />
                        <Text style={styles.companyLinkText}>
                            ¿Eres empresa? Descubre Veritly para Reclutadores
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
    navLink: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },

    // Hero Section
    hero: { paddingHorizontal: 30, paddingTop: 40, paddingBottom: 60 },
    heroContent: { flexDirection: 'row', gap: 30, alignItems: 'center' },
    heroLeft: { flex: 1 },
    badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, alignSelf: 'flex-start', marginBottom: 20 },
    badgeText: { color: '#3b82f6', fontWeight: '700', fontSize: 12 },
    heroTitle: { fontSize: 48, fontWeight: '900', color: 'white', marginBottom: 20, lineHeight: 56, letterSpacing: -1.5 },
    heroTitleHighlight: { color: '#3b82f6' },
    heroSubtitle: { fontSize: 18, color: '#94a3b8', lineHeight: 28, marginBottom: 30 },
    heroRight: { flex: 1, display: 'none' }, // Hidden on mobile
    heroImageContainer: { position: 'relative', borderRadius: 24, overflow: 'hidden', elevation: 10 },
    heroImage: { width: '100%', height: 400 },
    heroImageOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(59, 130, 246, 0.1)' },

    // CTA Buttons
    ctaContainer: { flexDirection: 'row', gap: 12, marginBottom: 40 },
    primaryButton: { backgroundColor: '#3b82f6', flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12, alignItems: 'center', gap: 8, elevation: 5, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    primaryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    secondaryButton: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    secondaryButtonText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 16 },

    // Stats
    stats: { flexDirection: 'row', gap: 20 },
    statItem: { flex: 1 },
    statNumber: { fontSize: 24, fontWeight: '900', color: '#3b82f6', marginBottom: 4 },
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
    featureIconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(59, 130, 246, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    featureTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 10 },
    featureDescription: { fontSize: 15, color: '#94a3b8', lineHeight: 22 },

    // CTA Section
    ctaSection: { paddingHorizontal: 30, paddingVertical: 60, backgroundColor: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)', alignItems: 'center', marginBottom: 40 },
    ctaTitle: { fontSize: 36, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 16 },
    ctaSubtitle: { fontSize: 18, color: '#cbd5e1', textAlign: 'center', marginBottom: 30 },
    ctaButton: { backgroundColor: '#10b981', flexDirection: 'row', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 12, alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#10b981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
    ctaButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },

    // Footer
    footer: { paddingHorizontal: 30, paddingTop: 40 },
    divider: { height: 1, backgroundColor: '#334155', marginBottom: 30 },
    companyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, borderWidth: 1, borderColor: '#10b981', gap: 10, marginBottom: 20 },
    companyLinkText: { color: '#10b981', fontSize: 16, fontWeight: '600' },
    copyright: { textAlign: 'center', color: '#64748b', fontSize: 14, paddingVertical: 20 }
});