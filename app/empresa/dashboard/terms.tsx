import { useRouter } from 'expo-router';
import { ChevronLeft, FileText, Shield, Scale } from 'lucide-react-native';
import React from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TermsScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft color="white" size={24} />
                    <Text style={styles.backButtonText}>Volver</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Términos y Condiciones</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <View style={styles.sectionIcon}>
                        <Scale color="#38bdf8" size={32} />
                    </View>
                    
                    <Text style={styles.updateDate}>Última actualización: 04 de Abril, 2026</Text>

                    <Text style={styles.sectionTitle}>1. Aceptación de los Términos</Text>
                    <Text style={styles.paragraph}>
                        Al acceder y utilizar la plataforma Veritly, usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no podrá acceder al servicio.
                    </Text>

                    <Text style={styles.sectionTitle}>2. Uso de la Inteligencia Artificial</Text>
                    <Text style={styles.paragraph}>
                        Veritly utiliza modelos de IA (Gemini 2.5 Flash) para el análisis de perfiles. Usted reconoce que los resultados son sugerencias automatizadas y deben ser validados por un profesional de RRHH. Veritly no se hace responsable de decisiones de contratación finales.
                    </Text>

                    <Text style={styles.sectionTitle}>3. Suscripciones y Pagos</Text>
                    <Text style={styles.paragraph}>
                        Los planes Pro y Gold se facturan mensualmente o anualmente según su elección. Los pagos se procesan a través de Stripe. No se realizan reembolsos por periodos parciales de uso.
                    </Text>

                    <Text style={styles.sectionTitle}>4. Protección de Datos (Perú)</Text>
                    <Text style={styles.paragraph}>
                        Cumplimos con la Ley N° 29733 (Ley de Protección de Datos Personales en Perú). Los datos de los candidatos cargados son de propiedad de la empresa contratante y Veritly actúa solo como encargado del tratamiento.
                    </Text>

                    <Text style={styles.sectionTitle}>5. Límites de Consumo</Text>
                    <Text style={styles.paragraph}>
                        Cada plan tiene límites específicos de procesamiento de candidatos. Al superar el límite, se deberá realizar un upgrade de plan para continuar con el análisis masivo.
                    </Text>

                    <Text style={styles.sectionTitle}>6. Contacto</Text>
                    <Text style={styles.paragraph}>
                        Para cualquier duda legal, puede contactar a soporte@veritly.app
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#1E293B',
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
    },
    backButtonText: {
        color: 'white',
        fontSize: 14,
        marginLeft: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    scrollContent: {
        padding: 20,
    },
    card: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#334155',
    },
    sectionIcon: {
        alignItems: 'center',
        marginBottom: 20,
    },
    updateDate: {
        color: '#94a3b8',
        fontSize: 12,
        marginBottom: 24,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#38bdf8',
        marginTop: 24,
        marginBottom: 12,
    },
    paragraph: {
        fontSize: 14,
        color: '#cbd5e1',
        lineHeight: 22,
        marginBottom: 8,
    },
});
