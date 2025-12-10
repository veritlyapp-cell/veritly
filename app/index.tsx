import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { ArrowRight, CheckSquare, HelpCircle, Lock, Mail, Square, UserPlus } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';
import { AppConfig } from '../constants/Config';

// --- LOGO LOCAL ---
// Apuntando a tu archivo guardado
const LocalLogo = require('../assets/images/veritly3.png');

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    // --- ESTADO PARA TERMINOS ---
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const showAlert = (title: string, msg: string) => {
        if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
        else Alert.alert(title, msg);
    };

    const handleAuth = async () => {
        // Limpiamos el email de espacios accidentales
        const cleanEmail = email.trim().toLowerCase();

        if (cleanEmail.length === 0 || password.length === 0) {
            return showAlert("Campos Vacíos", "Ingresa correo y contraseña.");
        }

        // VALIDACIÓN DE PRIVACIDAD
        if (isRegistering && !acceptedTerms) {
            return showAlert("Requerido", "Debes aceptar la Política de Privacidad para crear una cuenta.");
        }

        setLoading(true);
        try {
            if (isRegistering) {
                // Redirección inteligente: Si es nuevo, va al Perfil
                await createUserWithEmailAndPassword(auth, cleanEmail, password);
                showAlert("¡Bienvenido!", "Cuenta creada. Por favor completa tu perfil.");
                router.replace('/(tabs)/profile');
            } else {
                // Si ya existe, va al Scanner
                await signInWithEmailAndPassword(auth, cleanEmail, password);
                router.replace('/(tabs)');
            }
        } catch (error: any) {
            let msg = "Error de acceso.";
            if (error.code === 'auth/invalid-email') msg = "El correo no es válido.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') msg = "Credenciales incorrectas.";
            if (error.code === 'auth/email-already-in-use') msg = "Este correo ya existe. Inicia sesión.";
            if (error.code === 'auth/wrong-password') msg = "Contraseña incorrecta.";
            showAlert("Error", msg);
        } finally {
            setLoading(false);
        }
    };

    // --- FUNCIÓN DE RECUPERACIÓN ---
    const handleForgotPassword = async () => {
        const cleanEmail = email.trim().toLowerCase();

        if (cleanEmail.length === 0) {
            return showAlert("Falta Correo", "Escribe tu correo en el campo de arriba para enviarte el link.");
        }

        setLoading(true);
        try {
            console.log("Enviando reset a:", cleanEmail);
            await sendPasswordResetEmail(auth, cleanEmail);

            showAlert(
                "Correo Enviado 📧",
                `Hemos enviado un enlace a ${cleanEmail}.\n\nRevisa tu bandeja de entrada (y la carpeta de SPAM).`
            );
        } catch (error: any) {
            console.error("Error Reset:", error);
            let msg = error.message;
            if (error.code === 'auth/user-not-found') msg = "Este correo no está registrado.";
            if (error.code === 'auth/invalid-email') msg = "El formato del correo está mal.";
            showAlert("No se pudo enviar", msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        if (Platform.OS !== 'web') return showAlert("Aviso", "En celular, por favor usa correo y contraseña por ahora.");
        if (isRegistering && !acceptedTerms) {
            return showAlert("Requerido", "Debes aceptar la Política de Privacidad para registrarte.");
        }
        setLoading(true);
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
            router.replace('/(tabs)');
        } catch (error: any) {
            showAlert("Error Google", error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}><Image source={LocalLogo} style={styles.logoImage} resizeMode="contain" /></View>
                    <Text style={styles.title}>{isRegistering ? "CREAR CUENTA" : AppConfig.name.toUpperCase()}</Text>
                    <Text style={styles.subtitle}>{isRegistering ? `Únete a ${AppConfig.name}` : AppConfig.slogan}</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Mail color="#64748b" size={20} style={{ marginRight: 10 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Correo electrónico"
                            placeholderTextColor="#64748b"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Lock color="#64748b" size={20} style={{ marginRight: 10 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Contraseña"
                            placeholderTextColor="#64748b"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>

                    {/* CHECKBOX PRIVACIDAD (SOLO EN REGISTRO) */}
                    {isRegistering && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                            <TouchableOpacity onPress={() => setAcceptedTerms(!acceptedTerms)} style={{ padding: 5 }}>
                                {acceptedTerms ? <CheckSquare color="#3b82f6" size={24} /> : <Square color="#64748b" size={24} />}
                            </TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                                    He leído y acepto la <Text onPress={() => router.push('/privacy')} style={{ color: '#38bdf8', fontWeight: 'bold' }}>Política de Privacidad</Text> y Términos.
                                </Text>
                            </View>
                        </View>
                    )}

                    <TouchableOpacity style={styles.loginButton} onPress={handleAuth} disabled={loading}>
                        {loading ? <ActivityIndicator color="white" /> : (
                            <><Text style={styles.loginText}>{isRegistering ? "REGISTRARME" : "INICIAR SESIÓN"}</Text>{isRegistering ? <UserPlus color="white" size={20} /> : <ArrowRight color="white" size={20} />}</>
                        )}
                    </TouchableOpacity>

                    {!isRegistering && (
                        <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPassword}>
                            <HelpCircle size={14} color="#3b82f6" style={{ marginRight: 5 }} />
                            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                        </TouchableOpacity>
                    )}

                    <View style={styles.divider}><View style={styles.line} /><Text style={styles.orText}>O</Text><View style={styles.line} /></View>
                    <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} disabled={loading}><Text style={styles.googleText}>🔵  Google</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.switchButton} onPress={() => setIsRegistering(!isRegistering)}>
                        <Text style={styles.switchText}>{isRegistering ? `¿Ya tienes cuenta en ${AppConfig.name}? Inicia Sesión` : `¿Nuevo en ${AppConfig.name}? Crea una cuenta`}</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.footerText}>¿Eres empresa? <Text onPress={() => router.push('/empresa/signin')} style={{ color: '#38bdf8', fontWeight: 'bold' }}>Entrar aquí</Text></Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    content: { flex: 1, padding: 30, justifyContent: 'center' },
    header: { alignItems: 'center', marginBottom: 40 },
    logoContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255, 255, 255, 0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
    logoImage: { width: 60, height: 60 },
    title: { fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: 2, marginBottom: 5 },
    subtitle: { fontSize: 14, color: '#94a3b8', letterSpacing: 0.5 },
    form: { width: '100%' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
    input: { flex: 1, color: 'white', fontSize: 16 },
    loginButton: { backgroundColor: '#3b82f6', flexDirection: 'row', height: 55, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 15, gap: 10 },
    loginText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10 },
    line: { flex: 1, height: 1, backgroundColor: '#334155' },
    orText: { color: '#64748b', marginHorizontal: 10, fontSize: 12 },
    googleButton: { backgroundColor: 'white', height: 55, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    googleText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
    switchButton: { alignItems: 'center', padding: 10 },
    switchText: { color: '#cbd5e1', fontSize: 14, textDecorationLine: 'underline' },
    forgotButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 5, marginBottom: 10 },
    forgotText: { color: '#3b82f6', fontSize: 14 },
    footerText: { textAlign: 'center', color: '#64748b', marginTop: 40, fontSize: 14 }
});