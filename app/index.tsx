import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Calendar, CheckCircle, ChevronDown, Clock, Sparkles, Star, Upload } from 'lucide-react-native';
import React from 'react';
import { Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

const LocalLogo = require('../assets/images/veritly3.png');
const HeroLaptop = require('../assets/images/hero_laptop_veritly.png');

// Veritly brand colors
const VERITLY_CYAN = '#38bdf8';
const VERITLY_BLUE = '#6366f1';

export default function VeritlyLandingPage() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

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
                <View style={[styles.heroSection, { paddingHorizontal: isDesktop ? 48 : 20 }]}>
                    <View style={[
                        styles.heroContent,
                        isDesktop ? styles.heroContentDesktop : styles.heroContentMobile
                    ]}>
                        {/* Text Content */}
                        <View style={[styles.heroLeft, isDesktop && { maxWidth: 560 }]}>
                            <Text style={[
                                styles.heroTitle,
                                { fontSize: isDesktop ? 48 : 32, lineHeight: isDesktop ? 58 : 40 }
                            ]}>
                                Tu próximo trabajo{'\n'}está a un{' '}
                                <Text style={styles.heroTitleHighlight}>click</Text>
                            </Text>
                            <Text style={[styles.heroSubtitle, { fontSize: isDesktop ? 18 : 16 }]}>
                                Deja de postular a ciegas. Sube tu CV, nosotros lo analizamos y prepárate para esa entrevista ideal.
                            </Text>

                            <View style={[
                                styles.heroCTAContainer,
                                !isDesktop && { flexDirection: 'column', alignItems: 'stretch' }
                            ]}>
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
                                    style={[styles.heroSecondaryButton, !isDesktop && { alignSelf: 'center' }]}
                                    onPress={() => router.push('/signin')}
                                >
                                    <Text style={styles.heroSecondaryButtonText}>Iniciar Sesión</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Laptop Visual */}
                        <View style={[styles.heroRight, !isDesktop && { marginTop: 32 }]}>
                            <View style={styles.laptopGlow} />
                            <Image
                                source={HeroLaptop}
                                style={[
                                    styles.heroLaptopImage,
                                    { height: isDesktop ? 360 : 200, maxWidth: isDesktop ? 480 : 300 }
                                ]}
                                resizeMode="contain"
                            />
                        </View>
                    </View>

                    {/* Stats Bar */}
                    <View style={[styles.statsBar, !isDesktop && styles.statsBarMobile]}>
                        <View style={styles.statItem}>
                            <View style={styles.statIconWrapper}>
                                <Sparkles color={VERITLY_CYAN} size={16} />
                            </View>
                            <View>
                                <Text style={styles.statValue}>97%</Text>
                                <Text style={styles.statLabel}>Precisión IA</Text>
                            </View>
                        </View>

                        <View style={[styles.statDivider, !isDesktop && { display: 'none' }]} />

                        <View style={styles.statItem}>
                            <View style={styles.statIconWrapper}>
                                <Clock color="#3498db" size={16} />
                            </View>
                            <View>
                                <Text style={styles.statValue}>2min</Text>
                                <Text style={styles.statLabel}>Tiempo prom</Text>
                            </View>
                        </View>

                        <View style={[styles.statDivider, !isDesktop && { display: 'none' }]} />

                        <View style={styles.statItem}>
                            <View style={styles.statIconWrapper}>
                                <Calendar color="#3498db" size={16} />
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
                            <ChevronDown color={VERITLY_CYAN} size={24} />
                        </View>
                        <Text style={styles.scrollText}>Descubre más</Text>
                    </View>
                </View>

                {/* ========== CÓMO FUNCIONA SECTION ========== */}
                <View style={[styles.howItWorksSection, { paddingHorizontal: isDesktop ? 48 : 20 }]}>
                    <Text style={styles.sectionTitle}>
                        <Text style={styles.sectionTitleBold}>Cómo Funciona </Text>
                        <Text style={styles.sectionTitleAccent}>(es súper simple)</Text>
                    </Text>

                    <View style={[styles.featureGrid, isDesktop && styles.featureGridDesktop]}>
                        {/* Card 1 */}
                        <View style={[styles.glassCard, isDesktop && styles.glassCardDesktop]}>
                            <View style={styles.cardIconContainer}>
                                <Upload color="#3498db" size={28} />
                            </View>
                            <Text style={styles.cardTitle}>Sube tu CV</Text>
                            <Text style={styles.cardDescription}>
                                Cárgalo y nosotros lo analizamos contra cientos de ofertas.
                            </Text>
                        </View>

                        {/* Card 2 */}
                        <View style={[styles.glassCard, isDesktop && styles.glassCardDesktop]}>
                            <View style={styles.cardIconContainer}>
                                <Star color="#3498db" size={28} />
                            </View>
                            <Text style={styles.cardTitle}>Recibe Feedback Personalizado</Text>
                            <Text style={styles.cardDescription}>
                                Te mostramos tu % de match y qué mejorar en tu CV para esa posición.
                            </Text>
                        </View>

                        {/* Card 3 */}
                        <View style={[styles.glassCard, isDesktop && styles.glassCardDesktop]}>
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
                <View style={[styles.bottomCTASection, { paddingHorizontal: isDesktop ? 48 : 20 }]}>
                    <Text style={[styles.bottomCTATitle, { fontSize: isDesktop ? 36 : 28 }]}>¿Listo para empezar?</Text>
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
    },

    // ========== NAVBAR ==========
    navbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        flexWrap: 'wrap',
        gap: 8,
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
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    navRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    navButtonSecondary: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    navButtonSecondaryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    navButtonPrimary: {
        borderRadius: 8,
        overflow: 'hidden',
        shadowColor: VERITLY_CYAN,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    navButtonPrimaryGradient: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    navButtonPrimaryText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // ========== HERO SECTION ==========
    heroSection: {
        paddingTop: 40,
        paddingBottom: 32,
    },
    heroContent: {
        marginBottom: 32,
    },
    heroContentDesktop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 48,
    },
    heroContentMobile: {
        flexDirection: 'column',
    },
    heroLeft: {
        flex: 1,
    },
    heroTitle: {
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -1,
        marginBottom: 16,
    },
    heroTitleHighlight: {
        color: VERITLY_CYAN,
    },
    heroSubtitle: {
        fontWeight: '400',
        color: '#b0b0b0',
        lineHeight: 26,
        marginBottom: 24,
    },
    heroCTAContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    heroPrimaryButton: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: VERITLY_CYAN,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    heroPrimaryButtonGradient: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        alignItems: 'center',
    },
    heroPrimaryButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    heroSecondaryButton: {
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    heroSecondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: VERITLY_CYAN,
    },
    heroRight: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    laptopGlow: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: VERITLY_CYAN,
        opacity: 0.1,
    },
    heroLaptopImage: {
        width: '100%',
    },

    // ========== STATS BAR ==========
    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        gap: 24,
    },
    statsBarMobile: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        gap: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '400',
        color: '#b0b0b0',
    },
    statDivider: {
        width: 1,
        height: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },

    // ========== SCROLL INDICATOR ==========
    scrollIndicator: {
        alignItems: 'center',
        marginTop: 32,
        gap: 8,
    },
    scrollButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollText: {
        fontSize: 12,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.5)',
    },

    // ========== HOW IT WORKS SECTION ==========
    howItWorksSection: {
        paddingVertical: 48,
    },
    sectionTitle: {
        fontSize: 28,
        textAlign: 'center',
        marginBottom: 36,
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
    featureGrid: {
        flexDirection: 'column',
        gap: 16,
    },
    featureGridDesktop: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 24,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    glassCardDesktop: {
        flex: 1,
        maxWidth: 320,
    },
    cardIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 14,
        backgroundColor: 'rgba(52, 152, 219, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 10,
    },
    cardDescription: {
        fontSize: 14,
        fontWeight: '400',
        color: '#b0b0b0',
        textAlign: 'center',
        lineHeight: 22,
    },

    // ========== BOTTOM CTA SECTION ==========
    bottomCTASection: {
        paddingVertical: 48,
        alignItems: 'center',
    },
    bottomCTATitle: {
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    bottomCTASubtitle: {
        fontSize: 16,
        fontWeight: '400',
        color: '#b0b0b0',
        textAlign: 'center',
        marginBottom: 28,
        maxWidth: 400,
        paddingHorizontal: 20,
    },
    bottomCTAButton: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: VERITLY_CYAN,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    bottomCTAButtonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 36,
    },
    bottomCTAButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // ========== FOOTER ==========
    footer: {
        paddingHorizontal: 20,
        paddingVertical: 32,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 13,
        fontWeight: '400',
        color: '#b0b0b0',
        textAlign: 'center',
    },
});