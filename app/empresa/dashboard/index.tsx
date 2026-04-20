import { useFocusEffect, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Briefcase, LogOut, Pencil, Plus, Trash2, Activity, Zap, TrendingUp, CreditCard } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { auth, db } from '../../../config/firebase';
import FeedbackButton from '../../../components/FeedbackButton';

export default function CompanyDashboard() {
    // Note: Auth protection is already handled by the layout (_layout.tsx)
    const router = useRouter();
    const [jobs, setJobs] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [checkingProfile, setCheckingProfile] = useState(true);
    const [userPlan, setUserPlan] = useState('Freemium');
    const [totalCandidates, setTotalCandidates] = useState(0);

    const loadData = async () => {
        if (!auth.currentUser) {
            setLoading(false);
            return;
        }

        // DEBUG: Mostrar info del usuario actual
        console.log("🔍 DEBUG - Usuario actual:");
        console.log("  Email:", auth.currentUser.email);
        console.log("  UID:", auth.currentUser.uid);

        setLoading(true);
        try {
            // 1. Verificar Perfil (nueva colección con fallback)
            let userDoc = await getDoc(doc(db, 'users_empresas', auth.currentUser.uid));

            console.log("  users_empresas existe?", userDoc.exists());

            // Fallback a colección antigua
            if (!userDoc.exists()) {
                userDoc = await getDoc(doc(db, 'companies', auth.currentUser.uid));
                console.log("  companies existe?", userDoc.exists());
            }

            if (!userDoc.exists() || !userDoc.data().profileCompleted) {
                console.log("  ⚠️ Perfil no completado, redirigiendo a onboarding");
                return router.replace('/empresa/dashboard/onboarding');
            }

            console.log("  ✅ Perfil encontrado:", userDoc.data());
            setCheckingProfile(false);

            // 2. Cargar Puestos
            // NOTA: Quitamos orderBy temporalmente para evitar error de "Index Missing" en Firestore si no esta creado
            const q = query(
                collection(db, 'jobs'),
                where('companyId', '==', auth.currentUser.uid)
            );

            console.log("  🔎 Buscando jobs con companyId:", auth.currentUser.uid);

            const querySnapshot = await getDocs(q);
            const jobsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            console.log("  📊 Jobs encontrados:", jobsList.length);
            if (jobsList.length > 0) {
                console.log("  Primer job:", jobsList[0]);
            }

            // Ordenamos en cliente (más seguro por ahora)
            jobsList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // 3. Cargar conteo de candidatos para cada puesto
            const jobsWithCounts = await Promise.all(
                jobsList.map(async (job) => {
                    try {
                        const candidatesSnapshot = await getDocs(collection(db, 'jobs', job.id, 'candidates'));
                        return { ...job, candidateCount: candidatesSnapshot.size };
                    } catch (e) {
                        console.error(`Error loading candidates for job ${job.id}:`, e);
                        return { ...job, candidateCount: 0 };
                    }
                })
            );

            console.log("Jobs found:", jobsWithCounts.length);
            setJobs(jobsWithCounts);
            
            const total = jobsWithCounts.reduce((acc, job) => acc + job.candidateCount, 0);
            setTotalCandidates(total);

        } catch (e: any) {
            console.error("Error loading dashboard data", e);
            Alert.alert("Error Carga", "No pudimos cargar tus puestos: " + e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleLogout = async () => {
        await auth.signOut();
        router.replace('/empresa/signin');
    };

    const deleteJobLogic = async (jobId: string) => {
        try {
            await deleteDoc(doc(db, 'jobs', jobId));
            setJobs(prev => prev.filter(j => j.id !== jobId));
            if (Platform.OS !== 'web') Alert.alert("Eliminado", "El puesto ha sido eliminado.");
        } catch (e: any) {
            console.error("Delete error:", e);
            Alert.alert("Error", "No se pudo eliminar: " + e.message);
        }
    };

    const handleDeleteJob = (jobId: string, jobTitle: string) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`¿Estás seguro de eliminar "${jobTitle}"?`)) {
                deleteJobLogic(jobId);
            }
        } else {
            Alert.alert(
                "Eliminar Puesto",
                `¿Estás seguro de que quieres eliminar "${jobTitle}"? Esta acción no se puede deshacer.`,
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Eliminar",
                        style: "destructive",
                        onPress: () => deleteJobLogic(jobId)
                    }
                ]
            );
        }
    };

    const activeJobs = jobs.filter((j: any) => j.status === 'Open' || !j.status).length;

    const renderBetaBanner = () => (
        <View style={styles.betaBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Zap color="#f59e0b" size={18} />
                <Text style={styles.betaText}>
                    Estás usando <Text style={{fontWeight: 'bold'}}>Veritly Beta</Text>. Tu plan incluye hasta 5 vacantes activas y 200 análisis de IA.
                </Text>
            </View>
        </View>
    );

    const renderWelcomeSection = () => (
        <View style={styles.welcomeBox}>
            <Text style={styles.welcomeTitle}>¡Hola de nuevo! ✨</Text>
            <Text style={styles.welcomeSub}>Aquí tienes el resumen de tu actividad de reclutamiento.</Text>
        </View>
    );

    // Show loading while checking authorization
    if (loading && !refreshing) {
        return (
            <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: '#94a3b8', marginTop: 20 }}>Cargando panel...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <View style={styles.header}>
                <Text style={styles.title}>Dashboard</Text>
                <TouchableOpacity onPress={handleLogout}><LogOut color="#ef4444" size={24} /></TouchableOpacity>
            </View>

            <ScrollView 
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
                contentContainerStyle={[
                    { paddingBottom: 100 },
                    Platform.OS === 'web' && { maxWidth: 1100, alignSelf: 'center', width: '100%' }
                ]}
            >
                {renderBetaBanner()}
                {renderWelcomeSection()}

                {/* === METRICS DASHBOARD === */}
                <View style={styles.metricsContainer}>
                    {/* Current Plan Card */}
                    <View style={styles.planCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Zap color="#f59e0b" size={20} />
                                <Text style={styles.planTitle}>Plan Actual: {userPlan}</Text>
                            </View>
                            <TouchableOpacity onPress={() => router.push('/empresa/dashboard/pricing')}>
                                <Text style={styles.upgradeText}>Cambiar Plan</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${Math.min((totalCandidates / 200) * 100, 100)}%` }]} />
                        </View>
                        <Text style={styles.planUsageText}>
                            {totalCandidates} / 200 Análisis Utilizados • {activeJobs} / 5 Vacantes Activas
                        </Text>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <TouchableOpacity style={styles.statBox} onPress={() => router.push('/empresa/dashboard/puestos')}>
                            <Briefcase color="#38bdf8" size={24} style={{ marginBottom: 8 }} />
                            <Text style={styles.statNumber}>{activeJobs}</Text>
                            <Text style={styles.statLabel}>Vacantes Activas</Text>
                        </TouchableOpacity>
                        <View style={styles.statBox}>
                            <Activity color="#10b981" size={24} style={{ marginBottom: 8 }} />
                            <Text style={styles.statNumber}>{totalCandidates}</Text>
                            <Text style={styles.statLabel}>Análisis Realizados</Text>
                        </View>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                    <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
                    <TouchableOpacity 
                        style={styles.mainActionButton}
                        onPress={() => router.push('/empresa/dashboard/job/create')}
                    >
                        <Plus color="white" size={20} />
                        <Text style={styles.mainActionButtonText}>Publicar Nuevo Puesto</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <TouchableOpacity style={styles.fab} onPress={() => router.push('/empresa/dashboard/job/create')}>
                <Plus color="white" size={30} />
            </TouchableOpacity>

            <FeedbackButton />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: 'white' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    emptySubtext: { color: '#64748b', marginTop: 10 },
    fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#3b82f6', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
    
    betaBanner: { backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
    betaText: { color: '#fcd34d', fontSize: 13 },

    // List Styles
    jobCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 15, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
    jobTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
    jobMeta: { color: '#94a3b8', fontSize: 14 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    actionButton: { backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
    candidateBadge: { backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, minWidth: 24, alignItems: 'center' },
    candidateBadgeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
    iconButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },

    // Dashboard Styles
    metricsContainer: { marginBottom: 30 },
    planCard: { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.2)', marginBottom: 16 },
    planTitle: { fontSize: 16, fontWeight: '700', color: 'white' },
    upgradeText: { fontSize: 14, fontWeight: 'bold', color: '#38bdf8' },
    progressBarBg: { height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
    progressBarFill: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 4 },
    planUsageText: { fontSize: 13, color: '#94a3b8' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
    statBox: { flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
    statNumber: { fontSize: 32, fontWeight: '900', color: 'white', marginBottom: 4 },
    statLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 15 },
    welcomeBox: { marginBottom: 25 },
    welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 4 },
    welcomeSub: { fontSize: 14, color: '#94a3b8' },
    quickActions: { marginTop: 10 },
    mainActionButton: {
        backgroundColor: '#3b82f6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 10,
        marginTop: 10
    },
    mainActionButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
