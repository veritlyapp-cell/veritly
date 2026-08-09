import { useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { CheckCircle2, Lock, Mail, User, XCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../../config/firebase';

export default function AcceptInvite() {
    const { code } = useLocalSearchParams();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [role, setRole] = useState<'admin' | 'reclutador'>('reclutador');

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const loadPreview = async () => {
            try {
                const res = await fetch('/.netlify/functions/team', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'preview_invite', code })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Invitación inválida');
                setCompanyName(data.companyName);
                setRole(data.role);
                if (data.email) setEmail(data.email);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        if (code) loadPreview();
    }, [code]);

    const handleAccept = async () => {
        if (!name.trim()) return setSubmitError('Ingresa tu nombre.');
        if (!email.trim()) return setSubmitError('Ingresa tu correo.');
        if (password.length < 6) return setSubmitError('La contraseña debe tener al menos 6 caracteres.');

        setSubmitError('');
        setSubmitting(true);
        try {
            // 1. Crear (o iniciar sesión si ya existe) la cuenta de Firebase Auth
            let userCredential;
            try {
                userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            } catch (e: any) {
                if (e.code === 'auth/email-already-in-use') {
                    userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
                } else {
                    throw e;
                }
            }

            const idToken = await userCredential.user.getIdToken();

            // 2. Confirmar la invitación en el backend (crea el documento de equipo)
            const res = await fetch('/.netlify/functions/team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'accept_invite', code, idToken, name: name.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo aceptar la invitación');

            setSuccess(true);
            setTimeout(() => router.replace('/empresa/dashboard'), 1500);
        } catch (e: any) {
            setSubmitError(e.message || 'Ocurrió un error inesperado.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator color="#38bdf8" size="large" />
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
                <View style={styles.centerBox}>
                    <XCircle color="#ef4444" size={48} />
                    <Text style={styles.errorTitle}>Invitación no disponible</Text>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (success) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
                <View style={styles.centerBox}>
                    <CheckCircle2 color="#10b981" size={48} />
                    <Text style={styles.errorTitle}>¡Listo!</Text>
                    <Text style={styles.errorText}>Te uniste al equipo. Entrando a tu dashboard...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <View style={styles.card}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Text style={styles.logoText}>Veritly</Text>
                </View>

                <Text style={styles.title}>Te invitaron a unirte</Text>
                <Text style={styles.subtitle}>
                    <Text style={{ fontWeight: '700', color: 'white' }}>{companyName}</Text> te invitó como{' '}
                    <Text style={{ fontWeight: '700', color: '#38bdf8' }}>{role === 'admin' ? 'Admin' : 'Reclutador'}</Text> en Veritly.
                </Text>

                <View style={styles.inputGroup}>
                    <User size={18} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Tu nombre completo"
                        placeholderTextColor="#64748b"
                        value={name}
                        onChangeText={setName}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Mail size={18} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="tu@correo.com"
                        placeholderTextColor="#64748b"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Lock size={18} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Crea una contraseña"
                        placeholderTextColor="#64748b"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                {submitError ? <Text style={styles.errorInline}>{submitError}</Text> : null}

                <TouchableOpacity style={styles.button} onPress={handleAccept} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Unirme al equipo</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 20 },
    centerBox: { alignItems: 'center', gap: 10, maxWidth: 320 },
    errorTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginTop: 10 },
    errorText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
    card: { width: '100%', maxWidth: 400, backgroundColor: '#1e293b', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#334155' },
    logoText: { color: '#38bdf8', fontSize: 22, fontWeight: '800' },
    title: { color: 'white', fontSize: 20, fontWeight: '700', marginBottom: 8 },
    subtitle: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginBottom: 24 },
    inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155', marginBottom: 12, paddingHorizontal: 12 },
    inputIcon: { marginRight: 8 },
    input: { flex: 1, color: 'white', paddingVertical: 12, fontSize: 14 },
    errorInline: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
    button: { backgroundColor: '#4F46E5', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
    buttonText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
