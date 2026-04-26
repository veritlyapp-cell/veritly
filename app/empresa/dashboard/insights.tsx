import React, { useEffect, useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    ScrollView, 
    ActivityIndicator, 
    TouchableOpacity, 
    SafeAreaView, 
    StatusBar,
    Platform,
    RefreshControl
} from 'react-native';
import { 
    Users, 
    TrendingUp, 
    DollarSign, 
    PieChart, 
    Search, 
    Filter, 
    MapPin,
    ArrowLeft,
    BarChart3,
    Activity
} from 'lucide-react-native';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useRouter } from 'expo-router';

export default function TalentInsightsDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        totalCandidates: 0,
        averageScore: 0,
        topCategories: [] as any[],
        salaryDensity: [] as any[],
        recentActivity: [] as any[]
    });

    useEffect(() => {
        fetchInsights();
    }, []);

    const fetchInsights = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'users_candidatos'), orderBy('lastSeenAt', 'desc'));
            const snap = await getDocs(q);
            const candidates = snap.docs.map(doc => doc.data());

            // 1. Total & Average Score
            const total = candidates.length;
            const avgScore = total > 0 
                ? candidates.reduce((acc, c) => acc + (c.reliabilityIndex || 0), 0) / total 
                : 0;

            // 2. Categories (Mock logic based on job titles or skills)
            const categoriesMap: Record<string, number> = {};
            candidates.forEach(c => {
                const cat = c.originalJobTitle || 'General';
                categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
            });
            const topCategories = Object.entries(categoriesMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // 3. Salary Density (Mock logic)
            const regions = ['Lima Top', 'Lima Norte', 'Lima Sur', 'Provincias'];
            const salaryDensity = regions.map(r => ({
                region: r,
                count: Math.floor(Math.random() * (total / 2)),
                avgSalary: 1500 + Math.floor(Math.random() * 5000)
            }));

            setStats({
                totalCandidates: total,
                averageScore: Math.round(avgScore),
                topCategories,
                salaryDensity,
                recentActivity: candidates.slice(0, 5)
            });

        } catch (error) {
            console.error("Error fetching insights:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <ArrowLeft color="#38bdf8" size={24} />
            </TouchableOpacity>
            <View>
                <Text style={styles.title}>Talent Insights</Text>
                <Text style={styles.subtitle}>Visibilidad del Inventario de Talento (Talent Graph)</Text>
            </View>
        </View>
    );

    const renderMetrics = () => (
        <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
                <Users color="#3b82f6" size={24} />
                <Text style={styles.metricValue}>{stats.totalCandidates}</Text>
                <Text style={styles.metricLabel}>Total Perfiles DNA</Text>
            </View>
            <View style={styles.metricCard}>
                <TrendingUp color="#10b981" size={24} />
                <Text style={styles.metricValue}>{stats.averageScore}%</Text>
                <Text style={styles.metricLabel}>Score Promedio</Text>
            </View>
            <View style={styles.metricCard}>
                <PieChart color="#f59e0b" size={24} />
                <Text style={styles.metricValue}>{stats.topCategories.length}</Text>
                <Text style={styles.metricLabel}>Categorías Activas</Text>
            </View>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.loadingText}>Analizando Talent Graph...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
            <ScrollView 
                contentContainerStyle={[
                    styles.scrollContent,
                    Platform.OS === 'web' && { maxWidth: 1000, alignSelf: 'center', width: '100%' }
                ]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInsights(); }} tintColor="#3b82f6" />}
            >
                {renderHeader()}
                {renderMetrics()}

                {/* Section: Top Categories */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <BarChart3 color="#38bdf8" size={20} />
                        <Text style={styles.sectionTitle}>Distribución por Categoría</Text>
                    </View>
                    {stats.topCategories.map((cat, i) => (
                        <View key={i} style={styles.row}>
                            <Text style={styles.rowLabel}>{cat.name}</Text>
                            <View style={styles.barContainer}>
                                <View style={[styles.bar, { width: `${(cat.count / stats.totalCandidates) * 100}%` }]} />
                                <Text style={styles.barValue}>{cat.count} pers.</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Section: Salary Density */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <DollarSign color="#10b981" size={20} />
                        <Text style={styles.sectionTitle}>Densidad Salarial por Zona</Text>
                    </View>
                    {stats.salaryDensity.map((item, i) => (
                        <View key={i} style={styles.densityRow}>
                            <View>
                                <Text style={styles.regionName}>{item.region}</Text>
                                <Text style={styles.regionSub}>{item.count} candidatos detectados</Text>
                            </View>
                            <View style={styles.salaryBadge}>
                                <Text style={styles.salaryText}>S/ {item.avgSalary.toLocaleString()}</Text>
                                <Text style={styles.salarySub}>Prom. Pretensión</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Section: Talent DNA Feed */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Activity color="#ec4899" size={20} />
                        <Text style={styles.sectionTitle}>Últimos Perfiles Estructurados (DNA)</Text>
                    </View>
                    {stats.recentActivity.map((c, i) => (
                        <View key={i} style={styles.candidateCard}>
                            <View style={styles.candidateInfo}>
                                <Text style={styles.candidateName}>{c.name || 'Anónimo'}</Text>
                                <Text style={styles.candidateEmail}>{c.email}</Text>
                                <Text style={styles.candidateDna} numberOfLines={2}>{c.profileDnaSummary || 'Sin resumen de ADN generado aún.'}</Text>
                            </View>
                            <View style={[styles.scoreBadge, { borderColor: (c.reliabilityIndex || 0) > 70 ? '#10b981' : '#f59e0b' }]}>
                                <Text style={[styles.scoreText, { color: (c.reliabilityIndex || 0) > 70 ? '#10b981' : '#f59e0b' }]}>{c.reliabilityIndex || 0}%</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Veritly Marketplace Roadmap 2027 • v1.0 Data Insight</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centered: { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#4F46E5', marginTop: 15, fontWeight: 'bold' },
    scrollContent: { padding: 20, paddingBottom: 50 },
    
    header: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 30, marginTop: 10 },
    backBtn: { padding: 8, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    title: { color: '#111827', fontSize: 24, fontWeight: 'bold' },
    subtitle: { color: '#6B7280', fontSize: 13, marginTop: 2 },

    metricsGrid: { flexDirection: 'row', gap: 12, marginBottom: 25 },
    metricCard: { flex: 1, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', shadowColor: '#111827', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
    metricValue: { color: '#111827', fontSize: 22, fontWeight: 'bold', marginVertical: 6 },
    metricLabel: { color: '#9CA3AF', fontSize: 10, textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' },

    section: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    sectionTitle: { color: '#111827', fontSize: 16, fontWeight: 'bold' },

    row: { marginBottom: 15 },
    rowLabel: { color: '#374151', fontSize: 13, marginBottom: 6 },
    barContainer: { height: 28, backgroundColor: '#F3F4F6', borderRadius: 14, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 10 },
    bar: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: '#4F46E5', opacity: 0.2, borderRadius: 14 },
    barValue: { color: '#4F46E5', fontSize: 11, fontWeight: 'bold' },

    densityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    regionName: { color: '#111827', fontSize: 15, fontWeight: '600' },
    regionSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
    salaryBadge: { alignItems: 'flex-end' },
    salaryText: { color: '#059669', fontSize: 16, fontWeight: 'bold' },
    salarySub: { color: '#9CA3AF', fontSize: 10 },

    candidateCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    candidateInfo: { flex: 1, marginRight: 10 },
    candidateName: { color: '#111827', fontSize: 14, fontWeight: 'bold' },
    candidateEmail: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
    candidateDna: { color: '#6B7280', fontSize: 11, lineHeight: 16 },
    scoreBadge: { width: 45, height: 45, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    scoreText: { fontWeight: 'bold', fontSize: 12 },

    footer: { marginTop: 10, alignItems: 'center' },
    footerText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600' }
});
