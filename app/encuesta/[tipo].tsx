import { addDoc, collection } from 'firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebase';

// Encuesta corta enviada manualmente (WhatsApp/email) a clientes puntuales --
// no es un formulario abierto en la navegacion del sitio. 'activo' = ya publico
// vacantes y uso el match de IA; 'inactivo' = se registro pero nunca publico.
type Tipo = 'activo' | 'inactivo';

const QUESTIONS: Record<Tipo, { key: string; label: string; placeholder: string }[]> = {
    activo: [
        { key: 'motivo', label: '¿Qué te hizo probar Veritly en primer lugar?', placeholder: 'Ej: estaba cansado de manejar candidatos por Excel/WhatsApp...' },
        { key: 'lo_mejor', label: '¿Qué es lo que más te ha gustado de la experiencia?', placeholder: 'Ej: el filtro automático, el match con IA...' },
        { key: 'mejorar', label: '¿Qué le falta o qué mejorarías?', placeholder: 'Sé honesto/a, nos ayuda mucho' },
        { key: 'comentario', label: '¿Algo más que quieras contarnos?', placeholder: 'Opcional' },
    ],
    inactivo: [
        { key: 'motivo_registro', label: '¿Qué te hizo registrarte en Veritly?', placeholder: 'Ej: vi un anuncio, me lo recomendaron...' },
        { key: 'que_freno', label: '¿Qué te detuvo para publicar tu primera vacante?', placeholder: 'Sé honesto/a, no hay respuesta incorrecta' },
        { key: 'herramienta_actual', label: '¿Qué usas hoy para reclutar?', placeholder: 'Ej: Excel, WhatsApp, otro ATS, papel...' },
        { key: 'que_necesitarias', label: '¿Qué necesitarías para darle una oportunidad?', placeholder: 'Opcional' },
    ],
};

const NPS_QUESTION = 'Del 0 al 10, ¿qué tan probable es que recomiendes Veritly a otro reclutador?';

export default function EncuestaScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const tipoParam = (Array.isArray(params.tipo) ? params.tipo[0] : params.tipo) || '';
    const tipo: Tipo = tipoParam === 'activo' ? 'activo' : 'inactivo';
    const prefillName = (Array.isArray(params.n) ? params.n[0] : params.n) || '';
    const prefillEmail = (Array.isArray(params.e) ? params.e[0] : params.e) || '';

    const [nombre, setNombre] = useState(prefillName);
    const [email, setEmail] = useState(prefillEmail);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [nps, setNps] = useState<number | null>(tipo === 'activo' ? null : -1); // -1 = n/a para inactivos
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const questions = QUESTIONS[tipo];

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await addDoc(collection(db, 'surveys'), {
                tipo,
                nombre: nombre.trim() || null,
                email: email.trim().toLowerCase() || null,
                respuestas: answers,
                nps: tipo === 'activo' ? nps : null,
                createdAt: new Date().toISOString(),
            });
            setSubmitted(true);
        } catch (e) {
            console.error('Error enviando encuesta:', e);
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.thanksWrap}>
                    <CheckCircle2 color="#10B981" size={56} />
                    <Text style={styles.thanksTitle}>¡Gracias por tu tiempo!</Text>
                    <Text style={styles.thanksSubtitle}>Tu respuesta nos ayuda muchísimo a mejorar Veritly.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft color="#111827" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Encuesta rápida</Text>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={styles.title}>
                        {tipo === 'activo' ? 'Nos encantaría saber tu experiencia' : 'Nos encantaría saber qué pasó'}
                    </Text>
                    <Text style={styles.intro}>
                        Son 4 preguntas cortas, no toma más de 2 minutos. Tu respuesta va directo al equipo de Veritly.
                    </Text>

                    <View style={styles.field}>
                        <Text style={styles.label}>Nombre</Text>
                        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Tu nombre" placeholderTextColor="#9CA3AF" />
                    </View>
                    <View style={styles.field}>
                        <Text style={styles.label}>Correo</Text>
                        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="tu@correo.com" placeholderTextColor="#9CA3AF" autoCapitalize="none" keyboardType="email-address" />
                    </View>

                    {questions.map(q => (
                        <View style={styles.field} key={q.key}>
                            <Text style={styles.label}>{q.label}</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={answers[q.key] || ''}
                                onChangeText={(v) => setAnswers(prev => ({ ...prev, [q.key]: v }))}
                                placeholder={q.placeholder}
                                placeholderTextColor="#9CA3AF"
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                        </View>
                    ))}

                    {tipo === 'activo' && (
                        <View style={styles.field}>
                            <Text style={styles.label}>{NPS_QUESTION}</Text>
                            <View style={styles.npsRow}>
                                {Array.from({ length: 11 }, (_, i) => i).map(n => (
                                    <TouchableOpacity
                                        key={n}
                                        style={[styles.npsBtn, nps === n && styles.npsBtnActive]}
                                        onPress={() => setNps(n)}
                                    >
                                        <Text style={[styles.npsBtnText, nps === n && styles.npsBtnTextActive]}>{n}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Enviar respuesta</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backButton: { padding: 5, marginRight: 10 },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    content: { padding: 20, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
    intro: { fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 19 },
    field: { marginBottom: 18 },
    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: '#111827',
        backgroundColor: '#F9FAFB',
    },
    textArea: { height: 90 },
    npsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    npsBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
    },
    npsBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    npsBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
    npsBtnTextActive: { color: 'white' },
    submitBtn: {
        backgroundColor: '#4F46E5',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    thanksWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    thanksTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginTop: 16 },
    thanksSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
});
