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
    Activity,
    RotateCw
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

    // Gesture state for Web pull-to-refresh
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const [startY, setStartY] = useState(0);
    const [isAtTop, setIsAtTop] = useState(true);

    const handleTouchStart = (e: any) => {
        if (Platform.OS !== 'web') return;
        if (isAtTop) {
            setStartY(e.touches[0].clientY);
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: any) => {
        if (Platform.OS !== 'web' || !isPulling) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0) {
            const distance = Math.min(diff * 0.4, 100);
            setPullDistance(distance);
            if (e.cancelable) e.preventDefault();
        }
    };

    const handleTouchEnd = () => {
        if (Platform.OS !== 'web') return;
        if (isPulling) {
            if (pullDistance > 50 && !refreshing) {
                setRefreshing(true);
                fetchInsights();
            }
            setPullDistance(0);
            setIsPulling(false);
            setStartY(0);
        }
    };

    const handleScroll = (e: any) => {
        const yOffset = e.nativeEvent.contentOffset.y;
        setIsAtTop(yOffset <= 0);
    };

    const renderWebRefreshIndicator = () => {
        if (Platform.OS !== 'web') return null;
        if (pullDistance === 0 && !refreshing) return null;
        
        return (
            <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                height: refreshing ? 60 : pullDistance,
                overflow: 'hidden',
                opacity: refreshing ? 1 : Math.min(pullDistance / 50, 1),
                backgroundColor: 'transparent',
                paddingVertical: 10
            }}>
                <ActivityIndicator size="small" color="#4F46E5" />
                <Text style={{ fontSize: 10, color: '#4B5563', marginTop: 4 }}>
                    {refreshing ? "Actualizando..." : (pullDistance > 45 ? "Suelta para actualizar" : "Desliza para actualizar")}
                </Text>
            </View>
        );
    };

    useEffect(() => {
        fetchInsights();
    }, []);

    const fetchInsights = async () => {
        try {
            setLoading(true);
            
            // Query users_candidatos and users in parallel to merge full profiles
            const [candsSnap, usersSnap] = await Promise.all([
                getDocs(collection(db, 'users_candidatos')),
                getDocs(collection(db, 'users'))
            ]);

            const usersMap: Record<string, any> = {};
            usersSnap.docs.forEach(doc => {
                usersMap[doc.id] = doc.data();
            });

            const candidates = candsSnap.docs.map(doc => {
                const candData = doc.data();
                const userData = usersMap[doc.id] || {};
                const userProfile = userData.profile || {};
                const history = userData.history || [];

                return {
                    ...candData,
                    name: candData.fullName || userProfile.fullName || 'Anónimo',
                    email: candData.email || userProfile.email || 'Sin correo',
                    phone: candData.phone || userProfile.phone || '',
                    salary: userProfile.salary || candData.salary || candData.profile?.salary || '',
                    district: userProfile.district || candData.district || candData.profile?.district || '',
                    department: userProfile.department || candData.department || candData.profile?.department || '',
                    modality: userProfile.modality || candData.modality || candData.profile?.modality || '',
                    interests: userProfile.interests || candData.interests || candData.profile?.interests || '',
                    bio: userProfile.bio || candData.bio || candData.profile?.bio || '',
                    cvUrl: userProfile.cvUrl || candData.cvUrl || candData.profile?.cv || '',
                    createdAt: candData.createdAt || userData.createdAt || candData.updatedAt || new Date().toISOString(),
                    history,
                    reliabilityIndex: candData.reliabilityIndex ?? userProfile.reliabilityIndex ?? Math.round(candData.aiCredits !== undefined ? 100 - (candData.aiCredits * 10) : 75)
                };
            });

            // Sort candidates by creation date in memory (newest first)
            candidates.sort((a: any, b: any) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });

            // 1. Total & Average Score
            const total = candidates.length;
            const avgScore = total > 0 
                ? candidates.reduce((acc, c) => acc + (c.reliabilityIndex || 0), 0) / total 
                : 0;

            // 2. Categories (Based on candidate interests and past matched roles)
            const categoriesMap: Record<string, number> = {};
            candidates.forEach(c => {
                let cat = 'General';
                if (c.interests) {
                    const firstInterest = c.interests.split(',')[0].split('•')[0].trim();
                    if (firstInterest) cat = firstInterest;
                } else if (c.history && c.history.length > 0) {
                    const lastHistory = c.history[c.history.length - 1];
                    if (lastHistory.role) cat = lastHistory.role;
                } else if (c.originalJobTitle) {
                    cat = c.originalJobTitle;
                }
                
                // Normalizar
                cat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
                categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
            });
            const topCategories = Object.entries(categoriesMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // 3. Salary Density (Real calculations based on district/province and expectations)
            const parseSalary = (salaryStr: any): number => {
                if (!salaryStr) return 0;
                if (typeof salaryStr === 'number') return salaryStr;
                const cleanStr = salaryStr.replace(/[^0-9]/g, '');
                return parseInt(cleanStr, 10) || 0;
            };

            const regionsData: Record<string, { count: number; totalSalary: number; salaryCount: number }> = {
                'Lima Centro / Top': { count: 0, totalSalary: 0, salaryCount: 0 },
                'Lima Norte': { count: 0, totalSalary: 0, salaryCount: 0 },
                'Lima Sur': { count: 0, totalSalary: 0, salaryCount: 0 },
                'Lima Este': { count: 0, totalSalary: 0, salaryCount: 0 },
                'Provincias': { count: 0, totalSalary: 0, salaryCount: 0 }
            };

            candidates.forEach(c => {
                const dept = (c.department || '').trim().toLowerCase();
                const dist = (c.district || '').trim().toLowerCase();
                const sal = parseSalary(c.salary);

                let region = 'Provincias';
                
                if (dept === 'lima' || dept === 'lima metropolitana' || dept === 'callao') {
                    if (['miraflores', 'san isidro', 'san borja', 'santiago de surco', 'surco', 'la molina', 'jesus maria', 'jesús maría', 'lince', 'magdalena', 'magdalena del mar', 'pueblo libre', 'barranco', 'san miguel'].some(d => dist.includes(d))) {
                        region = 'Lima Centro / Top';
                    } else if (['los olivos', 'comas', 'san martin de porres', 'san martín de porres', 'carabayllo', 'puente piedra', 'independencia', 'ancón', 'ancon', 'santa rosa'].some(d => dist.includes(d))) {
                        region = 'Lima Norte';
                    } else if (['villa maria', 'villa maría', 'villa el salvador', 'san juan de miraflores', 'lurin', 'lurín', 'chorrillos', 'pachacamac', 'pachacámac', 'pucusana', 'punta hermosa', 'punta negra', 'san bartolo', 'santa maría del mar'].some(d => dist.includes(d))) {
                        region = 'Lima Sur';
                    } else if (['san juan de lurigancho', 'ate', 'ate vitarte', 'santa anita', 'el agustino', 'lurigancho', 'chosica', 'chaclacayo', 'cieneguilla'].some(d => dist.includes(d))) {
                        region = 'Lima Este';
                    } else {
                        region = 'Lima Centro / Top'; // default fallback for other Lima districts
                    }
                } else if (!dept) {
                    if (['miraflores', 'san isidro', 'san borja', 'surco'].some(d => dist.includes(d))) {
                        region = 'Lima Centro / Top';
                    }
                }

                regionsData[region].count++;
                if (sal > 0) {
                    regionsData[region].totalSalary += sal;
                    regionsData[region].salaryCount++;
                }
            });

            const salaryDensity = Object.entries(regionsData).map(([region, data]) => {
                let avg = 0;
                if (data.salaryCount > 0) {
                    avg = Math.round(data.totalSalary / data.salaryCount);
                } else {
                    // Fallback realista si no hay datos de salario aún para esa zona
                    if (region === 'Lima Centro / Top') avg = 4500;
                    else if (region === 'Lima Norte') avg = 2800;
                    else if (region === 'Lima Sur') avg = 2600;
                    else if (region === 'Lima Este') avg = 2500;
                    else avg = 2200;
                }
                return {
                    region,
                    count: data.count,
                    avgSalary: avg
                };
            });

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, flex: 1 }}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color="#38bdf8" size={24} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Talent Insights</Text>
                    <Text style={styles.subtitle}>Visibilidad del Inventario de Talento (Talent Graph)</Text>
                </View>
            </View>
            <TouchableOpacity 
                style={styles.headerRefreshBtn} 
                onPress={() => { setRefreshing(true); fetchInsights(); }}
                disabled={refreshing}
            >
                {refreshing ? (
                    <ActivityIndicator size="small" color="#4F46E5" />
                ) : (
                    <RotateCw color="#4F46E5" size={16} />
                )}
            </TouchableOpacity>
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
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {renderWebRefreshIndicator()}
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
                                <Text style={styles.candidateDna} numberOfLines={2}>{c.profileDnaSummary || c.bio || (c.interests ? 'Intereses: ' + c.interests : 'Sin resumen de ADN generado aún.')}</Text>
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
    headerRefreshBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB'
    },
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
