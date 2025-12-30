import { useRouter } from 'expo-router';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Activity, BarChart, Lock, RefreshCw, ShieldAlert, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { auth, db } from '../../config/firebase';

// --- CONFIGURACIÓN DE SEGURIDAD ---
const ADMIN_EMAILS = ['test+1@gmail.com', 'oscar@veritlyapp.com', 'oscar@relielabs.com'];

export default function AnalyticsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [stats, setStats] = useState<any>({});
    const [logs, setLogs] = useState<any[]>([]);

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

    const StatCard = ({ title, value, icon, color }: any) => (
        <View style={styles.card}>
            <View style={[styles.iconBox, { backgroundColor: color }]}>
                {icon}
            </View>
            <View>
                <Text style={styles.cardValue}>{value || 0}</Text>
                <Text style={styles.cardTitle}>{title}</Text>
            </View>
        </View>
    );

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ color: 'white', marginTop: 10 }}>Cargando Analytics...</Text>
        </View>
    );

    // --- VISTA NO AUTORIZADA ---
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

    // --- VISTA DASHBOARD ---
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Analytics & Logs</Text>
                <ShieldAlert color="#10b981" size={24} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* METRICS GRID */}
                <Text style={styles.sectionTitle}>Tráfico Real</Text>
                <View style={styles.grid}>
                    <StatCard
                        title="Usuarios"
                        value={stats.totalUsers}
                        icon={<Users size={20} color="white" />}
                        color="rgba(59, 130, 246, 0.2)"
                    />
                    <StatCard
                        title="Logins"
                        value={stats.totalLogins}
                        icon={<Activity size={20} color="white" />}
                        color="rgba(16, 185, 129, 0.2)"
                    />
                    <StatCard
                        title="Scans Completados"
                        value={stats.totalScans}
                        icon={<BarChart size={20} color="white" />}
                        color="rgba(139, 92, 246, 0.2)"
                    />
                    <StatCard
                        title="Actividad Hoy"
                        value={stats.dailyLogins?.[new Date().toISOString().split('T')[0]]}
                        icon={<RefreshCw size={20} color="white" />}
                        color="rgba(245, 158, 11, 0.2)"
                    />
                </View>

                {/* LOGS MONITOR */}
                <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Monitor de Sistema</Text>
                <View style={styles.logsContainer}>
                    {logs.length === 0 ? (
                        <Text style={styles.emptyText}>✅ Todo operando normal.</Text>
                    ) : (
                        logs.map((log: any) => (
                            <View key={log.id} style={[styles.logItem, log.severity === 'CRITICAL' && styles.logCritical]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={[styles.logType, { color: log.severity === 'CRITICAL' ? '#ef4444' : '#3b82f6' }]}>
                                        {log.severity}
                                    </Text>
                                    <Text style={styles.logTime}>
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </Text>
                                </View>
                                <Text style={styles.logContext}>{log.context}</Text>
                                <Text style={styles.logMsg}>{log.message}</Text>
                                <Text style={styles.logUser}>{log.userEmail}</Text>
                            </View>
                        ))
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    title: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    content: { padding: 20 },
    sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
    card: { width: '47%', backgroundColor: '#1e293b', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
    iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    cardValue: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    cardTitle: { color: '#94a3b8', fontSize: 12 },

    logsContainer: { gap: 10 },
    logItem: { backgroundColor: '#1e293b', padding: 15, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
    logCritical: { borderLeftColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' },
    logType: { fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
    logTime: { color: '#64748b', fontSize: 10 },
    logContext: { color: 'white', fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
    logMsg: { color: '#cbd5e1', fontSize: 13, marginBottom: 6 },
    logUser: { color: '#475569', fontSize: 11, fontStyle: 'italic' },
    emptyText: { color: '#64748b', textAlign: 'center', marginTop: 20 }
});
