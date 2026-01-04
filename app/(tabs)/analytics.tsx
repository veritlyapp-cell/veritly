import { useRouter } from 'expo-router';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Activity, BarChart, ChevronRight, Lock, RefreshCw, ShieldAlert, TrendingDown, TrendingUp, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../config/firebase';

// --- CONFIGURACIÓN DE SEGURIDAD ---
const ADMIN_EMAILS = ['test+1@gmail.com', 'oscar@veritlyapp.com', 'oscar@relielabs.com'];

type Period = 'today' | 'week' | 'month' | 'custom';

export default function AnalyticsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [stats, setStats] = useState<any>({});
    const [logs, setLogs] = useState<any[]>([]);

    // Filtros
    const [period, setPeriod] = useState<Period>('today');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [customRange, setCustomRange] = useState({ start: '', end: '' });

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = () => {
        const user = auth.currentUser;
        if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
            setIsAdmin(true);
            subscribeToStats();
            subscribeToLogs();
        } else {
            setIsAdmin(false);
            setLoading(false);
        }
    };

    const subscribeToStats = () => {
        const statsRef = doc(db, 'stats', 'global_counters');
        const unsub = onSnapshot(statsRef, (doc) => {
            if (doc.exists()) {
                setStats(doc.data());
            }
            setLoading(false);
        });
        return unsub;
    };

    const subscribeToLogs = () => {
        const logsRef = collection(db, 'system_logs');
        const q = query(logsRef, orderBy('timestamp', 'desc'), limit(20));
        const unsub = onSnapshot(q, (snapshot) => {
            const logsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setLogs(logsData);
        });
        return unsub;
    };

    // --- LÓGICA DE CÁLCULO DE PERÍODOS ---

    const getDateList = (start: Date, end: Date) => {
        const list = [];
        let current = new Date(start);
        while (current <= end) {
            list.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return list;
    };

    const getPeriodRanges = (type: Period) => {
        const now = new Date();
        const startCurrent = new Date(now);
        const endCurrent = new Date(now);
        const startPrev = new Date(now);
        const endPrev = new Date(now);

        if (type === 'today') {
            startPrev.setDate(now.getDate() - 1);
            endPrev.setDate(now.getDate() - 1);
        } else if (type === 'week') {
            startCurrent.setDate(now.getDate() - 7);
            startPrev.setDate(now.getDate() - 14);
            endPrev.setDate(now.getDate() - 8);
        } else if (type === 'month') {
            startCurrent.setMonth(now.getMonth() - 1);
            startPrev.setMonth(now.getMonth() - 2);
            endPrev.setMonth(now.getMonth() - 1);
            endPrev.setDate(now.getDate());
        } else if (type === 'custom') {
            const s = new Date(customRange.start || now);
            const e = new Date(customRange.end || now);
            return { current: getDateList(s, e), previous: [] };
        }

        return {
            current: getDateList(startCurrent, endCurrent),
            previous: getDateList(startPrev, endPrev)
        };
    };

    const calculateMetrics = (keys: string[]) => {
        const data = { logins: 0, users: 0, scans: 0 };
        keys.forEach(k => {
            data.logins += stats.dailyLogins?.[k] || 0;
            data.users += stats.dailyNewUsers?.[k] || 0;
            data.scans += stats.dailyScans?.[k] || 0;
        });
        return data;
    };

    const getTrend = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? { val: 100, up: true } : { val: 0, up: true };
        const diff = ((curr - prev) / prev) * 100;
        return { val: Math.abs(diff).toFixed(1), up: diff >= 0 };
    };

    // --- COMPONENTES ---

    const MetricCard = ({ title, current, previous, icon, color }: any) => {
        const trend = getTrend(current, previous);
        const isNeutral = previous === 0 && current === 0;

        return (
            <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={[styles.iconBox, { backgroundColor: color }]}>
                        {icon}
                    </View>
                    {!isNeutral && period !== 'custom' && (
                        <View style={[styles.trendBadge, { backgroundColor: trend.up ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                            {trend.up ? <TrendingUp size={12} color="#10b981" /> : <TrendingDown size={12} color="#ef4444" />}
                            <Text style={[styles.trendText, { color: trend.up ? '#10b981' : '#ef4444' }]}>{trend.val}%</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.cardValue}>{current}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    {previous > 0 && period !== 'custom' && (
                        <Text style={styles.cardPrev}> vs {previous}</Text>
                    )}
                </View>
            </View>
        );
    };

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ color: 'white', marginTop: 10 }}>Cargando Analytics...</Text>
        </View>
    );

    if (!isAdmin) {
        return (
            <View style={styles.center}>
                <Lock size={64} color="#64748b" />
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 20 }}>Acceso Restringido</Text>
                <Text style={{ color: '#94a3b8', textAlign: 'center', marginTop: 10, paddingHorizontal: 40 }}>
                    Esta sección es exclusiva para administradores de Veritly.
                </Text>
            </View>
        );
    }

    const { current: currentKeys, previous: previousKeys } = getPeriodRanges(period);
    const currentStats = calculateMetrics(currentKeys);
    const previousStats = calculateMetrics(previousKeys);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Super Admin</Text>
                    <Text style={styles.subtitle}>Veritly Core Insights</Text>
                </View>
                <ShieldAlert color="#10b981" size={24} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* FILTERS */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                    {(['today', 'week', 'month', 'custom'] as Period[]).map((p) => (
                        <TouchableOpacity
                            key={p}
                            style={[styles.filterBtn, period === p && styles.filterBtnActive]}
                            onPress={() => p === 'custom' ? setShowDatePicker(true) : setPeriod(p)}
                        >
                            <Text style={[styles.filterText, period === p && styles.filterTextActive]}>
                                {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : '📅 Rango'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* METRICS GRID */}
                <Text style={styles.sectionTitle}>Métricas de Crecimiento</Text>
                <View style={styles.grid}>
                    <MetricCard
                        title="Nuevos Usuarios"
                        current={currentStats.users}
                        previous={previousStats.users}
                        icon={<Users size={20} color="white" />}
                        color="rgba(59, 130, 246, 0.4)"
                    />
                    <MetricCard
                        title="Sesiones (Logins)"
                        current={currentStats.logins}
                        previous={previousStats.logins}
                        icon={<Activity size={20} color="white" />}
                        color="rgba(16, 185, 129, 0.4)"
                    />
                    <MetricCard
                        title="Análisis Realizados"
                        current={currentStats.scans}
                        previous={previousStats.scans}
                        icon={<BarChart size={20} color="white" />}
                        color="rgba(139, 92, 246, 0.4)"
                    />
                    <View style={[styles.card, { backgroundColor: '#0f172a', borderStyle: 'dashed', borderColor: '#334155' }]}>
                        <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                            <Users size={20} color="#f59e0b" />
                        </View>
                        <Text style={styles.cardValue}>{stats.totalUsers || 0}</Text>
                        <Text style={styles.cardTitle}>Total Histórico</Text>
                    </View>
                </View>

                {/* LOGS MONITOR */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 15 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Monitor de Sistema</Text>
                    <TouchableOpacity style={styles.refreshBtn}>
                        <RefreshCw size={14} color="#3b82f6" />
                        <Text style={{ color: '#3b82f6', fontSize: 12, marginLeft: 5 }}>En Vivo</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.logsContainer}>
                    {logs.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>✅ Todo operando normal.</Text>
                        </View>
                    ) : (
                        logs.map((log: any) => (
                            <View key={log.id} style={[styles.logItem, log.severity === 'CRITICAL' && styles.logCritical]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View style={[styles.severityDot, { backgroundColor: log.severity === 'CRITICAL' ? '#ef4444' : '#3b82f6' }]} />
                                        <Text style={[styles.logType, { color: log.severity === 'CRITICAL' ? '#ef4444' : '#3b82f6' }]}>
                                            {log.severity}
                                        </Text>
                                    </View>
                                    <Text style={styles.logTime}>
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </Text>
                                </View>
                                <Text style={styles.logContext}>{log.context}</Text>
                                <Text style={styles.logMsg} numberOfLines={2}>{log.message}</Text>
                                <View style={styles.logFooter}>
                                    <Text style={styles.logUser}>{log.userEmail}</Text>
                                    <ChevronRight size={14} color="#475569" />
                                </View>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>

            {/* CUSTOM RANGE PICKER MODAL */}
            <Modal visible={showDatePicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rango Personalizado</Text>
                        <View style={styles.modalInputs}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalLabel}>Inicio (YYYY-MM-DD)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="2024-01-01"
                                    placeholderTextColor="#64748b"
                                    value={customRange.start}
                                    onChangeText={(t) => setCustomRange(p => ({ ...p, start: t }))}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalLabel}>Fin (YYYY-MM-DD)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="2024-01-07"
                                    placeholderTextColor="#64748b"
                                    value={customRange.end}
                                    onChangeText={(t) => setCustomRange(p => ({ ...p, end: t }))}
                                />
                            </View>
                        </View>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDatePicker(false)}>
                                <Text style={{ color: '#94a3b8' }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.applyBtn}
                                onPress={() => {
                                    setPeriod('custom');
                                    setShowDatePicker(false);
                                }}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Aplicar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b', backgroundColor: '#0f172a' },
    title: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    subtitle: { color: '#64748b', fontSize: 13 },
    content: { padding: 20 },
    sectionTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 20 },

    filterRow: { flexDirection: 'row', marginBottom: 25 },
    filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1e293b', marginRight: 10, borderWidth: 1, borderColor: '#334155' },
    filterBtnActive: { backgroundColor: '#3b82f6', borderColor: '#60a5fa' },
    filterText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
    filterTextActive: { color: 'white', fontWeight: 'bold' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    card: { width: '48%', backgroundColor: '#1e293b', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
    iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    cardValue: { color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
    cardTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
    cardPrev: { color: '#475569', fontSize: 11 },

    trendBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4 },
    trendText: { fontSize: 11, fontWeight: 'bold' },

    refreshBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },

    logsContainer: { gap: 12 },
    logItem: { backgroundColor: '#1e293b', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
    logCritical: { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' },
    severityDot: { width: 6, height: 6, borderRadius: 3 },
    logType: { fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
    logTime: { color: '#64748b', fontSize: 10 },
    logContext: { color: 'white', fontWeight: 'bold', fontSize: 15, marginTop: 10, marginBottom: 4 },
    logMsg: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
    logFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
    logUser: { color: '#475569', fontSize: 11 },

    emptyCard: { padding: 40, alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#334155' },
    emptyText: { color: '#64748b' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155' },
    modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
    modalInputs: { flexDirection: 'row', gap: 15, marginBottom: 25 },
    modalLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
    modalInput: { backgroundColor: '#0f172a', borderRadius: 12, padding: 12, color: 'white', borderColor: '#334155', borderWidth: 1 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
    cancelBtn: { padding: 12 },
    applyBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }
});
