import { useRouter } from 'expo-router';
import { Briefcase, Calendar, CheckCircle, ChevronDown, ChevronRight, Clock, MapPin, Sparkles, Users, Zap, FileText } from 'lucide-react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import React, { useRef, useState, useEffect } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, Platform, Linking, LayoutChangeEvent } from 'react-native';

const LocalLogo = require('../assets/images/veritly3.png');
const HeroLaptop = require('../assets/images/b2b_hero_dashboard.png');

// Precios base en config_plans están en Soles (PEN); detectamos el país del
// visitante y convertimos con el tipo de cambio para mostrar su moneda local.
const CURRENCY_MAP: Record<string, { currency: string; symbol: string }> = {
    PE: { currency: 'PEN', symbol: 'S/' },
    CO: { currency: 'COP', symbol: '$' },
    EC: { currency: 'USD', symbol: '$' },
    BO: { currency: 'BOB', symbol: 'Bs' },
    CL: { currency: 'CLP', symbol: '$' },
    PY: { currency: 'PYG', symbol: '₲' },
    MX: { currency: 'MXN', symbol: '$' },
    AR: { currency: 'ARS', symbol: '$' },
};

const formatCurrencyValue = (val: number, currency: string) => {
    if (currency === 'PEN') return val.toString();
    if (currency === 'USD') return val % 1 === 0 ? val.toFixed(0) : val.toFixed(2);
    const rounded = Math.round(val);
    try {
        return rounded.toLocaleString('es-ES');
    } catch (e) {
        return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
};

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

    const [systemPlans, setSystemPlans] = useState<any[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [locationInfo, setLocationInfo] = useState({ country: 'PE', currency: 'PEN', symbol: 'S/' });
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
        USD: 0.27,
        COP: 1100,
        CLP: 250,
        BOB: 1.85,
        PYG: 2000,
        MXN: 4.9,
        ARS: 260,
        PEN: 1.0,
    });

    const scrollRef = useRef<ScrollView>(null);
    const [sectionPositions, setSectionPositions] = useState({
        howItWorks: 0,
        pricing: 0
    });

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const plansSnap = await getDocs(collection(db, 'config_plans'));
                const plansData = plansSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as any))
                    .filter((p: any) => !p.isHidden);
                plansData.sort((a, b) => (a.priceMonthly || 0) - (b.priceMonthly || 0));
                setSystemPlans(plansData);
            } catch (e) {
                console.error("Error fetching plans:", e);
            } finally {
                setPlansLoading(false);
            }
        };
        fetchPlans();

        const detectLocation = async () => {
            try {
                const response = await fetch('https://ipapi.co/json/');
                const data = await response.json();
                const country = data.country_code || 'PE';
                const mapping = CURRENCY_MAP[country] || { currency: 'USD', symbol: '$' };
                setLocationInfo({ country, currency: mapping.currency, symbol: mapping.symbol });
            } catch (error) {
                console.error("Error detectando ubicación:", error);
                setLocationInfo({ country: 'PE', currency: 'PEN', symbol: 'S/' });
            }
        };
        detectLocation();

        const fetchExchangeRates = async () => {
            try {
                const response = await fetch('https://open.er-api.com/v6/latest/PEN');
                const data = await response.json();
                if (data && data.result === 'success' && data.rates) {
                    setExchangeRates(prev => ({ ...prev, ...data.rates }));
                }
            } catch (e) {
                console.error("Error fetching exchange rates:", e);
            }
        };
        fetchExchangeRates();
    }, []);

    const getDisplayPrice = (priceInSoles: number) => {
        let displayPrice = priceInSoles;
        if (locationInfo.currency !== 'PEN') {
            const rate = exchangeRates[locationInfo.currency] || (locationInfo.currency === 'USD' ? 0.27 : 1.0);
            displayPrice = priceInSoles * rate;
        }
        return `${locationInfo.symbol} ${formatCurrencyValue(displayPrice, locationInfo.currency)}`;
    };

    const scrollToSection = (section: 'howItWorks' | 'pricing') => {
        const position = sectionPositions[section];
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ y: position, animated: true });
        }
    };

    const onSectionLayout = (section: 'howItWorks' | 'pricing') => (event: LayoutChangeEvent) => {
        const { y } = event.nativeEvent.layout;
        setSectionPositions(prev => ({ ...prev, [section]: y }));
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            <ScrollView 
                ref={scrollRef}
                contentContainerStyle={[styles.content, !isDesktop && { paddingBottom: 80 }]}
                stickyHeaderIndices={isDesktop ? [0] : []}
            >

                {/* ========== NAVBAR ========== */}
                <View style={[styles.navbar, !isDesktop && { paddingHorizontal: 16 }]}>
                    <View style={styles.navLeft}>
                        <Image 
                            source={LocalLogo} 
                            style={[styles.navLogoImage, { tintColor: COLORS.primary }]} 
                            resizeMode="contain" 
                        />
                        <Text style={styles.navBrand}>Veritly</Text>
                    </View>

                    {isDesktop && (
                        <View style={styles.navCenter}>
                            <TouchableOpacity onPress={() => scrollToSection('howItWorks')}><Text style={styles.navLink}>Cómo funciona</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => scrollToSection('pricing')}><Text style={styles.navLink}>Precios</Text></TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.navRight}>
                        <TouchableOpacity
                            style={styles.navButtonSecondary}
                            onPress={() => router.push('/empresa/signin')}
                        >
                            <Text style={styles.navButtonSecondaryText}>{isDesktop ? 'Iniciar Sesión' : 'Login'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.navButtonPrimary}
                            onPress={() => router.push('/empresa/signin?register=true')}
                        >
                            <Text style={styles.navButtonPrimaryText}>{isDesktop ? 'Probar Veritly' : 'Probar Veritly'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ========== HERO SECTION ========== */}
                <View style={[styles.heroSection, { paddingHorizontal: isDesktop ? 64 : 24 }]}>
                    <View style={[
                        styles.heroContent,
                        isDesktop ? styles.heroContentDesktop : styles.heroContentMobile
                    ]}>
                        <View style={[styles.heroLeft, isDesktop && { flex: 1, maxWidth: 600 }]}>
                            <View style={[styles.trustBadge, { backgroundColor: 'rgba(6, 182, 212, 0.1)' }]}>
                                <Sparkles size={14} color={COLORS.accent} />
                                <Text style={[styles.trustBadgeText, { color: COLORS.accent }]}>DISEÑADO POR RECLUTADORES, PARA RECLUTADORES</Text>
                            </View>

                            <Text style={[
                                styles.heroTitle,
                                { fontSize: isDesktop ? 48 : 32, lineHeight: isDesktop ? 58 : 40 }
                            ]}>
                                Publica, comparte y recibe candidatos pre-filtrados automáticamente.
                            </Text>
                            <Text style={[styles.heroSubtitle, { fontSize: isDesktop ? 18 : 16 }]}>
                                Crea tu convocatoria en 1 minuto. Comparte un link único, filtra candidatos con preguntas clave y analiza sus CVs con IA para obtener un Match Score instantáneo.
                            </Text>

                            <View style={[
                                styles.heroCTAContainer,
                                !isDesktop && { flexDirection: 'column', alignItems: 'center' }
                            ]}>
                                <TouchableOpacity
                                    style={[styles.heroPrimaryButton, !isDesktop && { width: '100%', justifyContent: 'center' }]}
                                    onPress={() => router.push('/empresa/signin?register=true')}
                                >
                                    <Text style={styles.heroPrimaryButtonText}>Publicar mi primer puesto GRATIS</Text>
                                    <ChevronRight size={18} color={COLORS.white} />
                                </TouchableOpacity>

                                <Text style={[styles.heroSubText, !isDesktop && { textAlign: 'center' }]}>Sin tarjetas de crédito. Configuración en 2 minutos.</Text>
                                
                                {/* Etapa temprana - mensaje honesto, sin cifras infladas */}
                                <View style={{
                                    flexDirection: isDesktop ? 'row' : 'column',
                                    alignItems: 'center',
                                    marginTop: 20,
                                    gap: 8,
                                    alignSelf: isDesktop ? 'flex-start' : 'center'
                                }}>
                                    <Zap size={16} color={COLORS.accent} />
                                    <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' }}>
                                        Estamos empezando — sé de los primeros reclutadores en dejar el Excel.
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.heroRight, isDesktop ? { flex: 1 } : { width: '100%', marginTop: 60 }]}>
                            <View style={[styles.heroImageContainer, !isDesktop && { width: '100%', alignItems: 'center' }]}>
                                <Image
                                    source={HeroLaptop}
                                    style={[
                                        styles.heroLaptopImage,
                                        { height: isDesktop ? 400 : 250, width: isDesktop ? 600 : '90%', maxWidth: 350 }
                                    ]}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* ========== CÓMO FUNCIONA SECTION ========== */}
                <View 
                    onLayout={onSectionLayout('howItWorks')}
                    style={[styles.howItWorksSection, { paddingHorizontal: isDesktop ? 64 : 24 }]}
                >
                    <Text style={styles.sectionTitle}>
                        ¿Cómo funciona Veritly?
                    </Text>
                    <Text style={styles.sectionSubtitle}>
                        Un flujo de trabajo optimizado para que te enfoques en las personas, no en el papeleo.
                    </Text>

                    <View style={[styles.featureGrid, isDesktop && styles.featureGridDesktop]}>
                        <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
                            <View style={styles.cardIconBox}>
                                <FileText color={COLORS.primary} size={28} />
                            </View>
                            <Text style={styles.cardTitle}>1. Comparte</Text>
                            <Text style={styles.cardDescription}>
                                Publica tu vacante y comparte un link único. Centraliza a todos tus postulantes en un solo lugar, olvidándote de los correos colapsados.
                            </Text>
                        </View>

                        <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
                            <View style={styles.cardIconBox}>
                                <Zap color={COLORS.primary} size={28} />
                            </View>
                            <Text style={styles.cardTitle}>2. Filtra</Text>
                            <Text style={styles.cardDescription}>
                                Los candidatos responden tus preguntas filtro obligatorias. Quienes no cumplen pasan a descartados y quienes sí, entran directo a tu pipeline operativo.
                            </Text>
                        </View>

                        <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
                            <View style={styles.cardIconBox}>
                                <Users color={COLORS.primary} size={28} />
                            </View>
                            <Text style={styles.cardTitle}>3. Analiza con IA</Text>
                            <Text style={styles.cardDescription}>
                                Usa la IA para comparar el CV de tus candidatos aprobados con el perfil del puesto, generando un Match Score de compatibilidad en segundos.
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ========== PRICING SECTION ========== */}
                <View 
                    onLayout={onSectionLayout('pricing')}
                    style={[styles.pricingSection, { paddingHorizontal: isDesktop ? 64 : 24 }]}
                >
                    <Text style={styles.sectionTitle}>Planes y Precios</Text>
                    <Text style={styles.sectionSubtitle}>Comienza gratis hoy y escala tu consultoría a medida que creces.</Text>

                    {plansLoading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
                    ) : (
                        <View style={[styles.pricingGrid, isDesktop && styles.pricingGridDesktop]}>
                            {systemPlans.map((plan: any) => (
                                <View key={plan.id} style={[styles.pricingCard, plan.isRecommended && styles.pricingCardActive]}>
                                    {plan.isRecommended && (
                                        <View style={styles.bestValueBadge}>
                                            <Text style={styles.bestValueText}>RECOMENDADO</Text>
                                        </View>
                                    )}
                                    <Text style={[styles.planName, plan.isRecommended && { color: COLORS.primary }]}>{plan.name}</Text>
                                    <View style={styles.priceRow}>
                                        <Text style={styles.planPrice}>{getDisplayPrice(plan.priceMonthly || 0)}</Text>
                                        <Text style={styles.planPriceUnit}>{plan.priceMonthly > 0 ? '/ mes' : '/ permanente'}</Text>
                                    </View>
                                    <Text style={styles.planDesc}>
                                        {plan.priceMonthly > 0
                                            ? 'Para reclutadores y equipos que buscan escalar sus procesos.'
                                            : 'Ideal para reclutadores independientes, consultoras y PYMEs que arrancan.'}
                                    </Text>

                                    <View style={styles.planFeatures}>
                                        <FeatureItemLanding text={`${plan.aiAnalysisLimit || 0} análisis de IA por mes`} />
                                        <FeatureItemLanding text={`${plan.internalVacanciesLimit || 0} vacantes activas`} />
                                        {(plan.features || []).slice(0, 2).map((f: string, i: number) => (
                                            <FeatureItemLanding key={i} text={f} />
                                        ))}
                                    </View>
                                    <TouchableOpacity
                                        style={plan.isRecommended ? styles.planButtonPrimary : styles.planButtonSecondary}
                                        onPress={() => router.push('/empresa/signin?register=true')}
                                    >
                                        <Text style={plan.isRecommended ? styles.planButtonPrimaryText : styles.planButtonSecondaryText}>
                                            {plan.priceMonthly > 0 ? 'Elegir Plan' : 'Empezar Gratis Ahora'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {/* Enterprise: no vive en config_plans, es a medida */}
                            <View style={styles.pricingCard}>
                                <Text style={styles.planName}>Enterprise</Text>
                                <View style={styles.priceRow}>
                                    <Text style={styles.planPrice}>Custom</Text>
                                </View>
                                <Text style={styles.planDesc}>Soluciones a medida para grandes equipos de RPO y corporaciones.</Text>
                                <View style={styles.planFeatures}>
                                    <FeatureItemLanding text="Análisis Ilimitado" />
                                    <FeatureItemLanding text="API Privada / SSO" />
                                    <FeatureItemLanding text="Account Manager" />
                                </View>
                                <TouchableOpacity style={styles.planButtonSecondary} onPress={() => Linking.openURL('https://wa.me/51986731032')}>
                                    <Text style={styles.planButtonSecondaryText}>Contactar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* ========== BOTTOM CTA ========== */}
                <View style={styles.bottomCTASection}>
                    <Text style={styles.bottomCTATitle}>Dale a tu consultoría el flujo que merece</Text>
                    <Text style={styles.bottomCTASubtitle}>Empieza a reclutar de forma centralizada y profesional con Veritly.</Text>
                    <TouchableOpacity
                        style={styles.heroPrimaryButton}
                        onPress={() => router.push('/empresa/signin?register=true')}
                    >
                        <Text style={styles.heroPrimaryButtonText}>Publicar mi primer puesto GRATIS</Text>
                    </TouchableOpacity>
                </View>

                {/* ========== FOOTER ========== */}
                <View style={styles.footer}>
                    <View style={styles.footerContent}>
                        <View style={styles.footerBrand}>
                            <Image source={LocalLogo} style={[styles.navLogoImage, { tintColor: COLORS.textTertiary, marginBottom: 8 }]} resizeMode="contain" />
                            <Text style={styles.footerBrandText}>Veritly</Text>
                        </View>
                        <Text style={styles.footerCopyright}>© {new Date().getFullYear()} Relié Labs LLC. Veritly es un producto de Relié Labs LLC.</Text>
                        <View style={styles.footerLinks}>
                            <TouchableOpacity onPress={() => router.push('/privacy')}>
                                <Text style={styles.footerLinkText}>Términos y Condiciones</Text>
                            </TouchableOpacity>
                            <Text style={styles.footerLinkSeparator}>·</Text>
                            <TouchableOpacity onPress={() => router.push('/privacy')}>
                                <Text style={styles.footerLinkText}>Política de Privacidad</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

            </ScrollView>

            {/* FLOATING MOBILE CTA */}
            {!isDesktop && (
                <View style={styles.floatingMobileCTA}>
                    <TouchableOpacity
                        style={styles.floatingButton}
                        onPress={() => router.push('/empresa/signin?register=true')}
                    >
                        <Text style={styles.floatingButtonText}>Publicar puesto GRATIS</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const FeatureItemLanding = ({ text }: { text: string }) => (
    <View style={styles.featureItemLanding}>
        <CheckCircle size={16} color={COLORS.accent} />
        <Text style={styles.featureItemLandingText}>{text}</Text>
    </View>
);

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
    navCenter: {
        flexDirection: 'row',
        gap: 32,
        alignItems: 'center',
    },
    navLink: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textSecondary,
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
        gap: 8,
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
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 2,
    },
    navButtonPrimaryText: {
        fontSize: 14,
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
        textAlign: 'center',
    },
    footerLinks: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    footerLinkText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    footerLinkSeparator: {
        fontSize: 13,
        color: COLORS.textTertiary,
    },

    // ========== PRICING SECTION STYLES ==========
    pricingSection: {
        paddingVertical: 100,
        backgroundColor: COLORS.white,
    },
    pricingGrid: {
        flexDirection: 'column',
        gap: 24,
        marginTop: 40,
    },
    pricingGridDesktop: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'stretch',
    },
    pricingCard: {
        flex: 1,
        maxWidth: 360,
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 32,
        borderWidth: 1,
        borderColor: COLORS.surfaceAlt,
        shadowColor: COLORS.textPrimary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
    },
    pricingCardActive: {
        borderColor: COLORS.accent,
        borderWidth: 2,
        transform: Platform.OS === 'web' ? [{ scale: 1.05 }] : [],
        position: 'relative',
    },
    bestValueBadge: {
        position: 'absolute',
        top: -14,
        alignSelf: 'center',
        backgroundColor: COLORS.accent,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    bestValueText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: '800',
    },
    planName: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginBottom: 16,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    planPrice: {
        fontSize: 40,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    planPriceUnit: {
        fontSize: 16,
        color: COLORS.textTertiary,
        marginLeft: 4,
    },
    planDesc: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 22,
        marginBottom: 32,
        height: 44,
    },
    planFeatures: {
        gap: 16,
        marginBottom: 40,
        flex: 1,
    },
    featureItemLanding: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    featureItemLandingText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    planButtonPrimary: {
        backgroundColor: COLORS.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    planButtonPrimaryText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
    planButtonSecondary: {
        backgroundColor: COLORS.surface,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    planButtonSecondaryText: {
        color: COLORS.textPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    planButtonDisabled: {
        backgroundColor: COLORS.surfaceAlt,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    planButtonDisabledText: {
        color: COLORS.textTertiary,
        fontSize: 16,
        fontWeight: '700',
    },
    floatingMobileCTA: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.white,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderColor: COLORS.surfaceAlt,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 10,
    },
    floatingButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    floatingButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
});