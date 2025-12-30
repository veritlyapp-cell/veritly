import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowRight, Brain, Briefcase, CheckCircle, Lightbulb, MessageSquare, Sparkles, Target, TrendingUp, Zap } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const LocalLogo = require('../assets/images/veritly3.png');

export default function LandingPage() {
    const router = useRouter();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const [matchScore] = useState(95);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: true
            })
        ]).start();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
            <ScrollView contentContainerStyle={styles.content}>

                {/* HERO SECTION */}
                <View style={styles.hero}>
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                        {/* Logo y Tagline */}
                        <View style={styles.logoSection}>
                            <Image source={LocalLogo} style={styles.logoImage} resizeMode="contain" />
                            <Text style={styles.tagline}>✨ Antes de postular, Veritly</Text>
                        </View>

                        {/* Título Principal */}
                        <Text style={styles.heroTitle}>
                            Consigue el trabajo que{'\n'}
                            <Text style={styles.heroTitleHighlight}>sí encaja contigo</Text>,{'\n'}
                            analizado por IA
                        </Text>

                        <Text style={styles.heroSubtitle}>
                            Deja que nuestra inteligencia artificial analice tus habilidades y te conecte con las oportunidades perfectas para ti.
                        </Text>

                        {/* CTA Buttons */}
                        <View style={styles.ctaContainer}>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => router.push('/signin?register=true')}
                            >
                                <LinearGradient
                                    colors={['#3b82f6', '#8b5cf6']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.gradientButton}
                                >
                                    <Text style={styles.primaryButtonText}>Comenzar Gratis</Text>
                                    <ArrowRight size={20} color="white" />
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={[styles.secondaryButton, { opacity: 0.7 }]}>
                                <Text style={styles.secondaryButtonText}>Soy Empresa (Pronto)</Text>
                                <Briefcase size={18} color="#38bdf8" />
                            </View>
                        </View>
                    </Animated.View>

                    {/* Match Score Card (Simulación) */}
                    <View style={styles.matchCard}>
                        <View style={styles.cardGlow} />
                        <View style={styles.cardContent}>
                            <View style={styles.cardHeader}>
                                <Brain size={24} color="#38bdf8" />
                                <Text style={styles.cardTitle}>Análisis IA</Text>
                            </View>

                            <View style={styles.scoreCircle}>
                                <Text style={styles.scoreNumber}>{matchScore}</Text>
                                <Text style={styles.scoreLabel}>MATCH</Text>
                            </View>

                            <View style={styles.cardDetails}>
                                <View style={styles.detailRow}>
                                    <CheckCircle size={16} color="#10b981" />
                                    <Text style={styles.detailText}>Skills perfectos</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Sparkles size={16} color="#f59e0b" />
                                    <Text style={styles.detailText}>3 recomendaciones</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <TrendingUp size={16} color="#3b82f6" />
                                    <Text style={styles.detailText}>Alto potencial</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* CARACTERÍSTICAS */}
                <View style={styles.featuresSection}>
                    <View style={styles.sectionHeader}>
                        <Sparkles size={28} color="#38bdf8" />
                        <Text style={styles.sectionTitle}>Potenciado por IA</Text>
                    </View>

                    <View style={styles.featuresGrid}>
                        {[
                            { icon: Target, title: "Match Score Preciso", desc: "Algoritmo IA que calcula tu compatibilidad con cada vacante en segundos", color: "#3b82f6" },
                            { icon: Lightbulb, title: "Consejos Personalizados", desc: "Recibe recomendaciones específicas para mejorar tu perfil y destacar", color: "#f59e0b" },
                            { icon: MessageSquare, title: "Preguntas Clave", desc: "La IA genera automáticamente preguntas de entrevista para que practiques", color: "#10b981" },
                            { icon: Zap, title: "Análisis Instantáneo", desc: "Resultados en tiempo real sin esperas ni procesos complicados", color: "#8b5cf6" }
                        ].map((feature, index) => (
                            <View key={index} style={styles.featureCard}>
                                <View style={[styles.featureIconContainer, { backgroundColor: `${feature.color}20` }]}>
                                    <feature.icon size={28} color={feature.color} />
                                </View>
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureDesc}>{feature.desc}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* SECCIÓN EMPRESAS */}
                <View style={styles.companySection}>
                    <View style={styles.companySectionInner}>
                        <Briefcase size={40} color="#38bdf8" />
                        <Text style={styles.companySectionTitle}>¿Eres Reclutador?</Text>
                        <Text style={styles.companySectionSubtitle}>
                            Encuentra a los candidatos perfectos con IA. Análisis automático de CVs, scoring inteligente y recomendaciones instantáneas.
                        </Text>
                        <Text style={styles.companySectionTagline}>✨ Antes de contratar, Veritly</Text>

                        <View style={styles.companyButton}>
                            <Text style={styles.companyButtonText}>Muy pronto: Antes de contratar, Veritly</Text>
                            <Sparkles size={20} color="white" />
                        </View>
                    </View>
                </View>

                {/* FOOTER */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>© 2024 Veritly - Powered by Gemini AI</Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A'
    },
    content: {
        paddingBottom: 40
    },
    hero: {
        padding: 30,
        minHeight: 700
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 30
    },
    logoImage: {
        width: 80,
        height: 80,
        marginBottom: 10
    },
    tagline: {
        fontSize: 14,
        color: '#f59e0b',
        fontWeight: '700',
        fontStyle: 'italic',
        letterSpacing: 0.5
    },
    heroTitle: {
        fontSize: 42,
        fontWeight: '900',
        color: 'white',
        textAlign: 'center',
        lineHeight: 50,
        marginBottom: 20,
        letterSpacing: -1
    },
    heroTitleHighlight: {
        color: '#38bdf8'
    },
    heroSubtitle: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
        paddingHorizontal: 20
    },
    ctaContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 50,
        flexWrap: 'wrap'
    },
    primaryButton: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12
    },
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 28,
        gap: 10
    },
    primaryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 28,
        borderRadius: 12,
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderWidth: 2,
        borderColor: '#38bdf8',
        gap: 10
    },
    secondaryButtonText: {
        color: '#38bdf8',
        fontSize: 16,
        fontWeight: '800'
    },
    matchCard: {
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.3)',
        marginTop: 20,
        position: 'relative',
        overflow: 'hidden'
    },
    cardGlow: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        backgroundColor: '#38bdf8',
        opacity: 0.1,
        borderRadius: 75,
        shadowColor: '#38bdf8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 60,
        elevation: 10
    },
    cardContent: {
        position: 'relative',
        zIndex: 1
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20
    },
    cardTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700'
    },
    scoreCircle: {
        alignSelf: 'center',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderWidth: 4,
        borderColor: '#38bdf8',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    scoreNumber: {
        fontSize: 40,
        fontWeight: '900',
        color: '#38bdf8'
    },
    scoreLabel: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '700',
        letterSpacing: 2
    },
    cardDetails: {
        gap: 12
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    detailText: {
        color: '#cbd5e1',
        fontSize: 14
    },
    featuresSection: {
        padding: 30,
        paddingTop: 60
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 40
    },
    sectionTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: 'white',
        letterSpacing: -0.5
    },
    featuresGrid: {
        gap: 20
    },
    featureCard: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.3)'
    },
    featureIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    featureTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: 'white',
        marginBottom: 8,
        letterSpacing: -0.3
    },
    featureDesc: {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 22
    },
    companySection: {
        margin: 30,
        marginTop: 60,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        borderWidth: 2,
        borderColor: 'rgba(59, 130, 246, 0.2)'
    },
    companySectionInner: {
        padding: 40,
        alignItems: 'center'
    },
    companySectionTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: 'white',
        marginTop: 20,
        marginBottom: 12,
        letterSpacing: -0.5
    },
    companySectionSubtitle: {
        fontSize: 15,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 16
    },
    companySectionTagline: {
        fontSize: 13,
        color: '#10b981',
        fontWeight: '700',
        fontStyle: 'italic',
        marginBottom: 30
    },
    companyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3b82f6',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 10,
        gap: 10,
        elevation: 5,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8
    },
    companyButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700'
    },
    footer: {
        padding: 30,
        alignItems: 'center'
    },
    footerText: {
        color: '#64748b',
        fontSize: 12
    }
});
