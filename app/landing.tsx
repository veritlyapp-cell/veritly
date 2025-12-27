import { useRouter } from 'expo-router';
import { Briefcase, CheckCircle, Sparkles, Target, Zap } from 'lucide-react-native';
import React from 'react';
import { Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const LocalLogo = require('../assets/images/veritly3.png');

export default function LandingPage() {
    const router = useRouter();

    const features = [
        {
            icon: Sparkles,
            title: "Análisis con IA",
            description: "Nuestro sistema analiza tu CV al instante y te conecta con las mejores oportunidades"
        },
        {
            icon: Target,
            title: "Matching Inteligente",
            description: "Encuentra trabajos que realmente coincidan con tu perfil y experiencia"
        },
        {
            icon: Zap,
            title: "Respuesta Rápida",
            description: "Obtén feedback inmediato de las empresas interesadas en tu perfil"
        },
        {
            icon: CheckCircle,
            title: "Proceso Simplificado",
            description: "Crea tu perfil una vez y aplica a múltiples ofertas en segundos"
        }
    ];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <ScrollView contentContainerStyle={styles.content}>

                {/* HERO SECTION */}
                <View style={styles.hero}>
                    <View style={styles.logoContainer}>
                        <Image source={LocalLogo} style={styles.logoImage} resizeMode="contain" />
                    </View>
                    <Text style={styles.heroTitle}>Encuentra tu próximo trabajo</Text>
                    <Text style={styles.heroSubtitle}>
                        Conecta con empresas que buscan exactamente tu talento
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 30, justifyContent: 'center' }}>
                        <Text style={{ fontSize: 14, color: '#f59e0b', fontWeight: '700', fontStyle: 'italic' }}>
                            ✨ Antes de postular, Veritly
                        </Text>
                    </View>
                    <Text style={styles.heroDescription}>
                        Veritly usa inteligencia artificial para analizar tu perfil y conectarte con las mejores oportunidades laborales del mercado.
                    </Text>

                    {/* CTA BUTTONS */}
                    <View style={styles.ctaContainer}>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => router.push('/signup')}
                        >
                            <Text style={styles.primaryButtonText}>Crear Cuenta Gratis</Text>
                            <Zap color="white" size={20} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => router.push('/signin')}
                        >
                            <Text style={styles.secondaryButtonText}>Iniciar Sesión</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* FEATURES GRID */}
                <View style={styles.features}>
                    <Text style={styles.sectionTitle}>¿Por qué elegir Veritly?</Text>
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

                {/* COMPANY LINK */}
                <View style={styles.footer}>
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={styles.companyLink}
                        onPress={() => router.push('/empresa')}
                    >
                        <Briefcase color="#38bdf8" size={20} />
                        <Text style={styles.companyLinkText}>
                            ¿Eres empresa? Descubre cómo podemos ayudarte
                        </Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    content: { paddingBottom: 40 },

    // Hero Section
    hero: { paddingHorizontal: 30, paddingTop: 60, paddingBottom: 40, alignItems: 'center' },
    logoContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(59, 130, 246, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 30, borderWidth: 2, borderColor: '#3b82f6' },
    logoImage: { width: 70, height: 70 },
    heroTitle: { fontSize: 36, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 15, letterSpacing: -1 },
    heroSubtitle: { fontSize: 20, color: '#cbd5e1', textAlign: 'center', marginBottom: 20, fontWeight: '600' },
    heroDescription: { fontSize: 16, color: '#94a3b8', textAlign: 'center', lineHeight: 24, marginBottom: 40, paddingHorizontal: 20 },

    // CTA Buttons
    ctaContainer: { width: '100%', gap: 15 },
    primaryButton: { backgroundColor: '#3b82f6', flexDirection: 'row', height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 5, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    primaryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
    secondaryButton: { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, borderColor: '#3b82f6', height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    secondaryButtonText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 18 },

    // Features
    features: { paddingHorizontal: 30, paddingVertical: 40 },
    sectionTitle: { fontSize: 28, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 40 },
    featureGrid: { gap: 20 },
    featureCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#334155' },
    featureIconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(59, 130, 246, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    featureTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 10 },
    featureDescription: { fontSize: 15, color: '#94a3b8', lineHeight: 22 },

    // Footer
    footer: { paddingHorizontal: 30, paddingTop: 40 },
    divider: { height: 1, backgroundColor: '#334155', marginBottom: 30 },
    companyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(56, 189, 248, 0.1)', borderRadius: 12, borderWidth: 1, borderColor: '#38bdf8', gap: 10 },
    companyLinkText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' }
});
