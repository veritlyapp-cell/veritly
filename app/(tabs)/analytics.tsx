import { useRouter } from 'expo-router';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { BarChart2, Building2, ExternalLink, Lock, RefreshCw, ShieldAlert, Users, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../config/firebase';

// --- CONFIGURACIÓN DE SEGURIDAD ---
const ADMIN_EMAILS = ['test+1@gmail.com', 'oscar@veritlyapp.com', 'oscar@relielabs.com'];

// URLs externas
const GA_URL = 'https://analytics.google.com/analytics/web/#/p451066061/reports/dashboard?r=firebase-overview';
const SENTRY_URL = 'https://relie-labs.sentry.io/projects/veritly/';

interface Stats {
    totalCandidatos: number;
    totalEmpresas: number;
    totalJobProfiles: number;
    totalUsuarios: number;
    totalAnalisis: number;
    loading: boolean;
}

interface WeeklyData {
    week: string;
    usuarios: number;
    analisis: number;
}

export default function AnalyticsScreen() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<Stats>({
        totalCandidatos: 0,
        totalEmpresas: 0,
        totalJobProfiles: 0,
        totalUsuarios: 0,
        totalAnalisis: 0,
        loading: true
    });
    const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        const user = auth.currentUser;
        if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
            setIsAdmin(true);
            await loadRealStats();
        } else {
            setIsAdmin(false);
        }
        setLoading(false);
    };

    // Cargar estadísticas REALES de Firestore
    const loadRealStats = async () => {
        try {
            setRefreshing(true);

            // Conteo real de candidatos
            const candidatosSnapshot = await getDocs(collection(db, 'users_candidatos'));
            const totalCandidatos = candidatosSnapshot.size;

            // Conteo real de empresas
            const empresasSnapshot = await getDocs(collection(db, 'users_empresas'));
            const totalEmpresas = empresasSnapshot.size;

            // Conteo real de job profiles
            const jobsSnapshot = await getDocs(collection(db, 'job_profiles'));
            const totalJobProfiles = jobsSnapshot.size;

            // Total de usuarios (candidatos + empresas)
            const totalUsuarios = totalCandidatos + totalEmpresas;

            // Contar análisis totales de todas las subcolecciones de candidates
            let totalAnalisis = 0;
            try {
                const candidatesGroup = await getDocs(collectionGroup(db, 'candidates'));
                totalAnalisis = candidatesGroup.size;
            } catch (e) {
                console.log('Error counting analyses, trying users history...', e);
                // Fallback: count from users.history
                const usersSnapshot = await getDocs(collection(db, 'users'));
                usersSnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.history && Array.isArray(data.history)) {
                        totalAnalisis += data.history.length;
                    }
                });
            }

            // Generate weekly data from users_candidatos createdAt
            const weeklyStats = generateWeeklyStats(candidatosSnapshot.docs, empresasSnapshot.docs);
            setWeeklyData(weeklyStats);

            setStats({
                totalCandidatos,
                totalEmpresas,
                totalJobProfiles,
                totalUsuarios,
                totalAnalisis,
                loading: false
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setRefreshing(false);
        }
    };

    // Generate weekly stats from user docs
    const generateWeeklyStats = (candidatoDocs: any[], empresaDocs: any[]): WeeklyData[] => {
        const weeks: { [key: string]: { usuarios: number; analisis: number } } = {};

        // Get last 6 weeks
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - (i * 7));
            const weekKey = getWeekKey(date);
            weeks[weekKey] = { usuarios: 0, analisis: 0 };
        }

        // Count users by week
        candidatoDocs.forEach((doc) => {
            const data = doc.data();
            if (data.createdAt) {
                const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                const weekKey = getWeekKey(date);
                if (weeks[weekKey]) {
                    weeks[weekKey].usuarios++;
                }
            }
        });

        empresaDocs.forEach((doc) => {
            const data = doc.data();
            if (data.createdAt) {
                const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                const weekKey = getWeekKey(date);
                if (weeks[weekKey]) {
                    weeks[weekKey].usuarios++;
                }
            }
        });

        return Object.entries(weeks).map(([week, data]) => ({
            week,
            usuarios: data.usuarios,
            analisis: data.analisis
        }));
    };

    const getWeekKey = (date: Date): string => {
        const month = date.toLocaleString('es', { month: 'short' });
        const day = date.getDate();
        return `${day} ${month}`;
    };

    const openExternalLink = (url: string) => {
        if (Platform.OS === 'web') {
            window.open(url, '_blank');
        } else {
            Linking.openURL(url);
        }
    };

    // Simple bar chart component
    const SimpleBarChart = ({ data }: { data: WeeklyData[] }) => {
        const maxValue = Math.max(...data.map(d => d.usuarios), 1);
        const chartHeight = 120;

        return (
            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>📈 Nuevos Usuarios por Semana</Text>
                <View style={styles.chart}>
                    {data.map((item, index) => (
                        <View key={index} style={styles.barContainer}>
                            <View style={styles.barWrapper}>
                                <View
                                    style={[
                                        styles.bar,
                                        {
                                            height: Math.max((item.usuarios / maxValue) * chartHeight, 4),
                                        }
                                    ]}
                                />
                                <Text style={styles.barValue}>{item.usuarios}</Text>
                            </View>
                            <Text style={styles.barLabel}>{item.week}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#10b981" />
                </View>
            </SafeAreaView>
        );
    }

    if (!isAdmin) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <Lock size={64} color="#64748b" />
                    <Text style={styles.lockedTitle}>Acceso Restringido</Text>
                    <Text style={styles.lockedText}>
                        Esta sección es exclusiva para administradores de Veritly.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Super Admin</Text>
                    <Text style={styles.subtitle}>Panel de Control</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={loadRealStats}
                        disabled={refreshing}
                        style={styles.refreshBtn}
                    >
                        <RefreshCw color="#10b981" size={18} style={refreshing ? { opacity: 0.5 } : {}} />
                    </TouchableOpacity>
                    <ShieldAlert color="#10b981" size={24} />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* MAIN STATS - Total Usuarios y Análisis */}
                <Text style={styles.sectionTitle}>🎯 Métricas Principales</Text>
                <View style={styles.mainStatsGrid}>
                    <View style={[styles.mainStatCard, { backgroundColor: '#1e3a5f' }]}>
                        <View style={styles.mainStatIcon}>
                            <Users color="#38bdf8" size={32} />
                        </View>
                        <Text style={styles.mainStatNumber}>{stats.totalUsuarios}</Text>
                        <Text style={styles.mainStatLabel}>Total Usuarios</Text>
                        <Text style={styles.mainStatSubtext}>
                            {stats.totalCandidatos} candidatos · {stats.totalEmpresas} empresas
                        </Text>
                    </View>

                    <View style={[styles.mainStatCard, { backgroundColor: '#3d1f5c' }]}>
                        <View style={styles.mainStatIcon}>
                            <Zap color="#a855f7" size={32} />
                        </View>
                        <Text style={styles.mainStatNumber}>{stats.totalAnalisis}</Text>
                        <Text style={styles.mainStatLabel}>Total Análisis</Text>
                        <Text style={styles.mainStatSubtext}>
                            CVs analizados con IA
                        </Text>
                    </View>
                </View>

                {/* WEEKLY CHART */}
                {weeklyData.length > 0 && <SimpleBarChart data={weeklyData} />}

                {/* DETAILED STATS */}
                <Text style={styles.sectionTitle}>📊 Detalle por Categoría</Text>
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Users color="#3b82f6" size={28} />
                        <Text style={styles.statNumber}>{stats.totalCandidatos}</Text>
                        <Text style={styles.statLabel}>Candidatos</Text>
                    </View>

                    <View style={styles.statCard}>
                        <Building2 color="#10b981" size={28} />
                        <Text style={styles.statNumber}>{stats.totalEmpresas}</Text>
                        <Text style={styles.statLabel}>Empresas</Text>
                    </View>

                    <View style={styles.statCard}>
                        <BarChart2 color="#f59e0b" size={28} />
                        <Text style={styles.statNumber}>{stats.totalJobProfiles}</Text>
                        <Text style={styles.statLabel}>Vacantes</Text>
                    </View>
                </View>

                {/* EXTERNAL TOOLS */}
                <Text style={styles.sectionTitle}>🔧 Herramientas Externas</Text>

                <TouchableOpacity
                    style={styles.externalCard}
                    onPress={() => openExternalLink(GA_URL)}
                >
                    <View style={styles.externalIcon}>
                        <Text style={{ fontSize: 24 }}>📈</Text>
                    </View>
                    <View style={styles.externalInfo}>
                        <Text style={styles.externalTitle}>Google Analytics</Text>
                        <Text style={styles.externalDesc}>Ver tráfico, usuarios activos, conversiones y más</Text>
                    </View>
                    <ExternalLink color="#64748b" size={20} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.externalCard}
                    onPress={() => openExternalLink(SENTRY_URL)}
                >
                    <View style={styles.externalIcon}>
                        <Text style={{ fontSize: 24 }}>🐛</Text>
                    </View>
                    <View style={styles.externalInfo}>
                        <Text style={styles.externalTitle}>Sentry</Text>
                        <Text style={styles.externalDesc}>Monitoreo de errores en producción</Text>
                    </View>
                    <ExternalLink color="#64748b" size={20} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.externalCard}
                    onPress={() => openExternalLink('https://console.firebase.google.com/')}
                >
                    <View style={styles.externalIcon}>
                        <Text style={{ fontSize: 24 }}>🔥</Text>
                    </View>
                    <View style={styles.externalInfo}>
                        <Text style={styles.externalTitle}>Firebase Console</Text>
                        <Text style={styles.externalDesc}>Base de datos, autenticación y más</Text>
                    </View>
                    <ExternalLink color="#64748b" size={20} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.externalCard}
                    onPress={() => openExternalLink('https://app.netlify.com/projects/veritly')}
                >
                    <View style={styles.externalIcon}>
                        <Text style={{ fontSize: 24 }}>🚀</Text>
                    </View>
                    <View style={styles.externalInfo}>
                        <Text style={styles.externalTitle}>Netlify</Text>
                        <Text style={styles.externalDesc}>Deploys, logs y configuración de hosting</Text>
                    </View>
                    <ExternalLink color="#64748b" size={20} />
                </TouchableOpacity>

                {/* QUICK INFO */}
                <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>💡 Tip</Text>
                    <Text style={styles.infoText}>
                        Los datos de "Total Análisis" cuentan todos los CVs procesados por IA.
                        Para métricas más detalladas, usa Google Analytics.
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    lockedTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20
    },
    lockedText: {
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 10
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white'
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 2
    },
    refreshBtn: {
        padding: 10,
        backgroundColor: '#1e293b',
        borderRadius: 10
    },
    content: {
        padding: 20,
        paddingBottom: 100
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#94a3b8',
        marginBottom: 16,
        marginTop: 10
    },

    // Main Stats (Total Users & Analyses)
    mainStatsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24
    },
    mainStatCard: {
        flex: 1,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    mainStatIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    mainStatNumber: {
        fontSize: 42,
        fontWeight: '800',
        color: 'white'
    },
    mainStatLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
        marginTop: 4
    },
    mainStatSubtext: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 6,
        textAlign: 'center'
    },

    // Chart styles
    chartContainer: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#334155'
    },
    chartTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94a3b8',
        marginBottom: 16
    },
    chart: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 150,
        paddingTop: 20
    },
    barContainer: {
        flex: 1,
        alignItems: 'center'
    },
    barWrapper: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: 120
    },
    bar: {
        width: 32,
        backgroundColor: '#38bdf8',
        borderRadius: 6,
        minHeight: 4
    },
    barValue: {
        fontSize: 11,
        fontWeight: '600',
        color: '#38bdf8',
        marginBottom: 4
    },
    barLabel: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center'
    },

    // Detail Stats Grid
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 30
    },
    statCard: {
        flex: 1,
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155'
    },
    statNumber: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginTop: 12
    },
    statLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4
    },
    externalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#334155'
    },
    externalIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14
    },
    externalInfo: {
        flex: 1
    },
    externalTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white'
    },
    externalDesc: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2
    },
    infoBox: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)'
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10b981',
        marginBottom: 6
    },
    infoText: {
        fontSize: 13,
        color: '#94a3b8',
        lineHeight: 20
    }
});
