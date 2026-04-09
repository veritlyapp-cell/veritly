import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Calendar, CheckCircle, ChevronDown, Clock, Sparkles, Star, Upload, ArrowRight, Zap, FileText } from 'lucide-react-native';
import React from 'react';
import { Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

const LocalLogo = require('../assets/images/veritly3.png');
const HeroLaptop = require('../assets/images/b2b_hero_dashboard.png');

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
                            onPress={() => router.push('/empresa/signin')}
                        >
                            <Text style={styles.navButtonSecondaryText}>Iniciar Sesión</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.navButtonPrimary}
                            onPress={() => router.push('/empresa/signin?register=true')}
                        >
                            <LinearGradient
                                colors={[VERITLY_CYAN, VERITLY_BLUE]}
                                style={styles.navButtonPrimaryGradient}
                            >
                                <Text style={styles.navButtonPrimaryText}>Crear cuenta empresa</Text>
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
                                Contrata con Inteligencia{'\n'}
                                <Text style={styles.heroTitleHighlight}>Artificial</Text>
                            </Text>
                            <Text style={[styles.heroSubtitle, { fontSize: isDesktop ? 18 : 16 }]}>
                                Deja de filtrar CVs manualmente. Publica tu vacante y nuestra IA validará cientos de candidatos en segundos, entregándote solo los mejores perfiles rankeados.
                            </Text>

                            <View style={[
                                styles.heroCTAContainer,
                                !isDesktop && { flexDirection: 'row', justifyContent: 'flex-start' }
                            ]}>
                                <TouchableOpacity
                                    style={styles.heroPrimaryButton}
                                    onPress={() => router.push('/empresa/signin?register=true')}
                                >
                                    <LinearGradient
                                        colors={[VERITLY_CYAN, VERITLY_BLUE]}
                                        style={styles.heroPrimaryButtonGradient}
                                    >
                                        <Text style={styles.heroPrimaryButtonText}>Crear cuenta empresa</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.heroSecondaryButton]}
                                    onPress={() => router.push('/empresa/signin')}
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
                                <FileText color="#3498db" size={28} />
                            </View>
                            <Text style={styles.cardTitle}>Carga tus Datos</Text>
                            <Text style={styles.cardDescription}>
                                Sube carpetas de CVs (PDF) o listas en Excel. O si prefieres, publica una vacante para recibirlos.
                            </Text>
                        </View>

                        {/* Card 2 */}
                        <View style={[styles.glassCard, isDesktop && styles.glassCardDesktop]}>
                            <View style={styles.cardIconContainer}>
                                <Sparkles color="#3498db" size={28} />
                            </View>
                            <Text style={styles.cardTitle}>IA Valida y Califica</Text>
                            <Text style={styles.cardDescription}>
                                Nuestra IA analiza el 100% de la información contra tus criterios de búsqueda.
                            </Text>
                        </View>

                        {/* Card 3 */}
                        <View style={[styles.glassCard, isDesktop && styles.glassCardDesktop]}>
                            <View style={styles.cardIconContainer}>
                                <CheckCircle color="#3498db" size={28} />
                            </View>
                            <Text style={styles.cardTitle}>Decide con Rankings</Text>
                            <Text style={styles.cardDescription}>
                                Obtén un ranking inteligente con fortalezas y áreas de mejora por cada perfil.
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ========== MINI ATS / RECRUITER SECTION [NEW] ========== */}
                <View style={[styles.recruiterSection, { paddingHorizontal: isDesktop ? 48 : 20 }]}>
                    <View style={[styles.recruiterContent, isDesktop && { flexDirection: 'row', alignItems: 'center' }]}>
                        <View style={[styles.recruiterLeft, isDesktop && { flex: 1.2 }]}>
                            <View style={styles.miniATSBadge}>
                                <Zap size={14} color="#f59e0b" />
                                <Text style={styles.miniATSBadgeText}>MINI ATS ÁGIL</Text>
                            </View>
                            <Text style={[styles.recruiterTitle, { fontSize: isDesktop ? 42 : 30 }]}>
                                No es una bolsa de trabajo.{'\n'}Es tu <Text style={{ color: '#38bdf8' }}>Aliado de Selección.</Text>
                            </Text>
                            <Text style={styles.recruiterSubtitle}>
                                Veritly no ofrece candidatos al azar. Ayudamos a reclutadores (empresas o independientes) a validar antes de contratar y elegir con datos reales, no con promesas.
                            </Text>

                            <View style={styles.recruiterFeatureList}>
                                <View style={styles.recruiterFeatureItem}>
                                    <View style={styles.featureBullet}><CheckCircle size={16} color="#10b981" /></View>
                                    <Text style={styles.featureText}>Análisis Ágil: Sube tus carpetas de CVs o una lista en Excel y deja que la IA haga el trabajo pesado por ti.</Text>
                                </View>
                                <View style={styles.recruiterFeatureItem}>
                                    <View style={styles.featureBullet}><CheckCircle size={16} color="#10b981" /></View>
                                    <Text style={styles.featureText}>Mini ATS: Gestiona el estado de tus candidatos en un solo lugar, de forma ágil y simple.</Text>
                                </View>
                                <View style={styles.recruiterFeatureItem}>
                                    <View style={styles.featureBullet}><CheckCircle size={16} color="#F59E0B" /></View>
                                    <Text style={styles.featureText}>
                                        <Text style={{ color: '#F59E0B', fontWeight: 'bold' }}>PLUS: </Text>
                                        Publica tu vacante y aplica filtros automáticos de sueldo y Killer Questions. La IA se encargará de <Text style={{ color: 'white', fontWeight: 'bold' }}>analizar y rankear</Text> a quienes logren pasar el filtro inicial.
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.recruiterCTA}
                                onPress={() => router.push('/empresa/signin?register=true')}
                            >
                                <Text style={styles.recruiterCTAText}>Empezar como Reclutador</Text>
                                <ArrowRight size={18} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.recruiterRight, isDesktop && { flex: 1, marginLeft: 40 }]}>
                            <View style={styles.imageGlowContainer}>
                                <View style={styles.glowOrb} />
                                <Image 
                                    source={{ uri: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop' }} 
                                    style={styles.recruiterImage} 
                                    resizeMode="cover" 
                                />
                                <View style={styles.imageOverlay} />
                            </View>
                        </View>
                    </View>
                </View>

                {/* ========== FOR CANDIDATES SECTION ========== */}
                <View style={styles.companySection}>
                    <View style={styles.companyContent}>
                        <View style={styles.companyLeft}>
                            <Text style={styles.companyLabel}>PARA CANDIDATOS</Text>
                            <Text style={styles.companyTitle}>Tu próximo trabajo a un click</Text>
                            <Text style={styles.companyDescription}>
                                Deja de postular a ciegas. Sube tu CV, recibe feedback instantáneo y prepárate para destacar en tu próxima entrevista con ayuda de nuestra Inteligencia Artificial.
                            </Text>

                            <TouchableOpacity
                                style={styles.companyButton}
                                onPress={() => router.push('/signin?register=true')}
                            >
                                <Text style={styles.companyButtonText}>Crear cuenta gratis</Text>
                                <ChevronDown style={{ transform: [{ rotate: '-90deg' }] }} color="white" size={20} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* ========== BOTTOM CTA SECTION ========== */}
                <View style={[styles.bottomCTASection, { paddingHorizontal: isDesktop ? 48 : 20 }]}>
                    <Text style={[styles.bottomCTATitle, { fontSize: isDesktop ? 36 : 28 }]}>¿Listo para empezar?</Text>
                    <Text style={styles.bottomCTASubtitle}>
                        Cientos de empresas ya usan Veritly para encontrar al talento ideal.
                    </Text>

                    <TouchableOpacity
                        style={styles.bottomCTAButton}
                        onPress={() => router.push('/empresa/signin?register=true')}
                    >
                        <LinearGradient
                            colors={[VERITLY_CYAN, VERITLY_BLUE]}
                            style={styles.bottomCTAButtonGradient}
                        >
                            <Text style={styles.bottomCTAButtonText}>Crear cuenta empresa</Text>
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

    // ========== FOR COMPANIES SECTION ==========
    companySection: {
        backgroundColor: '#0f172a',
        paddingVertical: 60,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.1)',
        alignItems: 'center',
    },
    companyContent: {
        maxWidth: 800,
        width: '100%',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 24,
        padding: 40,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.2)',
    },
    companyLeft: {
        alignItems: 'center',
    },
    companyLabel: {
        color: '#38bdf8',
        fontWeight: 'bold',
        fontSize: 14,
        letterSpacing: 1,
        marginBottom: 12,
    },
    companyTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: 'white',
        textAlign: 'center',
        marginBottom: 16,
    },
    companyDescription: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
        maxWidth: 600,
    },
    companyButton: {
        backgroundColor: '#0ea5e9', // Sky 500
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    companyButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
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

    // ========== RECRUITER SECTION [NEW] ==========
    recruiterSection: {
        paddingVertical: 80,
    },
    recruiterContent: {
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        borderRadius: 32,
        padding: 40,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.1)',
        overflow: 'hidden',
    },
    recruiterLeft: {
        flex: 1,
    },
    recruiterRight: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
    },
    miniATSBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    miniATSBadgeText: {
        color: '#f59e0b',
        fontWeight: 'bold',
        fontSize: 11,
    },
    recruiterTitle: {
        color: 'white',
        fontWeight: '900',
        lineHeight: 48,
        marginBottom: 20,
    },
    recruiterSubtitle: {
        color: '#94a3b8',
        fontSize: 17,
        lineHeight: 28,
        marginBottom: 32,
    },
    recruiterFeatureList: {
        gap: 16,
        marginBottom: 36,
    },
    recruiterFeatureItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    featureBullet: {
        marginTop: 4,
    },
    featureText: {
        color: '#cbd5e1',
        fontSize: 15,
        lineHeight: 22,
        flex: 1,
    },
    recruiterCTA: {
        backgroundColor: '#3b82f6',
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 10,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    recruiterCTAText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    imageGlowContainer: {
        position: 'relative',
        width: '100%',
        height: 300,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.2)',
    },
    recruiterImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
    },
    glowOrb: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#38bdf8',
        opacity: 0.2,
        filter: 'blur(40px)',
    },
});