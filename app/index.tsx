import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Calendar, CheckCircle, ChevronDown, Clock, Sparkles, Star, Upload } from 'lucide-react-native';
import React from 'react';
import { Image, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const LocalLogo = require('../assets/images/veritly3.png');
const HeroLaptop = require('../assets/images/hero_laptop_veritly.png');

// Veritly brand colors
const VERITLY_CYAN = '#38bdf8';
const VERITLY_BLUE = '#6366f1';

export default function VeritlyLandingPage() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a192f" />

            {/* Deep Space Background */}
            <LinearGradient
                colors={['#0a192f', '#050d1a', '#000000']}
                style={StyleSheet.absoluteFill}
            />

            {/* Starfield Overlay Pattern */}
            <View style={styles.starfieldOverlay} />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={true}>

                {/* ========== NAVBAR ========== */}
                <View style={styles.navbar}>
                    <View style={styles.navLeft}>
                        <Image source={LocalLogo} style={styles.navLogoImage} resizeMode="contain" />
                        <Text style={styles.navBrand}>Veritly</Text>
                    </View>

                    {/* Nav links hidden for now
                    <View style={styles.navCenter}>
                        <TouchableOpacity style={styles.navLink}>
                            <Text style={styles.navLinkText}>Cómo Funciona</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navLink}>
                            <Text style={styles.navLinkText}>Precios</Text>
                        </TouchableOpacity>
                    </View>
                    */}

                    <View style={styles.navRight}>
                        <TouchableOpacity
                            style={styles.navButtonSecondary}
                            onPress={() => router.push('/signin')}
                        >
                            <Text style={styles.navButtonSecondaryText}>Iniciar Sesión</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.navButtonPrimary}
                            onPress={() => router.push('/signin?register=true')}
                        >
                            <LinearGradient
                                colors={[VERITLY_CYAN, VERITLY_BLUE]}
                                style={styles.navButtonPrimaryGradient}
                            >
                                <Text style={styles.navButtonPrimaryText}>Crear cuenta gratis</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ========== HERO SECTION ========== */}
                <View style={styles.heroSection}>
                    <View style={styles.heroContent}>
                        {/* Left Side - Text */}
                        <View style={styles.heroLeft}>
                            <Text style={styles.heroTitle}>
                                Tu próximo trabajo{'\n'}está a un{' '}
                                <Text style={styles.heroTitleHighlight}>click</Text>
                            </Text>
                            <Text style={styles.heroSubtitle}>
                                Deja de postular a ciegas. Sube tu CV, nosotros lo analizamos y prepárate para esa entrevista ideal.
                            </Text>

                            <View style={styles.heroCTAContainer}>
                                <TouchableOpacity
                                    style={styles.heroPrimaryButton}
                                    onPress={() => router.push('/signin?register=true')}
                                >
                                    <LinearGradient
                                        colors={[VERITLY_CYAN, VERITLY_BLUE]}
                                        style={styles.heroPrimaryButtonGradient}
                                    >
                                        <Text style={styles.heroPrimaryButtonText}>Crear cuenta gratis</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.heroSecondaryButton}
                                    onPress={() => router.push('/signin')}
                                >
                                    <Text style={styles.heroSecondaryButtonText}>Iniciar Sesión</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Right Side - Laptop Visual */}
                        <View style={styles.heroRight}>
                            <View style={styles.laptopGlow} />
                            <Image source={HeroLaptop} style={styles.heroLaptopImage} resizeMode="contain" />
                        </View>
                    </View>

                    {/* Stats Bar */}
                    <View style={styles.statsBar}>
                        <View style={styles.statItem}>
                            <View style={styles.statIconWrapper}>
                                <Sparkles color={VERITLY_CYAN} size={18} />
                            </View>
                            <View>
                                <Text style={styles.statValue}>97%</Text>
                                <Text style={styles.statLabel}>Precisión IA</Text>
                            </View>
                        </View>

                        <View style={styles.statDivider} />

                        <View style={styles.statItem}>
                            <View style={styles.statIconWrapper}>
                                <Clock color="#3498db" size={18} />
                            </View>
                            <View>
                                <Text style={styles.statValue}>2min</Text>
                                <Text style={styles.statLabel}>Tiempo prom</Text>
                            </View>
                        </View>

                        <View style={styles.statDivider} />

                        <View style={styles.statItem}>
                            <View style={styles.statIconWrapper}>
                                <Calendar color="#3498db" size={18} />
                            </View>
                            <View>
                                <Text style={styles.statValue}>24/7</Text>
                                <Text style={styles.statLabel}>Disponible</Text>
                            </View>
                        </View>
                    </View>

                    {/* Scroll Indicator */}
                    <View style={styles.scrollIndicator}>
                        <View style={styles.scrollButton}>
                            <ChevronDown color={VERITLY_CYAN} size={28} />
                        </View>
                        <Text style={styles.scrollText}>Descubre más</Text>
                    </View>
                </View>

                {/* ========== CÓMO FUNCIONA SECTION ========== */}
                <View style={styles.howItWorksSection}>
                    <Text style={styles.sectionTitle}>
                        <Text style={styles.sectionTitleBold}>Cómo Funciona </Text>
                        <Text style={styles.sectionTitleAccent}>(es súper simple)</Text>
                    </Text>

                    <View style={styles.featureGrid}>
                        {/* Card 1 */}
                        <View style={styles.glassCard}>
                            <View style={styles.cardIconContainer}>
                                <Upload color="#3498db" size={28} />
                            </View>
                            <Text style={styles.cardTitle}>Sube tu CV</Text>
                            <Text style={styles.cardDescription}>
                                Cárgalo y nosotros lo analizamos contra cientos de ofertas.
                            </Text>
                        </View>

                        {/* Card 2 */}
                        <View style={styles.glassCard}>
                            <View style={styles.cardIconContainer}>
                                <Star color="#3498db" size={28} />
                            </View>
                            <Text style={styles.cardTitle}>Recibe Feedback Personalizado</Text>
                            <Text style={styles.cardDescription}>
                                Te mostramos tu % de match y qué mejorar en tu CV para esa posición.
                            </Text>
                        </View>

                        {/* Card 3 */}
                        <View style={styles.glassCard}>
                            <View style={styles.cardIconContainer}>
                                <CheckCircle color="#3498db" size={28} />
                            </View>
                            <Text style={styles.cardTitle}>Prepárate para la Entrevista</Text>
                            <Text style={styles.cardDescription}>
                                Te damos las preguntas clave y consejos para destacar.
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ========== BOTTOM CTA SECTION ========== */}
                <View style={styles.bottomCTASection}>
                    <Text style={styles.bottomCTATitle}>¿Listo para empezar?</Text>
                    <Text style={styles.bottomCTASubtitle}>
                        Miles de personas ya usan Veritly para destacar en sus postulaciones.
                    </Text>

                    <TouchableOpacity
                        style={styles.bottomCTAButton}
                        onPress={() => router.push('/signin?register=true')}
                    >
                        <LinearGradient
                            colors={[VERITLY_CYAN, VERITLY_BLUE]}
                            style={styles.bottomCTAButtonGradient}
                        >
                            <Text style={styles.bottomCTAButtonText}>Crear cuenta gratis</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* ========== FOOTER ========== */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>© 2025 Veritly. Todos los derechos reservados.</Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a192f',
    },
    content: {
        paddingBottom: 40,
    },
    starfieldOverlay: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.3,
        // Simulated starfield with subtle dots would be ideal via SVG/Canvas on web
    },

    // ========== NAVBAR ==========
    navbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        flexWrap: 'wrap',
        gap: 12,
    },
    navLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    navLogoImage: {
        width: 36,
        height: 36,
    },
    navBrand: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    navCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
        display: Platform.OS === 'web' ? 'flex' : 'none',
    },
    navLink: {
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    navLinkText: {
        fontSize: 15,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.75)',
    },
    navRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    navButtonSecondary: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    navButtonSecondaryText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    navButtonPrimary: {
        borderRadius: 10,
        overflow: 'hidden',
        shadowColor: VERITLY_CYAN,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    navButtonPrimaryGradient: {
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    navButtonPrimaryText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // ========== HERO SECTION ==========
    heroSection: {
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 40,
    },
    heroContent: {
        flexDirection: 'column',
        gap: 40,
        marginBottom: 48,
        ...(Platform.OS === 'web' && {
            flexDirection: 'row',
            alignItems: 'center',
        }),
    },
    heroLeft: {
        flex: 1,
        maxWidth: Platform.OS === 'web' ? 560 : '100%',
    },
    heroTitle: {
        fontSize: Platform.OS === 'web' ? 52 : 38,
        fontWeight: '900',
        color: '#FFFFFF',
        lineHeight: Platform.OS === 'web' ? 64 : 48,
        letterSpacing: -1.5,
        marginBottom: 20,
    },
    heroTitleHighlight: {
        color: VERITLY_CYAN,
    },
    heroSubtitle: {
        fontSize: 18,
        fontWeight: '400',
        color: '#b0b0b0',
        lineHeight: 28,
        marginBottom: 32,
    },
    heroCTAContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
    },
    heroPrimaryButton: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: VERITLY_CYAN,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
    heroPrimaryButtonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 32,
    },
    heroPrimaryButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    heroSecondaryButton: {
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    heroSecondaryButtonText: {
        fontSize: 17,
        fontWeight: '600',
        color: VERITLY_CYAN,
    },
    heroRight: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    laptopGlow: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: VERITLY_CYAN,
        opacity: 0.12,
        ...(Platform.OS === 'web' && {
            filter: 'blur(60px)',
        }),
    },
    heroLaptopImage: {
        width: '100%',
        height: Platform.OS === 'web' ? 400 : 280,
        maxWidth: 500,
    },

    // ========== STATS BAR ==========
    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        gap: 20,
        flexWrap: 'wrap',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: 13,
        fontWeight: '400',
        color: '#b0b0b0',
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },

    // ========== HOW IT WORKS SECTION ==========
    howItWorksSection: {
        paddingHorizontal: 24,
        paddingVertical: 60,
    },
    sectionTitle: {
        fontSize: 32,
        textAlign: 'center',
        marginBottom: 48,
    },
    sectionTitleBold: {
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    sectionTitleAccent: {
        fontWeight: '400',
        color: VERITLY_CYAN,
    },

    // ========== SCROLL INDICATOR ==========
    scrollIndicator: {
        alignItems: 'center',
        marginTop: 48,
        marginBottom: 20,
        gap: 12,
    },
    scrollButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 2,
        borderColor: 'rgba(56, 189, 248, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
    },
    featureGrid: {
        flexDirection: 'column',
        gap: 20,
        ...(Platform.OS === 'web' && {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
        }),
    },
    glassCard: {
        flex: 1,
        minWidth: Platform.OS === 'web' ? 280 : '100%',
        maxWidth: Platform.OS === 'web' ? 340 : '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 28,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        ...(Platform.OS === 'web' && {
            backdropFilter: 'blur(20px)',
        }),
    },
    cardIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: 'rgba(52, 152, 219, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.3,
    },
    cardDescription: {
        fontSize: 15,
        fontWeight: '400',
        color: '#b0b0b0',
        textAlign: 'center',
        lineHeight: 24,
    },

    // ========== BOTTOM CTA SECTION ==========
    bottomCTASection: {
        paddingHorizontal: 24,
        paddingVertical: 60,
        alignItems: 'center',
    },
    bottomCTATitle: {
        fontSize: 36,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    bottomCTASubtitle: {
        fontSize: 17,
        fontWeight: '400',
        color: '#b0b0b0',
        textAlign: 'center',
        marginBottom: 32,
        maxWidth: 480,
    },
    bottomCTAButton: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: VERITLY_CYAN,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 12,
    },
    bottomCTAButtonGradient: {
        paddingVertical: 18,
        paddingHorizontal: 40,
    },
    bottomCTAButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },

    // ========== FOOTER ==========
    footer: {
        paddingHorizontal: 24,
        paddingVertical: 40,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
        fontWeight: '400',
        color: '#b0b0b0',
        textAlign: 'center',
    },
});