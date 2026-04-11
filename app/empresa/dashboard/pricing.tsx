import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { auth, db } from '../../../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function PricingScreen() {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [locationInfo, setLocationInfo] = useState({ country: 'PE', currency: 'PEN', symbol: 'S/' });
    const [priceLoading, setPriceLoading] = useState(true);

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
                if (data.country_code === 'PE') {
                    setLocationInfo({ country: 'PE', currency: 'PEN', symbol: 'S/' });
                } else {
                    setLocationInfo({ country: data.country_code || 'US', currency: 'USD', symbol: '$' });
                }
            } catch (error) {
                console.error("Error detectando ubicación:", error);
                // Default to Peru if fails, or could be USD global
                setLocationInfo({ country: 'PE', currency: 'PEN', symbol: 'S/' });
            } finally {
                setPriceLoading(false);
            }
        };
        detectLocation();
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

    const handleSubscribe = async (planName: string) => {
        if (!auth.currentUser) {
            return Alert.alert("Inicia Sesión", "Debes estar logueado para contratar un plan.");
        }

        if (Platform.OS !== 'web') {
            return Alert.alert("Próximamente", "Inicia sesión desde tu PC para contratar planes.");
        }

        if (planName === 'Freemium') return;

        const CULQI_PK = process.env.EXPO_PUBLIC_CULQI_PUBLIC_KEY || 'pk_test_3066914563f68340'; // Reemplazar con real pk_test_...

        // @ts-ignore
        const Culqi = window.Culqi;

        if (!Culqi) {
            return alert("Culqi no está cargado correctamente. Recarga la página.");
        }

        setLoading(true);

        Culqi.publicKey = CULQI_PK;
        
        const amount = planName === 'Pro' 
            ? (billingPeriod === 'monthly' ? (locationInfo.currency === 'PEN' ? 180 : 49) : (locationInfo.currency === 'PEN' ? 1800 : 490)) 
            : (billingPeriod === 'monthly' ? (locationInfo.currency === 'PEN' ? 400 : 109) : (locationInfo.currency === 'PEN' ? 4000 : 1090));

        Culqi.settings({
            title: `Veritly - Plan ${planName}`,
            currency: locationInfo.currency,
            description: `Suscripción ${billingPeriod === 'monthly' ? 'Mensual' : 'Anual'} ${planName}`,
            amount: amount * 100 // Culqi usa céntimos
        });

        Culqi.options({
            lang: 'auto',
            modal: true,
            installments: false,
            customButton: '',
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
                            planId: planName === 'Pro' ? 'plan_pro_5' : 'plan_gold_12',
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
                            'subscription.jobsLimit': planName === 'Pro' ? 50 : 1500, // Limites según plan
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
            <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
            
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Veritly Beta Program</Text>
                    <Text style={styles.subtitle}>
                        Estamos en fase de lanzamiento. Únete como Beta Partner y ayuda a construir el futuro del reclutamiento con IA.
                    </Text>

                    {/* PRÓXIMAMENTE: BILLING TOGGLE (OCULTO EN BETA) */}
                    <View style={[styles.toggleWrapper, { opacity: 0.5 }]}>
                         <Text style={{color: '#94a3b8', fontSize: 12, fontWeight: 'bold'}}>BIENVENIDO AL LANZAMIENTO</Text>
                    </View>
                </View>

                <View style={styles.cardsContainer}>
                    
                    {/* BETA PARTNER PLAN (FREEMIUM REPLACED) */}
                    <View style={[styles.card, { borderColor: '#10b981', borderWidth: 2 }]}>
                        <Text style={styles.planName}>Beta Partner</Text>
                        <Text style={styles.planPrice}>S/ 0</Text>
                        <Text style={styles.planDesc}>Acceso completo y gratuito por ser de los primeros usuarios.</Text>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.features}>
                            <FeatureItem text="Análisis de Candidatos Ilimitado" color="#10b981" iconColor="#10b981" />
                            <FeatureItem text="Soporte VIP Directo" color="#10b981" iconColor="#10b981" />
                            <FeatureItem text="Participa en el Roadmap" color="#10b981" iconColor="#10b981" />
                            <FeatureItem text="Créditos Gratis para el Futuro" color="#10b981" iconColor="#10b981" />
                        </View>
                        
                        <View style={[styles.buttonOutline, { backgroundColor: '#10b981', borderColor: '#10b981' }]}>
                            <Text style={[styles.buttonOutlineText, { color: 'white' }]}>Tu Plan Actual</Text>
                        </View>
                    </View>

                    {/* PRO PLAN (SUGERIDO) */}
                    <View style={[styles.card, styles.cardPro]}>
                        <View style={styles.badgeProContainer}>
                            <Text style={styles.badgeProText}>MÁS POPULAR</Text>
                        </View>
                        <Text style={[styles.planName, { color: '#38bdf8' }]}>Pro</Text>
                        <View style={styles.priceRow}>
                            <Text style={[styles.planPrice, { color: 'white' }]}>
                                {locationInfo.symbol} {locationInfo.currency === 'PEN' ? (billingPeriod === 'monthly' ? '180' : '150') : (billingPeriod === 'monthly' ? '49' : '40')}
                            </Text>
                            <Text style={styles.planPriceUnit}>/ mes</Text>
                        </View>
                        {billingPeriod === 'annual' && <Text style={styles.priceEquivalent}>Facturado anualmente</Text>}
                        <Text style={styles.planDesc}>La solución ideal para empresas en crecimiento.</Text>
                        
                        <View style={styles.dividerPro} />
                        
                        <View style={styles.features}>
                            <FeatureItem text="Límite: 500 Candidatos" color="white" iconColor="#38bdf8" />
                            <FeatureItem text="Análisis con IA (Alta Velocidad)" color="white" iconColor="#38bdf8" />
                            <FeatureItem text="Match Completo (Keywords)" color="white" iconColor="#38bdf8" />
                            <FeatureItem text="Exportación de Reportes" color="white" iconColor="#38bdf8" />
                            <FeatureItem text="Soporte Email Preferente" color="white" iconColor="#38bdf8" />
                        </View>
                        
                        <TouchableOpacity disabled={true} style={{ opacity: 0.6 }}>
                            <LinearGradient
                                colors={['#334155', '#1e293b']}
                                style={styles.buttonPro}
                            >
                                <Text style={styles.buttonProText}>Próximamente</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* GOLD PLAN */}
                    <View style={styles.card}>
                        <Text style={styles.planName}>Gold</Text>
                        <View style={styles.priceRow}>
                            <Text style={styles.planPrice}>
                                {locationInfo.symbol} {locationInfo.currency === 'PEN' ? (billingPeriod === 'monthly' ? '400' : '330') : (billingPeriod === 'monthly' ? '109' : '90')}
                            </Text>
                            <Text style={styles.planPriceUnit}>/ mes</Text>
                        </View>
                        {billingPeriod === 'annual' && <Text style={styles.priceEquivalent}>Facturado anualmente</Text>}
                        <Text style={styles.planDesc}>Para agencias y equipos de reclutamiento masivo.</Text>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.features}>
                            <FeatureItem text="Límite: 1,500 Candidatos" />
                            <FeatureItem text="Análisis IA Prioritario" />
                            <FeatureItem text="Ajuste Cultural IA" />
                            <FeatureItem text="Dashboards Personalizados" />
                            <FeatureItem text="Soporte Técnico Premium" />
                        </View>
                        
                        <View style={[styles.buttonOutline, { opacity: 0.6 }]}>
                            <Text style={styles.buttonOutlineText}>Próximamente</Text>
                        </View>
                    </View>

                </View>
            </ScrollView>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#38bdf8" />
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
        backgroundColor: '#0F172A',
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
        color: 'white',
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
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
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 300,
        borderWidth: 1,
        borderColor: '#334155',
    },
    cardPro: {
        backgroundColor: '#0F172A',
        borderColor: '#38bdf8',
        borderWidth: 2,
        transform: [{ scale: 1.05 }],
        position: 'relative',
        shadowColor: '#38bdf8',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    badgeProContainer: {
        position: 'absolute',
        top: -12,
        alignSelf: 'center',
        backgroundColor: '#38bdf8',
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderRadius: 20,
    },
    badgeProText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },
    planName: {
        fontSize: 20,
        fontWeight: '700',
        color: 'white',
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
        color: 'white',
    },
    planPriceUnit: {
        fontSize: 16,
        color: '#94a3b8',
        marginLeft: 4,
    },
    planDesc: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 20,
        lineHeight: 20,
        height: 40,
    },
    divider: {
        height: 1,
        backgroundColor: '#334155',
        marginBottom: 20,
    },
    dividerPro: {
        height: 1,
        backgroundColor: 'rgba(56, 189, 248, 0.3)',
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
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#475569',
        alignItems: 'center',
    },
    buttonOutlineText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    buttonPro: {
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonProText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 16,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    loadingText: {
        color: '#38bdf8',
        marginTop: 20,
        fontWeight: '700',
        fontSize: 16,
    },
    // Toggle Styles
    toggleWrapper: {
        flexDirection: 'row',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        padding: 4,
        marginTop: 24,
        borderWidth: 1,
        borderColor: '#334155',
    },
    toggleOption: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
    },
    toggleOptionActive: {
        backgroundColor: '#3b82f6',
    },
    toggleOptionText: {
        color: '#94a3b8',
        fontWeight: '600',
        fontSize: 14,
    },
    toggleOptionTextActive: {
        color: 'white',
    },
    priceEquivalent: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '700',
        marginBottom: 16,
        textTransform: 'uppercase',
    },
});
