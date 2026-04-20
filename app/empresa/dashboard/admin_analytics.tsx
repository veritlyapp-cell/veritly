import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    Platform,
    RefreshControl,
    TouchableOpacity,
    Alert,
    Dimensions
} from 'react-native';
import {
    Users,
    TrendingUp,
    Briefcase,
    ShieldCheck,
    ArrowLeft,
    BarChart3,
    Zap,
    DollarSign,
    Building2,
    PieChart,
    Search,
    Globe
} from 'lucide-react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import { useFocusEffect, useRouter } from 'expo-router';

// ============ TYPES ============
interface ClientUsage {
    uid: string;
    name: string;
    email: string;
    plan: string;
    jobCount: number;
    candidateCount: number;
    iaAnalysedCount: number;
    lastActive: string;
}

interface MarketJobStats {
    jobTitle: string;
    avgSalaryOffered: number;
    avgSalaryExpected: number;
    candidateCount: number;
    minOffered: number;
    maxOffered: number;
    minExpected: number;
    maxExpected: number;
}

export default function SuperAdminAnalytics() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'clients' | 'market'>('clients');
    const [isAdmin, setIsAdmin] = useState(false);

    // Data
    const [clientsUsage, setClientsUsage] = useState<ClientUsage[]>([]);
    const [marketStats, setMarketStats] = useState<MarketJobStats[]>([]);
    const [globalStats, setGlobalStats] = useState({
        totalClients: 0,
        totalJobs: 0,
        totalCandidates: 0,
        totalIAAnalyses: 0
    });

    const checkAdmin = useCallback(() => {
        const user = auth.currentUser;
        if (user && (user.email === 'oscar@veritlyapp.com' || user.email === 'oscar@relielabs.com')) {
            setIsAdmin(true);
            return true;
        }
        return false;
    }, []);

    const fetchData = async () => {
        if (!checkAdmin()) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            
            // 1. Fetch all companies
            const clientsSnap = await getDocs(collection(db, 'users_empresas'));
            const companies = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            
            // 2. Fetch all jobs
            const jobsSnap = await getDocs(collection(db, 'jobs'));
            const allJobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            
            const usageData: ClientUsage[] = [];
            const marketMap: Record<string, { offered: number[]; expected: number[]; count: number }> = {};
            
            let totalJobs = allJobs.length;
            let totalCandidates = 0;
            let totalIA = 0;

            // Process per client
            for (const company of companies) {
                const companyJobs = allJobs.filter(j => j.companyId === company.id);
                let clientCandidates = 0;
                let clientIA = 0;

                for (const job of companyJobs) {
                    const candSnap = await getDocs(collection(db, 'jobs', job.id, 'candidates'));
                    const candidates = candSnap.docs.map(d => d.data() as any);
                    
                    clientCandidates += candidates.length;
                    
                    // Normalize job title for market studies
                    const normalizedTitle = (job.jobTitle || 'Otros').trim().toLowerCase();
                    if (!marketMap[normalizedTitle]) {
                        marketMap[normalizedTitle] = { offered: [], expected: [], count: 0 };
                    }
                    
                    if (job.salaryBudget > 0) {
                        marketMap[normalizedTitle].offered.push(Number(job.salaryBudget));
                    }

                    candidates.forEach(c => {
                        if (c.matchScore > 0) clientIA++;
                        if (c.salaryExpectation > 0) {
                            marketMap[normalizedTitle].expected.push(Number(c.salaryExpectation));
                        }
                    });
                }

                usageData.push({
                    uid: company.id,
                    name: company.company?.name || company.email,
                    email: company.email,
                    plan: company.subscription?.plan || 'beta',
                    jobCount: companyJobs.length,
                    candidateCount: clientCandidates,
                    iaAnalysedCount: clientIA,
                    lastActive: company.lastLoginAt ? new Date(company.lastLoginAt.seconds ? company.lastLoginAt.toDate() : company.lastLoginAt).toLocaleDateString() : 'N/A'
                });

                totalCandidates += clientCandidates;
                totalIA += clientIA;
            }

            // Process Market Stats
            const marketResults: MarketJobStats[] = Object.entries(marketMap)
                .map(([title, data]) => {
                    const avgOffered = data.offered.length > 0 ? data.offered.reduce((a, b) => a + b, 0) / data.offered.length : 0;
                    const avgExpected = data.expected.length > 0 ? data.expected.reduce((a, b) => a + b, 0) / data.expected.length : 0;
                    
                    return {
                        jobTitle: title.charAt(0).toUpperCase() + title.slice(1),
                        avgSalaryOffered: Math.round(avgOffered),
                        avgSalaryExpected: Math.round(avgExpected),
                        candidateCount: data.expected.length,
                        minOffered: data.offered.length > 0 ? Math.min(...data.offered) : 0,
                        maxOffered: data.offered.length > 0 ? Math.max(...data.offered) : 0,
                        minExpected: data.expected.length > 0 ? Math.min(...data.expected) : 0,
                        maxExpected: data.expected.length > 0 ? Math.max(...data.expected) : 0
                    };
                })
                .filter(m => m.avgSalaryOffered > 0 || m.avgSalaryExpected > 0)
                .sort((a, b) => b.candidateCount - a.candidateCount);

            setClientsUsage(usageData.sort((a,b) => b.candidateCount - a.candidateCount));
            setMarketStats(marketResults);
            setGlobalStats({
                totalClients: companies.length,
                totalJobs,
                totalCandidates,
                totalIAAnalyses: totalIA
            });

        } catch (err) {
            console.error('Error fetching admin analytics:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));

    if (!isAdmin && !loading) {
        return (
            <View style={styles.centered}>
                <ShieldCheck size={64} color="#64748b" />
                <Text style={styles.errorText}>Acceso Denegado</Text>
            </View>
        );
    }

    if (loading && !refreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Generando Reporte DNA Global...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#3b82f6" />}
                contentContainerStyle={[
                    styles.scrollContent,
                    Platform.OS === 'web' && { maxWidth: 1100, alignSelf: 'center' as any, width: '100%' }
                ]}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft color="#38bdf8" size={24} />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.title}>Superadmin Analytics</Text>
                        <Text style={styles.subtitle}>DNA Global & Market Study</Text>
                    </View>
                </View>

                {/* Global KPIs */}
                <View style={styles.kpiGrid}>
                    <View style={styles.kpiCard}>
                        <Building2 color="#3b82f6" size={20} />
                        <Text style={styles.kpiValue}>{globalStats.totalClients}</Text>
                        <Text style={styles.kpiLabel}>Clientes</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Briefcase color="#10b981" size={20} />
                        <Text style={styles.kpiValue}>{globalStats.totalJobs}</Text>
                        <Text style={styles.kpiLabel}>Vacantes</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Users color="#f59e0b" size={20} />
                        <Text style={styles.kpiValue}>{globalStats.totalCandidates}</Text>
                        <Text style={styles.kpiLabel}>Candidatos</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Zap color="#8b5cf6" size={20} />
                        <Text style={styles.kpiValue}>{globalStats.totalIAAnalyses}</Text>
                        <Text style={styles.kpiLabel}>Uso IA</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'clients' && styles.tabActive]} 
                        onPress={() => setActiveTab('clients')}
                    >
                        <Users color={activeTab === 'clients' ? 'white' : '#64748b'} size={18} />
                        <Text style={[styles.tabText, activeTab === 'clients' && styles.tabTextActive]}>Uso por Cliente</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'market' && styles.tabActive]} 
                        onPress={() => setActiveTab('market')}
                    >
                        <Globe color={activeTab === 'market' ? 'white' : '#64748b'} size={18} />
                        <Text style={[styles.tabText, activeTab === 'market' && styles.tabTextActive]}>Estudio Mercado</Text>
                    </TouchableOpacity>
                </View>

                {/* Content: Clients Usage */}
                {activeTab === 'clients' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Ranking de Actividad por Cliente</Text>
                        {clientsUsage.map((client, idx) => (
                            <View key={client.uid} style={styles.clientRow}>
                                <View style={styles.clientInfo}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                        <Text style={styles.clientName}>{client.name}</Text>
                                        <View style={[styles.planBadge, { backgroundColor: client.plan === 'pro' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.1)' }]}>
                                            <Text style={[styles.planBadgeText, { color: client.plan === 'pro' ? '#10b981' : '#38bdf8' }]}>{client.plan.toUpperCase()}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.clientEmail}>{client.email}</Text>
                                    <Text style={styles.clientMeta}>Última conexión: {client.lastActive}</Text>
                                </View>
                                <View style={styles.clientStats}>
                                    <View style={styles.miniStat}>
                                        <Text style={styles.miniStatValue}>{client.jobCount}</Text>
                                        <Text style={styles.miniStatLabel}>Jobs</Text>
                                    </View>
                                    <View style={styles.miniStat}>
                                        <Text style={styles.miniStatValue}>{client.candidateCount}</Text>
                                        <Text style={styles.miniStatLabel}>Cand.</Text>
                                    </View>
                                    <View style={styles.miniStat}>
                                        <Text style={[styles.miniStatValue, { color: '#8b5cf6' }]}>{client.iaAnalysedCount}</Text>
                                        <Text style={styles.miniStatLabel}>IA</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Content: Market Study */}
                {activeTab === 'market' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Benchmarking Salarial por Puesto</Text>
                        <Text style={styles.sectionSubtitle}>Comparativa entre Presupuesto de Empresa vs Expectativa de Candidato</Text>
                        
                        {marketStats.map((item, idx) => (
                            <View key={idx} style={styles.marketCard}>
                                <View style={styles.marketHeader}>
                                    <Text style={styles.marketJobTitle}>{item.jobTitle}</Text>
                                    <View style={styles.countBadge}>
                                        <Text style={styles.countBadgeText}>{item.candidateCount} muestras</Text>
                                    </View>
                                </View>
                                
                                <View style={styles.marketComparison}>
                                    <View style={styles.marketSide}>
                                        <Text style={styles.sideLabel}>Presupuesto Empresa</Text>
                                        <Text style={styles.sideValue}>S/ {item.avgSalaryOffered.toLocaleString()}</Text>
                                        <Text style={styles.sideRange}>Rango: S/ {item.minOffered.toLocaleString()} - S/ {item.maxOffered.toLocaleString()}</Text>
                                    </View>
                                    
                                    <View style={styles.vsSeparator}>
                                        <View style={styles.vsLine} />
                                        <Text style={styles.vsText}>VS</Text>
                                        <View style={styles.vsLine} />
                                    </View>

                                    <View style={styles.marketSide}>
                                        <Text style={[styles.sideLabel, { textAlign: 'right' }]}>Expectativa Talento</Text>
                                        <Text style={[styles.sideValue, { textAlign: 'right', color: '#10b981' }]}>S/ {item.avgSalaryExpected.toLocaleString()}</Text>
                                        <Text style={[styles.sideRange, { textAlign: 'right' }]}>Rango: S/ {item.minExpected.toLocaleString()} - S/ {item.maxExpected.toLocaleString()}</Text>
                                    </View>
                                </View>

                                {/* Gap analysis indicator */}
                                {item.avgSalaryOffered > 0 && item.avgSalaryExpected > 0 && (
                                    <View style={styles.gapContainer}>
                                        <View style={[styles.gapBar, { 
                                            backgroundColor: item.avgSalaryExpected > item.avgSalaryOffered * 1.1 ? '#ef4444' : '#10b981',
                                            width: `${Math.min(100, (item.avgSalaryOffered / item.avgSalaryExpected) * 100)}%`
                                        }]} />
                                        <Text style={styles.gapText}>
                                            Brecha: {Math.round((item.avgSalaryExpected / item.avgSalaryOffered - 1) * 100)}% {item.avgSalaryExpected > item.avgSalaryOffered ? 'por encima' : 'por debajo'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Veritly Intelligence DNA • Superadmin View</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    centered: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#38bdf8', marginTop: 15, fontWeight: 'bold' },
    errorText: { color: 'white', marginTop: 15, fontSize: 18, fontWeight: 'bold' },
    scrollContent: { padding: 20, paddingBottom: 50 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 25, marginTop: 10 },
    backBtn: { padding: 8, backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
    title: { color: 'white', fontSize: 22, fontWeight: '900' },
    subtitle: { color: '#94a3b8', fontSize: 13 },

    kpiGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    kpiCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
    kpiValue: { color: 'white', fontSize: 20, fontWeight: 'bold', marginVertical: 4 },
    kpiLabel: { color: '#64748b', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

    tabContainer: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 12, padding: 4, marginBottom: 20 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 8 },
    tabActive: { backgroundColor: '#3b82f6' },
    tabText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: 'white' },

    section: { backgroundColor: '#1e293b', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
    sectionTitle: { color: 'white', fontSize: 16, fontWeight: '800', marginBottom: 15 },
    sectionSubtitle: { color: '#94a3b8', fontSize: 12, marginBottom: 20 },

    clientRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#334155' },
    clientInfo: { flex: 1 },
    clientName: { color: 'white', fontSize: 15, fontWeight: '700' },
    clientEmail: { color: '#64748b', fontSize: 12, marginTop: 2 },
    clientMeta: { color: '#475569', fontSize: 10, marginTop: 4 },
    planBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    planBadgeText: { fontSize: 9, fontWeight: '800' },

    clientStats: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    miniStat: { alignItems: 'center', minWidth: 35 },
    miniStatValue: { color: 'white', fontSize: 14, fontWeight: '800' },
    miniStatLabel: { color: '#64748b', fontSize: 9 },

    marketCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
    marketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    marketJobTitle: { color: 'white', fontSize: 15, fontWeight: '800', flex: 1 },
    countBadge: { backgroundColor: 'rgba(56, 189, 248, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    countBadgeText: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold' },

    marketComparison: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    marketSide: { flex: 1 },
    sideLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
    sideValue: { color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 4 },
    sideRange: { color: '#475569', fontSize: 10 },

    vsSeparator: { alignItems: 'center', justifyContent: 'center' },
    vsLine: { width: 1, height: 15, backgroundColor: '#334155' },
    vsText: { color: '#334155', fontSize: 10, fontWeight: '900', marginVertical: 4 },

    gapContainer: { marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1e293b' },
    gapBar: { height: 4, borderRadius: 2, marginBottom: 6 },
    gapText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },

    footer: { marginTop: 10, alignItems: 'center' },
    footerText: { color: '#475569', fontSize: 11, fontWeight: '600' }
});
