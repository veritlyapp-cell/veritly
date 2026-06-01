import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { auth, db } from '../../../config/firebase';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';

const CURRENCY_MAP: Record<string, { currency: string; symbol: string }> = {
    PE: { currency: 'PEN', symbol: 'S/' },
    CO: { currency: 'COP', symbol: '$' },
    EC: { currency: 'USD', symbol: '$' },
    BO: { currency: 'BOB', symbol: 'Bs' },
    CL: { currency: 'CLP', symbol: '$' },
    PY: { currency: 'PYG', symbol: '₲' },
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

export default function PricingScreen() {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [locationInfo, setLocationInfo] = useState({ country: 'PE', currency: 'PEN', symbol: 'S/' });
    const [priceLoading, setPriceLoading] = useState(true);
    const [systemPlans, setSystemPlans] = useState<any[]>([]);
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
        USD: 0.27,
        COP: 1100,
        CLP: 250,
        BOB: 1.85,
        PYG: 2000,
        PEN: 1.0,
    });

    // Manejar cierre del modal de Culqi
    useEffect(() => {
        if (Platform.OS === 'web') {
            const handleCulqiClose = () => {
                console.log('Culqi modal cerrado');
                setLoading(false);
            };
            window.addEventListener('message', (event) => {
                if (event.data === 'checkout_closed') {
                    handleCulqiClose();
                }
            });
        }
    }, []);
    
    // Detect Location & Currency
    useEffect(() => {
        const detectLocation = async () => {
            try {
                const response = await fetch('https://ipapi.co/json/');
                const data = await response.json();
                const country = data.country_code || 'PE';
                const mapping = CURRENCY_MAP[country] || { currency: 'USD', symbol: '$' };
                setLocationInfo({ country, currency: mapping.currency, symbol: mapping.symbol });
            } catch (error) {
                console.error("Error detectando ubicación:", error);
                // Default to Peru if fails
                setLocationInfo({ country: 'PE', currency: 'PEN', symbol: 'S/' });
            } finally {
                setPriceLoading(false);
            }
        };
        detectLocation();

        // Fetch Exchange Rates from PEN
        const fetchExchangeRates = async () => {
            try {
                const response = await fetch('https://open.er-api.com/v6/latest/PEN');
                const data = await response.json();
                if (data && data.result === 'success' && data.rates) {
                    setExchangeRates(prev => ({
                        ...prev,
                        ...data.rates
                    }));
                }
            } catch (e) {
                console.error("Error fetching exchange rates:", e);
            }
        };
        fetchExchangeRates();

        // Fetch System Plans from config_plans
        const fetchPlans = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'config_plans'));
                const plansData = querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter((plan: any) => !plan.isHidden);
                // Sort by price or something? Let's sort by priceMonthly
                plansData.sort((a, b) => (a.priceMonthly || 0) - (b.priceMonthly || 0));
                setSystemPlans(plansData);
            } catch (error) {
                console.error("Error fetching system plans:", error);
            }
        };
        fetchPlans();
    }, []);

    // Configuración de Culqi (Web Only)
    useEffect(() => {
        if (Platform.OS === 'web') {
            const script = document.createElement('script');
            script.src = 'https://checkout.culqi.com/js/v4';
            script.async = true;
            document.body.appendChild(script);

            script.onload = () => {
                console.log('✅ Culqi Script cargado');
            };

            return () => {
                document.body.removeChild(script);
            };
        }
    }, []);

    const handleSubscribe = async (planName: string, priceInSoles: number, planId: string) => {
        if (!auth.currentUser) {
            return Alert.alert("Inicia Sesión", "Debes estar logueado para contratar un plan.");
        }

        if (Platform.OS !== 'web') {
            return Alert.alert("Próximamente", "Inicia sesión desde tu PC para contratar planes.");
        }

        if (planName === 'Freemium' || priceInSoles === 0) return;

        const CULQI_PK = process.env.EXPO_PUBLIC_CULQI_PUBLIC_KEY || 'pk_test_3066914563f68340'; // Reemplazar con real pk_test_...

        // @ts-ignore
        const Culqi = window.Culqi;

        if (!Culqi) {
            return alert("Culqi no está cargado correctamente. Recarga la página.");
        }

        setLoading(true);

        Culqi.publicKey = CULQI_PK;
        
        let chargeCurrency = 'PEN';
        let chargeAmount = priceInSoles;

        if (locationInfo.currency !== 'PEN') {
            chargeCurrency = 'USD';
            const usdRate = exchangeRates['USD'] || 0.27;
            chargeAmount = Math.round(priceInSoles * usdRate * 100) / 100;
        }

        const culqiPlanId = planName.toLowerCase().includes('pro') ? 'plan_pro_5' : 'plan_gold_12';

        Culqi.settings({
            title: `Veritly - Plan ${planName}`,
            currency: chargeCurrency,
            description: `Suscripción ${billingPeriod === 'monthly' ? 'Mensual' : 'Anual'} ${planName}`,
            amount: Math.round(chargeAmount * 100) // Culqi usa céntimos
        });

        Culqi.options({
            style: {
                logo: 'https://veritly.app/assets/images/veritly3.png',
                maincolor: '#38bdf8',
                buttontext: '#ffffff',
                maintext: '#ffffff',
                desctext: '#94a3b8'
            }
        });

        // Configuración de evento para Token
        // @ts-ignore
        window.culqi = async () => {
            if (Culqi.token) {
                const token = Culqi.token.id;
                console.log('✅ Token recibido:', token);

                try {
                    // 1. Llamar al backend (Netlify Function)
                    const response = await fetch('/.netlify/functions/subscribe', {
                        method: 'POST',
                        body: JSON.stringify({
                            token: token,
                            email: auth.currentUser?.email,
                            planId: culqiPlanId,
                            userId: auth.currentUser?.uid
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) throw new Error(data.error || 'Error al procesar suscripción');

                    // 2. Actualizar Firebase
                    if (auth.currentUser) {
                        const userRef = doc(db, 'users_empresas', auth.currentUser.uid);
                        await updateDoc(userRef, {
                            'subscription.plan': planName,
                            'subscription.status': 'Active',
                            'subscription.jobsLimit': planName.toLowerCase().includes('pro') ? 50 : 200, // Limites según plan
                            'subscription.updatedAt': new Date()
                        });
                    }

                    setLoading(false);
                    alert(`¡Bienvenido a Veritly ${planName}! Tu plan ha sido activado.`);
                    router.replace('/empresa/dashboard');

                } catch (e: any) {
                    setLoading(false);
                    alert(`Error: ${e.message}`);
                }
            } else {
                setLoading(false);
                console.log('Error:', Culqi.error);
                alert(Culqi.error.user_message);
            }
        };

        Culqi.open();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
            
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Planes y Créditos Veritly</Text>
                    <Text style={styles.subtitle}>
                        Potencia tu consultoría con inteligencia artificial. Elige el plan que mejor se adapte a tu flujo de trabajo.
                    </Text>
                           <View style={styles.toggleWrapper}>
                    <TouchableOpacity 
                        style={[styles.toggleOption, billingPeriod === 'monthly' && styles.toggleOptionActive]}
                        onPress={() => setBillingPeriod('monthly')}
                    >
                        <Text style={[styles.toggleOptionText, billingPeriod === 'monthly' && styles.toggleOptionTextActive]}>MENSUAL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.toggleOption, billingPeriod === 'annual' && styles.toggleOptionActive]}
                        onPress={() => setBillingPeriod('annual')}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.toggleOptionText, billingPeriod === 'annual' && styles.toggleOptionTextActive]}>ANUAL</Text>
                            <View style={styles.discountBadge}>
                                <Text style={styles.discountBadgeText}>AHORRA 15%</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.cardsContainer}>
                {systemPlans.length === 0 && !priceLoading && (
                    <ActivityIndicator color="#4F46E5" />
                )}
                
                {systemPlans.map((plan) => {
                    const isBeta = plan.id === 'beta_free' || plan.name?.toLowerCase().includes('beta');
                    const isRecommended = plan.isRecommended;
                    const isComingSoon = plan.isComingSoon;
                    
                    const priceInSoles = billingPeriod === 'monthly' ? (plan.priceMonthly || 0) : (plan.priceAnnual || 0);
                    let displayPrice = priceInSoles;
                    if (locationInfo.currency !== 'PEN') {
                        const rate = exchangeRates[locationInfo.currency] || (locationInfo.currency === 'USD' ? 0.27 : 1.0);
                        displayPrice = priceInSoles * rate;
                    }
                    const formattedPrice = formatCurrencyValue(displayPrice, locationInfo.currency);
                    const isCurrentPlan = auth.currentUser && (auth.currentUser as any).subscription?.plan === plan.name;

                    return (
                        <View key={plan.id} style={[styles.card, isRecommended && styles.cardPro, isBeta && { borderColor: '#10b981', borderWidth: 2 }, isComingSoon && { opacity: 0.8 }]}>
                            {isRecommended && !isComingSoon && (
                                <View style={styles.badgeProContainer}>
                                    <Text style={styles.badgeProText}>RECOMENDADO</Text>
                                </View>
                            )}
                            {isComingSoon && (
                                <View style={[styles.badgeProContainer, { backgroundColor: '#6B7280' }]}>
                                    <Text style={styles.badgeProText}>PRÓXIMAMENTE</Text>
                                </View>
                            )}

                            <Text style={[styles.planName, isRecommended && { color: '#4F46E5' }]}>{plan.name}</Text>
                            <View style={styles.priceRow}>
                                <Text style={styles.planPrice}>
                                    {locationInfo.symbol} {formattedPrice}
                                </Text>
                                <Text style={styles.planPriceUnit}>{billingPeriod === 'monthly' ? '/ mes' : '/ año'}</Text>
                            </View>
                            <Text style={styles.planDesc}>{isBeta ? 'Plan de lanzamiento para consultoras.' : `Plan para potenciar tu reclutamiento.`}</Text>
                            
                            <View style={[styles.divider, isRecommended && styles.dividerPro]} />
                            
                            <View style={styles.features}>
                                <FeatureItem text={`${plan.aiAnalysisLimit} Análisis de IA`} color="#4B5563" iconColor={isRecommended ? "#4F46E5" : (isBeta ? "#10b981" : "#64748b")} />
                                <FeatureItem text={`${plan.internalVacanciesLimit} Vacantes Internas`} color="#4B5563" iconColor={isRecommended ? "#4F46E5" : (isBeta ? "#10b981" : "#64748b")} />
                                <FeatureItem text={`${plan.publicVacanciesLimit} Vacantes Públicas`} color="#4B5563" iconColor={isRecommended ? "#4F46E5" : (isBeta ? "#10b981" : "#64748b")} />
                                <FeatureItem text={`${plan.killerQuestionsLimit || 2} Preguntas Filtros avanzados`} color="#4B5563" iconColor={isRecommended ? "#4F46E5" : (isBeta ? "#10b981" : "#64748b")} />
                                
                                {plan.features && plan.features.length > 0 ? (
                                    plan.features.filter((f: string) => !f.includes("Análisis") && !f.includes("Vacantes") && !f.includes("Filtros Avanzados") && !f.includes("Preguntas Filtro")).map((feat: string) => (
                                        <FeatureItem key={feat} text={feat} color="#4B5563" iconColor={isRecommended ? "#4F46E5" : (isBeta ? "#10b981" : "#64748b")} />
                                    ))
                                ) : (
                                    isRecommended && <FeatureItem text="Exportación a Excel/PDF" color="#4B5563" iconColor="#4F46E5" />
                                )}
                            </View>
                            
                            {isCurrentPlan ? (
                                <View style={[styles.buttonOutline, { backgroundColor: '#10b981', borderColor: '#10b981' }]}>
                                    <Text style={[styles.buttonOutlineText, { color: 'white' }]}>Tu Plan Actual</Text>
                                </View>
                            ) : (
                                <TouchableOpacity 
                                    onPress={() => handleSubscribe(plan.name, priceInSoles, plan.id)}
                                    disabled={isComingSoon}
                                    style={{ opacity: isComingSoon ? 0.6 : 1 }}
                                >
                                    <View style={[styles.buttonPro, { backgroundColor: isComingSoon ? '#9CA3AF' : (isRecommended ? '#4F46E5' : '#111827') }]}>
                                        <Text style={styles.buttonProText}>{isComingSoon ? 'Próximamente' : (plan.priceMonthly === 0 ? 'Empezar Gratis' : 'Contratar')}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}

                {/* ENTERPRISE CARD (Siempre presente al final) */}
                <View style={[styles.card, { backgroundColor: '#111827' }]}>
                    <Text style={[styles.planName, { color: '#FFFFFF' }]}>Enterprise</Text>
                    <Text style={[styles.planPrice, { color: '#FFFFFF' }]}>Personalizado</Text>
                    <Text style={[styles.planDesc, { color: '#9CA3AF' }]}>Soluciones a medida para grandes corporaciones.</Text>
                    <View style={styles.divider} />
                    <View style={styles.features}>
                        <FeatureItem text="Análisis Ilimitado" color="#FFFFFF" iconColor="#4F46E5" />
                        <FeatureItem text="API Privada" color="#FFFFFF" iconColor="#4F46E5" />
                        <FeatureItem text="Account Manager" color="#FFFFFF" iconColor="#4F46E5" />
                    </View>
                    <TouchableOpacity 
                        style={[styles.buttonOutline, { borderColor: '#4F46E5', backgroundColor: 'transparent' }]}
                        onPress={() => window.open('https://wa.me/51986731032', '_blank')}
                    >
                        <Text style={[styles.buttonOutlineText, { color: '#FFFFFF' }]}>Contactar Vendedor</Text>
                    </TouchableOpacity>
                </View>
            </View>
            </ScrollView>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={styles.loadingText}>Procesando suscripción...</Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const FeatureItem = ({ text, color = '#94a3b8', iconColor = '#64748b' }: { text: string, color?: string, iconColor?: string }) => (
    <View style={styles.featureItem}>
        <Check size={16} color={iconColor} style={styles.featureIcon} />
        <Text style={[styles.featureText, { color }]}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 48,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
        maxWidth: 600,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#111827',
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#4B5563',
        textAlign: 'center',
        lineHeight: 24,
    },
    cardsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 24,
        width: '100%',
        maxWidth: 1000,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 300,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardPro: {
        borderColor: '#4F46E5',
        borderWidth: 2,
        transform: Platform.OS === 'web' ? [{ scale: 1.05 }] : [],
        position: 'relative',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    badgeProContainer: {
        position: 'absolute',
        top: -12,
        alignSelf: 'center',
        backgroundColor: '#4F46E5',
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderRadius: 20,
    },
    badgeProText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },
    planName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 8,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 8,
    },
    planPrice: {
        fontSize: 40,
        fontWeight: '900',
        color: '#111827',
    },
    planPriceUnit: {
        fontSize: 16,
        color: '#9CA3AF',
        marginLeft: 4,
    },
    planDesc: {
        fontSize: 14,
        color: '#4B5563',
        marginBottom: 20,
        lineHeight: 20,
        height: 40,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginBottom: 20,
    },
    dividerPro: {
        height: 1,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        marginBottom: 20,
    },
    features: {
        marginBottom: 32,
        gap: 12,
        flex: 1,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    featureIcon: {
        marginRight: 12,
    },
    featureText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    buttonOutline: {
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    buttonOutlineText: {
        color: '#4B5563',
        fontWeight: '700',
        fontSize: 16,
    },
    buttonPro: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonProText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 16,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    loadingText: {
        color: '#4F46E5',
        marginTop: 20,
        fontWeight: '700',
        fontSize: 16,
    },
    // Toggle Styles
    toggleWrapper: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 4,
        marginTop: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    toggleOption: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
    },
    toggleOptionActive: {
        backgroundColor: '#4F46E5',
    },
    toggleOptionText: {
        color: '#6B7280',
        fontWeight: '600',
        fontSize: 14,
    },
    toggleOptionTextActive: {
        color: 'white',
    },
    priceEquivalent: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '700',
        marginBottom: 16,
        textTransform: 'uppercase',
    },
    discountBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    discountBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
    },
});
