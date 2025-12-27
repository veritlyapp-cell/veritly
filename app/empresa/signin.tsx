import { useRouter } from 'expo-router';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { ArrowRight, CheckSquare, HelpCircle, Lock, Mail, Square, UserPlus } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../config/firebase';
import { createCompanyUser } from '../../services/auth-service';

// --- LOGO LOCAL ---
const LocalLogo = require('../../assets/images/veritly3.png');

export default function CompanySignIn() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const showAlert = (title: string, msg: string) => {
        if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
        else Alert.alert(title, msg);
    };

    const handleAuth = async () => {
        const cleanEmail = email.trim().toLowerCase();
        if (cleanEmail.length === 0 || password.length === 0) return showAlert("Campos Vacíos", "Ingresa correo y contraseña.");

        if (isRegistering && !acceptedTerms) return showAlert("Requerido", "Acepta la Política de Privacidad para registrarte.");

        setLoading(true);
        try {
            if (isRegistering) {
                // REGISTRO EMPRESA - Crea usuario en Auth Y Firestore con rol 'empresa'
                await createCompanyUser(cleanEmail, password);
                showAlert("¡Bienvenido!", "Cuenta de empresa creada.");
                // Redirigir a onboarding para completar perfil
                router.replace('/empresa/dashboard/onboarding');
            } else {
                // LOGIN EMPRESA
                await signInWithEmailAndPassword(auth, cleanEmail, password);
                router.replace('/empresa/dashboard');
            }
        } catch (error: any) {
            let msg = "Error de acceso.";
            if (error.code === 'auth/invalid-email') msg = "El correo no es válido.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') msg = "Credenciales incorrectas.";
            if (error.code === 'auth/email-already-in-use') msg = "Este correo ya existe.";
            showAlert("Error", msg);
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

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}><Image source={LocalLogo} style={styles.logoImage} resizeMode="contain" /></View>
                    <Text style={styles.title}>{isRegistering ? "NUEVA EMPRESA" : "ACCESO EMPRESAS"}</Text>
                    <Text style={styles.subtitle}>{isRegistering ? "Crea tu cuenta corporativa" : "Gestiona tus vacantes con IA"}</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Mail color="#64748b" size={20} style={{ marginRight: 10 }} />
                        <TextInput style={styles.input} placeholder="Correo Corporativo" placeholderTextColor="#64748b" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                    </View>
                    <View style={styles.inputContainer}>
                        <Lock color="#64748b" size={20} style={{ marginRight: 10 }} />
                        <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor="#64748b" secureTextEntry value={password} onChangeText={setPassword} />
                    </View>

                    {isRegistering && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                            <TouchableOpacity onPress={() => setAcceptedTerms(!acceptedTerms)} style={{ padding: 5 }}>
                                {acceptedTerms ? <CheckSquare color="#3b82f6" size={24} /> : <Square color="#64748b" size={24} />}
                            </TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                                    Acepto la <Text onPress={() => router.push('/privacy')} style={{ color: '#38bdf8', fontWeight: 'bold' }}>Política de Privacidad</Text>.
                                </Text>
                            </View>
                        </View>
                    )}

                    <TouchableOpacity style={styles.loginButton} onPress={handleAuth} disabled={loading}>
                        {loading ? <ActivityIndicator color="white" /> : (
                            <><Text style={styles.loginText}>{isRegistering ? "REGISTRAR EMPRESA" : "ENTRAR AL PANEL"}</Text>{isRegistering ? <UserPlus color="white" size={20} /> : <ArrowRight color="white" size={20} />}</>
                        )}
                    </TouchableOpacity>

                    {!isRegistering && (
                        <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPassword}>
                            <HelpCircle size={14} color="#3b82f6" style={{ marginRight: 5 }} />
                            <Text style={styles.forgotText}>¿Olvidaste la contraseña?</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.switchButton} onPress={() => setIsRegistering(!isRegistering)}>
                        <Text style={styles.switchText}>{isRegistering ? "¿Ya tienes cuenta? Inicia Sesión" : "¿Nueva empresa? Regístrate aquí"}</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.footerText}>¿Buscas empleo? <Text onPress={() => router.replace('/')} style={{ color: '#38bdf8', fontWeight: 'bold' }}>Ir a Candidatos</Text></Text>
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
    subtitle: { fontSize: 14, color: '#94a3b8' },
    form: { width: '100%' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
    input: { flex: 1, color: 'white', fontSize: 16 },
    loginButton: { backgroundColor: '#3b82f6', flexDirection: 'row', height: 55, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 15, gap: 10 },
    loginText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    switchButton: { alignItems: 'center', padding: 10, marginTop: 10 },
    switchText: { color: '#cbd5e1', fontSize: 14, textDecorationLine: 'underline' },
    forgotButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 5, marginBottom: 10 },
    forgotText: { color: '#3b82f6', fontSize: 14 },
    footerText: { textAlign: 'center', color: '#64748b', marginTop: 40, fontSize: 14 }
});
