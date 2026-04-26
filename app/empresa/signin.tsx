import { useLocalSearchParams, useRouter } from 'expo-router';
import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ArrowRight, Building2, CheckSquare, Lock, Mail, Square, UserPlus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import AppHeader from '../../components/AppHeader';
import { auth } from '../../config/firebase';
import { checkEmailAvailability, createCompanyUser } from '../../services/auth-service';
import { trackDailyLogin, trackUserLogin } from '../../utils/analytics';
import { setUserId, trackLogin } from '../../utils/ga';

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

    // New State for Enhanced Registration
    const [userType, setUserType] = useState<'empresa' | 'independiente'>('empresa');
    const [ruc, setRuc] = useState('');
    const [dni, setDni] = useState('');
    const [razonSocial, setRazonSocial] = useState(''); // Para RUC y Nombre Comercial
    const [fullName, setFullName] = useState(''); // Para Independiente
    const [isValidatingId, setIsValidatingId] = useState(false);
    const [idVerified, setIdVerified] = useState(false);

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

    // ID validation logic removed as per user request. Manual entry only.

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

        if (isRegistering) {
            if (userType === 'empresa') {
                if (!ruc) return showAlert('Datos Incompletos', 'Por favor ingresa el RUC.');
                if (ruc.length !== 11) return showAlert('RUC Inválido', 'El RUC debe tener 11 dígitos.');
                if (!razonSocial) return showAlert('Datos Incompletos', 'Por favor ingresa la Razón Social.');
            } else {
                if (!dni) return showAlert('Datos Incompletos', 'Por favor ingresa tu DNI.');
                if (dni.length !== 8) return showAlert('DNI Inválido', 'El DNI debe tener 8 dígitos.');
                if (!fullName) return showAlert('Datos Incompletos', 'Por favor ingresa tu Nombre Completo.');
            }
        }

        setLoading(true);
        try {
            if (isRegistering) {
                // Check Email Availability globally
                const emailCheck = await checkEmailAvailability(cleanEmail);
                if (!emailCheck.available && cleanEmail !== 'oscar@veritlyapp.com') {
                    const msg = emailCheck.existingRole === 'candidato'
                        ? 'Este correo ya está registrado como Candidato. Por favor usa otro correo para tu cuenta de Empresa.'
                        : 'Este correo ya está registrado.';
                    setLoading(false);
                    return showAlert('Email no disponible', msg);
                }

                // REGISTRO EMPRESA
                console.log('📝 Registrando empresa/recruiter:', cleanEmail);

                // [UPDATE] User requested "Nombre Comercial" to be empty at start.
                // We pass 'razonSocial' to the dedicated field, and empty string to 'name' (commercial name).
                // For 'independiente', we use fullName as the name.
                await createCompanyUser(cleanEmail, password, {
                    name: userType === 'empresa' ? '' : fullName,
                    type: userType,
                    ruc: userType === 'empresa' ? ruc : undefined,
                    razonSocial: userType === 'empresa' ? razonSocial : undefined,
                    dni: userType === 'independiente' ? dni : undefined
                });

                console.log('✅ Empresa creada');

                // Send Verification Email
                if (auth.currentUser && cleanEmail !== 'oscar@veritlyapp.com') {
                    await sendEmailVerification(auth.currentUser);
                    await signOut(auth); // Force logout so they verify first
                }

                if (cleanEmail === 'oscar@veritlyapp.com') {
                    showAlert("¡Admin Creado!", "Cuenta admin creada. Puedes iniciar sesión inmediatamente.");
                } else {
                    showAlert("¡Cuenta Creada!", "Hemos enviado un correo de verificación. Por favor actívalo para iniciar sesión.");
                }
                // Redirect to login view within the same screen
                setIsRegistering(false);
            } else {
                // LOGIN EMPRESA
                console.log('🔐 Login empresa:', cleanEmail);
                const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
                const user = userCredential.user;

                if (!user.emailVerified && cleanEmail !== 'oscar@veritlyapp.com') {
                    await signOut(auth);
                    return showAlert("Verificación Pendiente", "Por favor verifica tu correo electrónico para acceder.");
                }

                console.log('✅ Login exitoso y verificado');

                // --- TRACKING METRICS ---
                trackDailyLogin();
                trackLogin('email_empresa');
                trackUserLogin(user.uid, 'company');
                setUserId(user.uid);
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

    /* Social Login Removed */

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

                            {/* --- REGISTER TOGGLE --- */}
                            {isRegistering && (
                                <View style={styles.toggleContainer}>
                                    <TouchableOpacity
                                        style={[styles.toggleBtn, userType === 'empresa' && styles.toggleBtnActive]}
                                        onPress={() => { setUserType('empresa'); setIdVerified(false); setRazonSocial(''); }}
                                    >
                                        <Text style={[styles.toggleText, userType === 'empresa' && styles.toggleTextActive]}>Empresa</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.toggleBtn, userType === 'independiente' && styles.toggleBtnActive]}
                                        onPress={() => { setUserType('independiente'); setIdVerified(false); setFullName(''); }}
                                    >
                                        <Text style={[styles.toggleText, userType === 'independiente' && styles.toggleTextActive]}>Independiente</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Form Inputs */}
                            <View style={styles.inputsStack}>

                                {/* EMPRESA FIELDS */}
                                {isRegistering && userType === 'empresa' && (
                                    <View>
                                        <Text style={styles.label}>RUC</Text>
                                        <View style={{ marginBottom: 15 }}>
                                            <View style={styles.inputGroup}>
                                                <Building2 color="#94a3b8" size={20} />
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="20123456789"
                                                    placeholderTextColor="#64748b"
                                                    value={ruc}
                                                    onChangeText={(t) => { setRuc(t); }}
                                                    keyboardType="numeric"
                                                    maxLength={11}
                                                />
                                            </View>
                                        </View>

                                        <Text style={styles.label}>Razón Social</Text>
                                        <View style={[styles.inputGroup, { marginBottom: 15 }]}>
                                            <Building2 color="#94a3b8" size={20} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Mi Empresa S.A.C."
                                                placeholderTextColor="#64748b"
                                                value={razonSocial}
                                                onChangeText={setRazonSocial}
                                            />
                                        </View>
                                    </View>
                                )}

                                {/* INDEPENDIENTE FIELDS */}
                                {isRegistering && userType === 'independiente' && (
                                    <View>
                                        <Text style={styles.label}>DNI</Text>
                                        <View style={{ marginBottom: 15 }}>
                                            <View style={styles.inputGroup}>
                                                <UserPlus color="#94a3b8" size={20} />
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="12345678"
                                                    placeholderTextColor="#64748b"
                                                    value={dni}
                                                    onChangeText={(t) => { setDni(t); }}
                                                    keyboardType="numeric"
                                                    maxLength={8}
                                                />
                                            </View>
                                        </View>

                                        <Text style={styles.label}>Nombre Completo</Text>
                                        <View style={[styles.inputGroup, { marginBottom: 15 }]}>
                                            <UserPlus color="#94a3b8" size={20} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Juan Pérez"
                                                placeholderTextColor="#64748b"
                                                value={fullName}
                                                onChangeText={setFullName}
                                            />
                                        </View>
                                    </View>
                                )}

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
                                            {isRegistering 
                                                ? (userType === 'empresa' ? "Registrar Empresa" : "Regístrate como Reclutador") 
                                                : "Entrar al Panel"}
                                        </Text>
                                        {isRegistering ? <UserPlus color="white" size={20} /> : <ArrowRight color="white" size={20} />}
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* Social Login Removed */}

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
        backgroundColor: '#F8FAFF'
    },
    mainContent: {
        flex: 1,
        flexDirection: 'row',
    },

    // LEFT PANEL
    formPanel: {
        flex: 1,
        backgroundColor: '#F8FAFF',
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
    brandName: { color: '#111827', fontWeight: 'bold', fontSize: 18, letterSpacing: 1 },

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
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 32,
        lineHeight: 24,
    },

    // Inputs
    inputsStack: {
        gap: 20,
        marginBottom: 20
    },
    label: {
        color: '#374151',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
        marginLeft: 4
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 50,
        gap: 12,
    },
    inputError: {
        borderColor: '#DC2626',
    },
    input: {
        flex: 1,
        color: '#111827',
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
    termsText: { color: '#6B7280', fontSize: 13, flex: 1 },
    linkText: { color: '#4F46E5', fontWeight: '600' },

    // Forgot Password
    forgotPass: { alignSelf: 'flex-end', marginBottom: 20 },
    forgotPassText: { color: '#4F46E5', fontSize: 14, fontWeight: '500' },

    // Buttons
    primaryButton: {
        backgroundColor: '#4F46E5',
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 10,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4
    },
    buttonDisabled: { opacity: 0.7 },
    primaryButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    // Social
    socialSection: { marginTop: 32 },
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
    dividerText: { color: '#9CA3AF', paddingHorizontal: 16, fontSize: 12, fontWeight: '500' },
    socialButtons: { flexDirection: 'row', gap: 16 },
    socialBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    socialBtnText: { color: '#374151', fontWeight: '600' },
    socialIcon: { fontSize: 18 },

    // Footer Actions
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 32,
        gap: 6
    },
    footerText: { color: '#6B7280' },
    footerLink: { color: '#4F46E5', fontWeight: 'bold' },
    companyLink: {
        alignSelf: 'center',
        marginTop: 20,
        padding: 10
    },
    companyLinkText: { color: '#9CA3AF', fontSize: 13 },

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
    },
    // Toggle Styles
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 4,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8
    },
    toggleBtnActive: {
        backgroundColor: '#4F46E5'
    },
    toggleText: {
        color: '#9CA3AF',
        fontWeight: '600',
        fontSize: 14
    },
    toggleTextActive: {
        color: 'white'
    },
    // Validation Btn
    validateBtn: {
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderRadius: 10,
        marginLeft: 10
    },
    validateBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    }
});
