import { useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, getRedirectResult, GoogleAuthProvider, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { ArrowRight, CheckSquare, Lock, Mail, Square } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import AppHeader from '../components/AppHeader';
import { auth } from '../config/firebase';
import { trackDailyLogin, trackStat } from '../utils/analytics';

const LocalLogo = require('../assets/images/veritly3.png');
const HeroImage = require('../assets/images/friendly_hero.png');

// Helper to detect mobile browser
const isMobileBrowser = () => {
  if (Platform.OS !== 'web') return false;
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
};

export default function AuthScreen() {
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

  // Handle Google redirect result (for mobile browsers)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleRedirectResult = async () => {
        try {
          const result = await getRedirectResult(auth);
          if (result?.user) {
            console.log("✅ Google Redirect Result:", result.user.email);
            trackDailyLogin();
            Alert.alert('¡Bienvenido!', `Hola ${result.user.displayName || 'Usuario'}, bienvenido a Veritly.`);
            router.replace('/(tabs)/profile');
          }
        } catch (error: any) {
          console.error("Google Redirect Error:", error);
          if (error.code !== 'auth/popup-closed-by-user') {
            Alert.alert('Error de Google', error.message || 'No se pudo iniciar sesión.');
          }
        }
      };
      handleRedirectResult();
    }
  }, []);

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
    if (!email || !password) {
      return showAlert('Campos Vacíos', 'Por favor completa todos los campos');
    }

    if (emailError) {
      return showAlert('Email Inválido', 'Por favor ingresa un correo electrónico válido');
    }

    if (isRegistering && !acceptedTerms) {
      return showAlert('Requerido', 'Debes aceptar la Política de Privacidad para crear tu cuenta.');
    }

    setLoading(true);
    try {
      if (isRegistering) {
        console.log('📝 Creando cuenta para:', email);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);

        // --- TRACKING METRICS ---
        trackStat('totalUsers');
        // ------------------------

        console.log('✅ Cuenta creada y verificación enviada');
        showAlert('¡Bienvenido!', 'Tu cuenta ha sido creada. Hemos enviado un link a tu correo para verificar tu cuenta.');
        setTimeout(() => {
          router.replace('/(tabs)/profile');
        }, 1500);
      } else {
        console.log('🔐 Intentando login con:', email);
        await signInWithEmailAndPassword(auth, email, password);

        // --- TRACKING METRICS ---
        trackDailyLogin();
        // ------------------------

        console.log('✅ Login exitoso');
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
      }
    } catch (error: any) {
      console.error('❌ Error en auth:', error);
      let errorMessage = 'Ocurrió un error. Intenta de nuevo.';

      if (error.code === 'auth/email-already-in-use') errorMessage = 'Este correo ya está registrado.';
      if (error.code === 'auth/invalid-email') errorMessage = 'Correo electrónico no válido.';
      if (error.code === 'auth/weak-password') errorMessage = 'La contraseña es muy débil (mínimo 6 caracteres).';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') errorMessage = 'Correo o contraseña incorrectos.';

      showAlert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (providerName: string) => {
    if (providerName === 'Google') {
      if (Platform.OS === 'web') {
        try {
          const provider = new GoogleAuthProvider();

          // Use redirect for mobile browsers (popups don't work well)
          if (isMobileBrowser()) {
            console.log("📱 Mobile browser detected - using redirect flow");
            await signInWithRedirect(auth, provider);
            // The result will be handled by the useEffect with getRedirectResult
            return;
          }

          // Use popup for desktop browsers
          console.log("🖥️ Desktop browser - using popup flow");
          const result = await signInWithPopup(auth, provider);
          if (result.user) {
            console.log("✅ Google Auth Success:", result.user.email);
            trackDailyLogin();
            Alert.alert('¡Bienvenido!', `Hola ${result.user.displayName || 'Candidato'}, completa tu perfil para comenzar.`);
            router.replace('/(tabs)/profile');
          }
        } catch (error: any) {
          console.error("Google Auth Error:", error);
          if (error.code === 'auth/popup-closed-by-user') return;
          Alert.alert('Error de Google', error.message || 'No se pudo iniciar sesión.');
        }
      } else {
        // Native mobile app - not implemented yet
        Alert.alert('Pendiente', 'Google Sign-In para la app nativa estará disponible pronto.');
      }
      return;
    }
    showAlert('Próximamente', `El inicio de sesión con ${providerName} estará disponible muy pronto.`);
  };

  const handleResetPassword = async () => {
    console.log("🔘 Reset Password Clicked", email);
    if (!email) {
      if (Platform.OS === 'web') {
        window.alert('Por favor ingresa tu correo electrónico primero.');
      } else {
        Alert.alert('Email requerido', 'Por favor ingresa tu correo electrónico para restablecer la contraseña.');
      }
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      const msg = `Se ha enviado un enlace de recuperación a ${email}. Revisa tu bandeja de entrada (y spam).`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Correo enviado', msg);
      }
    } catch (error: any) {
      console.error("Reset Password Error:", error);
      const errorMsg = error.message || 'No se pudo enviar el correo.';
      if (Platform.OS === 'web') {
        window.alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Mobile-only Header */}
      {!isDesktop && (
        <AppHeader showAuthButtons={false} showBackButton={true} title={isRegistering ? "REGISTRO" : "LOGIN"} />
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
              <Text style={styles.title}>{isRegistering ? "Crear una Cuenta" : "Bienvenido de nuevo"}</Text>
              <Text style={styles.subtitle}>
                {isRegistering
                  ? "Únete a Veritly y potencia tu carrera profesional con IA."
                  : "Ingresa tus datos para acceder a tu panel."}
              </Text>

              {/* Form Inputs */}
              <View style={styles.inputsStack}>
                <View>
                  <Text style={styles.label}>Correo Electrónico</Text>
                  <View style={[styles.inputGroup, emailError && styles.inputError]}>
                    <Mail color={emailError ? "#ef4444" : "#94a3b8"} size={20} />
                    <TextInput
                      style={styles.input}
                      placeholder="nombre@ejemplo.com"
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
                  {!isRegistering && (
                    <TouchableOpacity onPress={handleResetPassword} style={{ marginTop: 8, alignSelf: 'flex-end', padding: 10 }}>
                      <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: '500' }}>¿Olvidaste tu contraseña?</Text>
                    </TouchableOpacity>
                  )}
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
                    ? <CheckSquare color="#3b82f6" size={22} />
                    : <Square color="#475569" size={22} />
                  }
                  <Text style={styles.termsText}>
                    Acepto los <Text style={styles.linkText} onPress={() => router.push('/privacy')}>Términos y Condiciones y Política de Privacidad</Text>
                  </Text>
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
                      {isRegistering ? "Crear Cuenta" : "Iniciar Sesión"}
                    </Text>
                    <ArrowRight color="white" size={20} />
                  </>
                )}
              </TouchableOpacity>

              {/* Social Login */}
              <View style={styles.socialSection}>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>O continúa con</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialButtons}>
                  <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocialLogin('Google')}>
                    <Svg width={20} height={20} viewBox="0 0 48 48">
                      <Path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <Path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <Path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <Path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <Path fill="none" d="M0 0h48v48H0z" />
                    </Svg>
                    <Text style={styles.socialBtnText}>Google</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Mode Toggle */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {isRegistering ? "¿Ya tienes una cuenta?" : "¿No tienes cuenta aún?"}
                </Text>
                <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
                  <Text style={styles.footerLink}>
                    {isRegistering ? " Inicia Sesión" : " Regístrate"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.companyLink}>
                <Text style={[styles.companyLinkText, { color: '#94a3b8' }]}>¿Eres empresa? </Text>
                <Text style={[styles.companyLinkText, { color: '#10b981', fontWeight: 'bold' }]}>Muy Pronto: Antes de contratar, Veritly</Text>
              </View>

            </Animated.View>
          </View>
        </View>

        {/* RIGHT PANEL: BRANDING (Desktop Only) */}
        {
          isDesktop && (
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
                  <Text style={[styles.brandDesc, { fontSize: 14, color: '#38bdf8', fontWeight: 'bold', marginBottom: 20 }]}>✨ Antes de postular, Veritly</Text>
                  <Text style={styles.brandTitle}>Coach de Carrera IA</Text>
                  <Text style={styles.brandDesc}>
                    Optimiza tu CV, practica entrevistas y consigue el trabajo que realmente encaja contigo.
                  </Text>

                  <View style={styles.featurePill}>
                    <CheckSquare color="#10b981" size={16} />
                    <Text style={styles.featureText}>Análisis de CV con IA</Text>
                  </View>
                  <View style={styles.featurePill}>
                    <CheckSquare color="#10b981" size={16} />
                    <Text style={styles.featureText}>Match Perfecto</Text>
                  </View>
                  <View style={styles.featurePill}>
                    <CheckSquare color="#10b981" size={16} />
                    <Text style={styles.featureText}>Feedback Instantáneo</Text>
                  </View>
                </View>
              </View>
            </View>
          )
        }

      </View >
    </SafeAreaView >
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
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
  linkText: { color: '#38bdf8', fontWeight: '600' },

  // Forgot Password
  forgotPass: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotPassText: { color: '#38bdf8', fontSize: 14, fontWeight: '500' },

  // Buttons
  primaryButton: {
    backgroundColor: '#3b82f6',
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    shadowColor: '#3b82f6',
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
  footerLink: { color: '#38bdf8', fontWeight: 'bold' },
  companyLink: {
    alignSelf: 'center',
    marginTop: 20,
    padding: 10
  },
  companyLinkText: { color: '#64748b', fontSize: 13 },

  // RIGHT PANEL (Desktop)
  brandPanel: {
    flex: 0.55,
    backgroundColor: '#0b1120',
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
    backgroundColor: 'rgba(15, 23, 42, 0.7)', // Dark overlay
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
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 40
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 100,
    marginBottom: 12,
    gap: 10,
    width: '100%'
  },
  featureText: {
    color: '#e2e8f0',
    fontWeight: '500'
  }
});