import { useLocalSearchParams, useRouter } from 'expo-router';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { ArrowRight, Building2, CheckSquare, Github, Lock, Mail, Square, UserPlus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import AppHeader from '../../components/AppHeader';
import { auth } from '../../config/firebase';
import { createCompanyUser } from '../../services/auth-service';
import { trackDailyLogin, trackNewUser } from '../../utils/analytics';
import { setUserId, trackLogin, trackSignUp } from '../../utils/ga';

const LocalLogo = require('../../assets/images/veritly3.png');
const HeroImage = require('../../assets/images/friendly_hero.png');

export default function CompanySignIn() {
    const router = useRouter();
    const { register } = useLocalSearchParams();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(register === 'true');
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    // Validation State
    const [emailError, setEmailError] = useState(false);

    // Animation Values
    const formOpacity = useSharedValue(1);
    const formTranslateX = useSharedValue(0);

    useEffect(() => {
        if (register) {
            setIsRegistering(register === 'true');
        }
    }, [register]);

    // Effect to animate transition
    useEffect(() => {
        formOpacity.value = 0;
        formTranslateX.value = isRegistering ? 20 : -20;

        setTimeout(() => {
            formOpacity.value = withTiming(1, { duration: 300 });
            formTranslateX.value = withSpring(0);
        }, 100);
    }, [isRegistering]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: formOpacity.value,
            transform: [{ translateX: formTranslateX.value }]
        };
    });

    const validateEmail = (text: string) => {
        setEmail(text);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        setEmailError(text.length > 0 && !emailRegex.test(text));
    };

    const showAlert = (title: string, message: string) => {
        if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
        else Alert.alert(title, message);
    };

    const handleAuth = async () => {
        const cleanEmail = email.trim().toLowerCase();

        if (cleanEmail.length === 0 || password.length === 0) {
            return showAlert('Campos Vacíos', 'Por favor completa todos los campos');
        }

        if (emailError) {
            return showAlert('Email Inválido', 'Por favor ingresa un correo electrónico válido');
        }

        if (isRegistering && !acceptedTerms) {
            return showAlert('Requerido', 'Debes aceptar la Política de Privacidad para registrar tu empresa.');
        }

        setLoading(true);
        try {
            if (isRegistering) {
                // REGISTRO EMPRESA
                console.log('📝 Registrando empresa:', cleanEmail);
                await createCompanyUser(cleanEmail, password);
                console.log('✅ Empresa creada');

                // --- TRACKING METRICS ---
                trackNewUser();
                trackSignUp('email_empresa');
                if (auth.currentUser) setUserId(auth.currentUser.uid);
                // ------------------------

                showAlert("¡Bienvenido!", "Cuenta de empresa creada.");
                setTimeout(() => {
                    router.replace('/empresa/dashboard/onboarding');
                }, 500);
            } else {
                // LOGIN EMPRESA
                console.log('🔐 Login empresa:', cleanEmail);
                await signInWithEmailAndPassword(auth, cleanEmail, password);
                console.log('✅ Login exitoso');

                // --- TRACKING METRICS ---
                trackDailyLogin();
                trackLogin('email_empresa');
                if (auth.currentUser) setUserId(auth.currentUser.uid);
                // ------------------------

                setTimeout(() => {
                    router.replace('/empresa/dashboard');
                }, 500);
            }
        } catch (error: any) {
            console.error('❌ Error en auth:', error);
            let errorMessage = 'Error de acceso.';

            if (error.code === 'auth/email-already-in-use') errorMessage = 'Este correo ya está registrado.';
            if (error.code === 'auth/invalid-email') errorMessage = 'Correo electrónico no válido.';
            if (error.code === 'auth/weak-password') errorMessage = 'La contraseña es muy débil (mínimo 6 caracteres).';
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') errorMessage = 'Credenciales incorrectas.';

            showAlert('Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) return showAlert("Falta Correo", "Escribe tu correo para restablecer la contraseña.");
        try {
            await sendPasswordResetEmail(auth, email.trim());
            showAlert("Enviado", "Revisa tu correo.");
        } catch (e: any) {
            showAlert("Error", e.message);
        }
    };

    const handleSocialLogin = (provider: string) => {
        showAlert('Próximamente', `El inicio de sesión con ${provider} estará disponible muy pronto.`);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Mobile-only Header */}
            {!isDesktop && (
                <AppHeader showAuthButtons={false} showBackButton={true} title={isRegistering ? "NUEVA EMPRESA" : "ACCESO EMPRESA"} />
            )}

            <View style={styles.mainContent}>

                {/* LEFT PANEL: FORM */}
                <View style={[styles.formPanel, isDesktop && styles.formPanelDesktop]}>
                    {isDesktop && (
                        <View style={styles.desktopHeader}>
                            <TouchableOpacity onPress={() => router.push('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Image source={LocalLogo} style={styles.logoSmall} resizeMode="contain" />
                                <Text style={styles.brandName}>Veritly</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.formContainer}>
                        <Animated.View style={[styles.formWrapper, animatedStyle]}>
                            <Text style={styles.title}>{isRegistering ? "Cuenta Corporativa" : "Portal Empresas"}</Text>
                            <Text style={styles.subtitle}>
                                {isRegistering
                                    ? "Registra tu empresa y empieza a contratar con IA."
                                    : "Accede para gestionar tus vacantes y candidatos."}
                            </Text>

                            {/* Form Inputs */}
                            <View style={styles.inputsStack}>
                                <View>
                                    <Text style={styles.label}>Correo Corporativo</Text>
                                    <View style={[styles.inputGroup, emailError && styles.inputError]}>
                                        <Mail color={emailError ? "#ef4444" : "#94a3b8"} size={20} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="rrhh@empresa.com"
                                            placeholderTextColor="#64748b"
                                            value={email}
                                            onChangeText={validateEmail}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text style={styles.label}>Contraseña</Text>
                                    <View style={styles.inputGroup}>
                                        <Lock color="#94a3b8" size={20} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="••••••••"
                                            placeholderTextColor="#64748b"
                                            secureTextEntry
                                            value={password}
                                            onChangeText={setPassword}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Terms Checkbox (Register Only) */}
                            {isRegistering && (
                                <TouchableOpacity
                                    style={styles.checkboxRow}
                                    onPress={() => setAcceptedTerms(!acceptedTerms)}
                                    activeOpacity={0.8}
                                >
                                    {acceptedTerms
                                        ? <CheckSquare color="#10b981" size={22} />
                                        : <Square color="#475569" size={22} />
                                    }
                                    <Text style={styles.termsText}>
                                        Acepto la <Text style={styles.linkText} onPress={() => router.push('/privacy')}>Política de Privacidad</Text>
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Forgot Password (Login Only) */}
                            {!isRegistering && (
                                <TouchableOpacity style={styles.forgotPass} onPress={handleForgotPassword}>
                                    <Text style={styles.forgotPassText}>¿Olvidaste tu contraseña?</Text>
                                </TouchableOpacity>
                            )}

                            {/* Submit Button */}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleAuth}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text style={styles.primaryButtonText}>
                                            {isRegistering ? "Registrar Empresa" : "Entrar al Panel"}
                                        </Text>
                                        {isRegistering ? <UserPlus color="white" size={20} /> : <ArrowRight color="white" size={20} />}
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* Social Login */}
                            <View style={styles.socialSection}>
                                <View style={styles.divider}>
                                    <View style={styles.dividerLine} />
                                    <Text style={styles.dividerText}>O accede con</Text>
                                    <View style={styles.dividerLine} />
                                </View>

                                <View style={styles.socialButtons}>
                                    <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocialLogin('Google')}>
                                        <Text style={styles.socialIcon}>🔵</Text>
                                        <Text style={styles.socialBtnText}>Google</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocialLogin('GitHub')}>
                                        <Github color="white" size={20} />
                                        <Text style={styles.socialBtnText}>GitHub</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Mode Toggle */}
                            <View style={styles.footer}>
                                <Text style={styles.footerText}>
                                    {isRegistering ? "¿Ya tienes cuenta?" : "¿Nueva empresa?"}
                                </Text>
                                <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
                                    <Text style={styles.footerLink}>
                                        {isRegistering ? " Inicia Sesión" : " Regístrate aquí"}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.companyLink}
                                onPress={() => router.replace('/signin')}
                            >
                                <Text style={styles.companyLinkText}>¿Buscas empleo? Ir a Candidatos</Text>
                            </TouchableOpacity>

                        </Animated.View>
                    </View>
                </View>

                {/* RIGHT PANEL: BRANDING (Desktop Only) */}
                {isDesktop && (
                    <View style={styles.brandPanel}>
                        <Image
                            source={HeroImage}
                            style={styles.brandBgImage}
                            resizeMode="cover"
                            blurRadius={Platform.OS === 'web' ? 10 : 3}
                        />
                        <View style={styles.brandOverlay}>
                            <View style={styles.brandContent}>
                                <Image source={LocalLogo} style={styles.brandLogoBig} resizeMode="contain" />
                                <Text style={[styles.brandDesc, { fontSize: 14, color: 'white', fontWeight: 'bold', marginBottom: 20 }]}>✨ Antes de contratar, Veritly</Text>
                                <Text style={styles.brandTitle}>Contratación Inteligente</Text>
                                <Text style={styles.brandDesc}>
                                    Deja que la IA filtre, analice y clasifique el mejor talento para ti en tiempo real.
                                </Text>

                                <View style={styles.featurePill}>
                                    <Building2 color="#10b981" size={16} />
                                    <Text style={styles.featureText}>Dashboard de Vacantes</Text>
                                </View>
                                <View style={styles.featurePill}>
                                    <CheckSquare color="#10b981" size={16} />
                                    <Text style={styles.featureText}>Filtrado Automático</Text>
                                </View>
                                <View style={styles.featurePill}>
                                    <CheckSquare color="#10b981" size={16} />
                                    <Text style={styles.featureText}>Ranking de Candidatos</Text>
                                </View>

                            </View>
                        </View>
                    </View>
                )}

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a'
    },
    mainContent: {
        flex: 1,
        flexDirection: 'row',
    },

    // LEFT PANEL
    formPanel: {
        flex: 1,
        backgroundColor: '#0f172a',
        padding: 24,
        justifyContent: 'center',
    },
    formPanelDesktop: {
        flex: 0.45,
        borderRightWidth: 1,
        borderRightColor: '#1e293b'
    },
    desktopHeader: {
        position: 'absolute',
        top: 30,
        left: 30,
        zIndex: 10
    },
    logoSmall: { width: 32, height: 32 },
    brandName: { color: 'white', fontWeight: 'bold', fontSize: 18, letterSpacing: 1 },

    formContainer: {
        maxWidth: 420,
        width: '100%',
        alignSelf: 'center',
    },
    formWrapper: {
        width: '100%',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
        marginBottom: 32,
        lineHeight: 24,
    },

    // Inputs
    inputsStack: {
        gap: 20,
        marginBottom: 20
    },
    label: {
        color: '#e2e8f0',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
        marginLeft: 4
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 50,
        gap: 12,
    },
    inputError: {
        borderColor: '#ef4444',
    },
    input: {
        flex: 1,
        color: 'white',
        fontSize: 16,
        height: '100%'
    },

    // Checkbox
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
        paddingHorizontal: 4
    },
    termsText: { color: '#94a3b8', fontSize: 13, flex: 1 },
    linkText: { color: '#10b981', fontWeight: '600' },

    // Forgot Password
    forgotPass: { alignSelf: 'flex-end', marginBottom: 20 },
    forgotPassText: { color: '#10b981', fontSize: 14, fontWeight: '500' },

    // Buttons
    primaryButton: {
        backgroundColor: '#10b981',
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 10,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    buttonDisabled: { opacity: 0.7 },
    primaryButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    // Social
    socialSection: { marginTop: 32 },
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#334155' },
    dividerText: { color: '#64748b', paddingHorizontal: 16, fontSize: 12, fontWeight: '500' },
    socialButtons: { flexDirection: 'row', gap: 16 },
    socialBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#334155'
    },
    socialBtnText: { color: 'white', fontWeight: '600' },
    socialIcon: { fontSize: 18 },

    // Footer Actions
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 32,
        gap: 6
    },
    footerText: { color: '#94a3b8' },
    footerLink: { color: '#10b981', fontWeight: 'bold' },
    companyLink: {
        alignSelf: 'center',
        marginTop: 20,
        padding: 10
    },
    companyLinkText: { color: '#64748b', fontSize: 13 },

    // RIGHT PANEL (Desktop)
    brandPanel: {
        flex: 0.55,
        backgroundColor: '#064e3b', // Darker green bg
        position: 'relative',
        overflow: 'hidden',
    },
    brandBgImage: {
        width: '100%',
        height: '100%',
        opacity: 0.4
    },
    brandOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(6, 78, 59, 0.8)', // Dark green overlay
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    brandContent: {
        alignItems: 'center',
        maxWidth: 400
    },
    brandLogoBig: {
        width: 100,
        height: 100,
        marginBottom: 30
    },
    brandTitle: {
        fontSize: 36,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 16,
        textAlign: 'center'
    },
    brandDesc: {
        fontSize: 18,
        color: '#ecfdf5',
        textAlign: 'center',
        lineHeight: 28,
        marginBottom: 20
    },
    featurePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 100,
        marginBottom: 12,
        gap: 10,
        width: '100%'
    },
    featureText: {
        color: '#d1fae5',
        fontWeight: '500'
    }
});
