import { useRouter } from 'expo-router';
import { Briefcase, Calendar, CheckCircle, ChevronDown, ChevronRight, Clock, MapPin, Sparkles, Star, Users, Zap, FileText } from 'lucide-react-native';
import React from 'react';
import { Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, Platform, Linking } from 'react-native';

const LocalLogo = require('../assets/images/veritly3.png');
const HeroLaptop = require('../assets/images/b2b_hero_dashboard.png');

// Light Tech Theme Colors
const COLORS = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceAlt: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  primary: '#4F46E5', // Indigo/Violet
  primaryHover: '#4338CA',
  accent: '#06B6D4', // Cyan
  border: '#E5E7EB',
  white: '#FFFFFF',
};

export default function VeritlyLandingPage() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* ========== NAVBAR ========== */}
                <View style={styles.navbar}>
                    <View style={styles.navLeft}>
                        {/* If the old logo is white, we might need to apply a tintColor, or keep it dark */}
                        <Image 
                            source={LocalLogo} 
                            style={[styles.navLogoImage, { tintColor: COLORS.primary }]} 
                            resizeMode="contain" 
                        />
                        <Text style={styles.navBrand}>Veritly</Text>
                    </View>

                    <View style={styles.navRight}>
                        <TouchableOpacity
                            style={styles.navButtonSecondary}
                            onPress={() => router.push('/empresa/signin')}
                        >
                            <Text style={styles.navButtonSecondaryText}>Iniciar Sesión</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.navButtonPrimary}
                            onPress={() => router.push('/empresa/signin?register=true')}
                        >
                            <Text style={styles.navButtonPrimaryText}>Prueba Veritly Gratis</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ========== HERO SECTION ========== */}
                <View style={[styles.heroSection, { paddingHorizontal: isDesktop ? 64 : 24 }]}>
                    <View style={[
                        styles.heroContent,
                        isDesktop ? styles.heroContentDesktop : styles.heroContentMobile
                    ]}>
                        {/* Text Content */}
                        <View style={[styles.heroLeft, isDesktop && { maxWidth: 600 }]}>
                            <View style={styles.trustBadge}>
                                <Sparkles size={14} color={COLORS.primary} />
                                <Text style={styles.trustBadgeText}>Plataforma de Selección Científica</Text>
                            </View>                            

                            <Text style={[
                                styles.heroTitle,
                                { fontSize: isDesktop ? 52 : 36, lineHeight: isDesktop ? 62 : 44 }
                            ]}>
                                Encuentra al candidato ideal, sin el sesgo del filtrado manual.
                            </Text>
                            <Text style={[styles.heroSubtitle, { fontSize: isDesktop ? 18 : 16 }]}>
                                Validación automatizada por competencias y criterios de selección científica, no solo palabras clave. Recluta más rápido y con mayor precisión.
                            </Text>

                            <View style={[
                                styles.heroCTAContainer,
                                !isDesktop && { flexDirection: 'column', alignItems: 'flex-start' }
                            ]}>
                                <TouchableOpacity
                                    style={styles.heroPrimaryButton}
                                    onPress={() => router.push('/empresa/signin?register=true')}
                                >
                                    <Text style={styles.heroPrimaryButtonText}>Prueba Veritly Gratis</Text>
                                    <ChevronRight size={18} color={COLORS.white} />
                                </TouchableOpacity>

                                <Text style={styles.heroSubText}>Sin tarjeta de crédito. Configuración en 2 min.</Text>
                            </View>
                        </View>

                        {/* Visual / Image */}
                        <View style={[styles.heroRight, !isDesktop && { marginTop: 40 }]}>
                            <View style={styles.heroImageContainer}>
                                <Image
                                    source={HeroLaptop}
                                    style={[
                                        styles.heroLaptopImage,
                                        { height: isDesktop ? 400 : 250, width: isDesktop ? 600 : 350 }
                                    ]}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* ========== SOCIAL PROOF / TRUST BAR ========== */}
                <View style={styles.socialProofSection}>
                    <Text style={styles.socialProofTitle}>Empresas que confían en nuestra IA supervisada</Text>
                    <View style={styles.logosContainer}>
                        {/* Planners for Logos in Grayscale */}
                        <Text style={styles.placeholderLogo}>Gilat</Text>
                        <Text style={styles.placeholderLogo}>Relié Labs</Text>
                        <Text style={styles.placeholderLogo}>Acme Corp</Text>
                        <Text style={styles.placeholderLogo}>GlobalTech</Text>
                    </View>
                </View>

                {/* ========== CÓMO FUNCIONA SECTION ========== */}
                <View style={[styles.howItWorksSection, { paddingHorizontal: isDesktop ? 64 : 24 }]}>
                    <Text style={styles.sectionTitle}>
                        ¿Cómo funciona Veritly?
                    </Text>
                    <Text style={styles.sectionSubtitle}>
                        Un flujo de trabajo optimizado para que te enfoques en las personas, no en el papeleo.
                    </Text>

                    <View style={[styles.featureGrid, isDesktop && styles.featureGridDesktop]}>
                        {/* Card 1 */}
                        <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
                            <View style={styles.cardIconBox}>
                                <FileText color={COLORS.primary} size={28} />
                            </View>
                            <Text style={styles.cardTitle}>1. Publica</Text>
                            <Text style={styles.cardDescription}>
                                Sube tu oferta laboral o tus bases de candidatos actuales. Aceptamos CVs en PDF o listas masivas en Excel.
                            </Text>
                        </View>

                        {/* Card 2 */}
                        <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
                            <View style={styles.cardIconBox}>
                                <Zap color={COLORS.primary} size={28} />
                            </View>
                            <Text style={styles.cardTitle}>2. Filtra</Text>
                            <Text style={styles.cardDescription}>
                                La IA evalúa y rankea los perfiles bajo criterios de competencia y compatibilidad técnica de manera centralizada.
                            </Text>
                        </View>

                        {/* Card 3 */}
                        <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
                            <View style={styles.cardIconBox}>
                                <Users color={COLORS.primary} size={28} />
                            </View>
                            <Text style={styles.cardTitle}>3. Entrevista</Text>
                            <Text style={styles.cardDescription}>
                                Revisa el ranking, los resúmenes generados y enfoca tu tiempo entrevistando solo a los finalistas validados.
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ========== FOR CANDIDATES SECTION ========== */}
                <View style={styles.candidateSection}>
                    <View style={[styles.candidateContent, { paddingHorizontal: isDesktop ? 64 : 24, flexDirection: isDesktop ? 'row' : 'column' }]}>
                        <View style={[styles.candidateLeft, isDesktop && { flex: 1, paddingRight: 40 }]}>
                            <Text style={styles.candidateLabel}>PARA CANDIDATOS</Text>
                            <Text style={styles.candidateTitle}>Muestra tu verdadero potencial</Text>
                            <Text style={styles.candidateDescription}>
                                Deja que tus habilidades hablen por ti. Con Veritly, tu perfil es analizado objetivamente. Sube tu CV para que nuestra tecnología destaque tus puntos más fuertes ante los reclutadores.
                            </Text>
                            <TouchableOpacity
                                style={styles.candidateButton}
                                onPress={() => router.push('/signin')}
                            >
                                <Text style={styles.candidateButtonText}>Subir mi CV</Text>
                            </TouchableOpacity>
                        </View>
                        {isDesktop && <View style={{ flex: 1 }} />}
                    </View>
                </View>

                {/* ========== BOTTOM CTA ========== */}
                <View style={styles.bottomCTASection}>
                    <Text style={styles.bottomCTATitle}>Transforma hoy tu proceso de selección</Text>
                    <Text style={styles.bottomCTASubtitle}>Acompaña a las empresas que ya reducen sus tiempos de contratación en un 60%.</Text>
                    <TouchableOpacity
                        style={styles.heroPrimaryButton}
                        onPress={() => router.push('/empresa/signin?register=true')}
                    >
                        <Text style={styles.heroPrimaryButtonText}>Comenzar Prueba Gratis</Text>
                    </TouchableOpacity>
                </View>

                {/* ========== FOOTER ========== */}
                <View style={styles.footer}>
                    <View style={styles.footerContent}>
                        <View style={styles.footerBrand}>
                            <Image source={LocalLogo} style={[styles.navLogoImage, { tintColor: COLORS.textTertiary, marginBottom: 8 }]} resizeMode="contain" />
                            <Text style={styles.footerBrandText}>Veritly</Text>
                        </View>
                        <Text style={styles.footerCopyright}>© {new Date().getFullYear()} Veritly. Reclutamiento con ciencia.</Text>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        backgroundColor: COLORS.background,
    },

    // ========== NAVBAR ==========
    navbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.surfaceAlt,
        backgroundColor: COLORS.white,
    },
    navLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    navLogoImage: {
        width: 32,
        height: 32,
    },
    navBrand: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    navRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    navButtonSecondary: {
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    navButtonSecondaryText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    navButtonPrimary: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 2,
    },
    navButtonPrimaryText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.white,
    },

    // ========== HERO ==========
    heroSection: {
        paddingTop: 60,
        paddingBottom: 60,
        backgroundColor: COLORS.background,
    },
    heroContent: {
        justifyContent: 'space-between',
    },
    heroContentDesktop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroContentMobile: {
        flexDirection: 'column',
    },
    heroLeft: {
        flex: 1,
    },
    trustBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 24,
    },
    trustBadgeText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 13,
    },
    heroTitle: {
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -1,
        marginBottom: 24,
    },
    heroSubtitle: {
        fontWeight: '400',
        color: COLORS.textSecondary,
        lineHeight: 28,
        marginBottom: 36,
    },
    heroCTAContainer: {
        gap: 16,
    },
    heroPrimaryButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 4,
    },
    heroPrimaryButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.white,
    },
    heroSubText: {
        color: COLORS.textTertiary,
        fontSize: 13,
    },
    heroRight: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroImageContainer: {
        shadowColor: COLORS.textPrimary,
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.08,
        shadowRadius: 40,
        elevation: 10,
    },
    heroLaptopImage: {
    },

    // ========== SOCIAL PROOF ==========
    socialProofSection: {
        backgroundColor: COLORS.surfaceAlt,
        paddingVertical: 32,
        alignItems: 'center',
    },
    socialProofTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 24,
    },
    logosContainer: {
        flexDirection: 'row',
        gap: 48,
        flexWrap: 'wrap',
        justifyContent: 'center',
        opacity: 0.5,
    },
    placeholderLogo: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textSecondary,
    },

    // ========== HOW IT WORKS ==========
    howItWorksSection: {
        paddingVertical: 80,
        backgroundColor: COLORS.background,
    },
    sectionTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    sectionSubtitle: {
        fontSize: 18,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 56,
        maxWidth: 600,
        alignSelf: 'center',
    },
    featureGrid: {
        flexDirection: 'column',
        gap: 24,
    },
    featureGridDesktop: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    featureCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 32,
        borderWidth: 1,
        borderColor: COLORS.surfaceAlt,
        alignItems: 'flex-start',
        shadowColor: COLORS.textPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    featureCardDesktop: {
        flex: 1,
        maxWidth: 380,
    },
    cardIconBox: {
        width: 56,
        height: 56,
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 12,
    },
    cardDescription: {
        fontSize: 15,
        fontWeight: '400',
        color: COLORS.textSecondary,
        lineHeight: 24,
    },

    // ========== FOR CANDIDATES ==========
    candidateSection: {
        backgroundColor: COLORS.surface,
        paddingVertical: 80,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.surfaceAlt,
    },
    candidateContent: {
        maxWidth: 1200,
        marginHorizontal: 'auto',
        width: '100%',
    },
    candidateLeft: {
    },
    candidateLabel: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 1.2,
        marginBottom: 16,
    },
    candidateTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 20,
        letterSpacing: -0.5,
    },
    candidateDescription: {
        fontSize: 16,
        color: COLORS.textSecondary,
        lineHeight: 26,
        marginBottom: 32,
        maxWidth: 500,
    },
    candidateButton: {
        backgroundColor: COLORS.white,
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.textPrimary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    candidateButtonText: {
        color: COLORS.textPrimary,
        fontWeight: '600',
        fontSize: 15,
    },

    // ========== BOTTOM CTA ==========
    bottomCTASection: {
        paddingVertical: 80,
        paddingHorizontal: 24,
        alignItems: 'center',
        backgroundColor: COLORS.white,
    },
    bottomCTATitle: {
        fontSize: 36,
        fontWeight: '800',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    bottomCTASubtitle: {
        fontSize: 18,
        fontWeight: '400',
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 40,
        maxWidth: 600,
    },

    // ========== FOOTER ==========
    footer: {
        backgroundColor: COLORS.surface,
        paddingVertical: 40,
        paddingHorizontal: 24,
        borderTopWidth: 1,
        borderColor: COLORS.surfaceAlt,
    },
    footerContent: {
        alignItems: 'center',
    },
    footerBrand: {
        alignItems: 'center',
        marginBottom: 16,
    },
    footerBrandText: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textSecondary,
    },
    footerCopyright: {
        fontSize: 14,
        color: COLORS.textTertiary,
    },
});