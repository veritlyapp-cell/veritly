import { ArrowLeft, Sparkles } from 'lucide-react-native';
import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

// "Talent Insights" original leía el perfil completo (CV, email, teléfono) de
// TODOS los candidatos de la plataforma para calcular estadísticas agregadas,
// sin filtrar por empresa — exponiendo datos de candidatos que nunca postularon
// a quien abriera esta pantalla. Se reemplaza por un placeholder hasta que se
// rediseñe con datos agregados calculados en el servidor (no en el navegador
// de cada empresa). El embudo por empresa (postulados, rechazados, salarios)
// ya vive en indicadores.tsx, que sí está correctamente filtrado por companyId.
export default function TalentInsightsDashboard() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color="#38bdf8" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Talent Insights</Text>
            </View>
            <View style={styles.body}>
                <Sparkles color="#38bdf8" size={40} />
                <Text style={styles.title}>Próximamente</Text>
                <Text style={styles.subtitle}>
                    Estamos rediseñando esta vista para mostrarte tendencias de talento del mercado
                    sin comprometer la privacidad de los candidatos. Mientras tanto, puedes ver el
                    embudo detallado de tus propias vacantes en Indicadores.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(56,189,248,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: 'white' },
    body: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        gap: 12,
    },
    title: { fontSize: 20, fontWeight: '700', color: 'white' },
    subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
});
