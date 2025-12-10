import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppConfig } from '../constants/Config';

export default function PrivacyScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft color="white" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Legales</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Política de Privacidad y Términos de Uso</Text>
                <Text style={styles.date}>Última actualización: Diciembre 2025</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Introducción</Text>
                    <Text style={styles.text}>
                        Bienvenido a {AppConfig.name}. Nos tomamos muy en serio la privacidad de tus datos y la confianza que depositas en nosotros.
                        Esta política describe cómo recopilamos, usamos y protegemos tu información personal y profesional al utilizar nuestros servicios de análisis de talento con IA.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Recopilación de Datos</Text>
                    <Text style={styles.text}>
                        Recopilamos información que nos proporcionas directamente, como tu nombre, dirección de correo electrónico, historial laboral,
                        y los documentos (CVs, descripciones de puesto) que subes a la plataforma para su análisis.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Uso de la Información</Text>
                    <Text style={styles.text}>
                        Utilizamos la información recopilada para:
                        {'\n'}• Proveer y mejorar nuestros servicios de análisis y matcheo.
                        {'\n'}• Procesar tus documentos mediante algoritmos de Inteligencia Artificial (Google Gemini).
                        {'\n'}• Comunicarnos contigo sobre actualizaciones, seguridad y soporte.
                        {'\n'}• Cumplir con obligaciones legales.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Protección de Datos</Text>
                    <Text style={styles.text}>
                        Implementamos medidas de seguridad técnicas y organizativas para proteger tus datos contra el acceso no autorizado, la pérdida o la alteración.
                        No vendemos tus datos personales a terceros.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Términos y Condiciones</Text>
                    <Text style={styles.text}>
                        Al utilizar {AppConfig.name}, aceptas cumplir con estos términos. El uso indebido de la plataforma, como la carga de contenido ilegal
                        o intentos de ingeniería inversa, resultará en la terminación de tu cuenta.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>6. Contacto</Text>
                    <Text style={styles.text}>
                        Si tienes preguntas sobre esta política, contáctanos a través de nuestros canales oficiales de soporte o legal@vinku.app.
                    </Text>
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155' },
    backButton: { padding: 8, marginRight: 10 },
    headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
    title: { fontSize: 24, fontWeight: '900', color: 'white', marginBottom: 10 },
    date: { color: '#94a3b8', fontSize: 14, marginBottom: 30, fontStyle: 'italic' },
    section: { marginBottom: 25 },
    sectionTitle: { color: '#38bdf8', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    text: { color: '#cbd5e1', fontSize: 15, lineHeight: 24, textAlign: 'justify' }
});
