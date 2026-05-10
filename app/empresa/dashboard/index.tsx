import { useFocusEffect, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Briefcase, LogOut, Pencil, Plus, Trash2, Activity, Zap, TrendingUp, CreditCard, Sparkles, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { auth, db } from '../../../config/firebase';
import FeedbackButton from '../../../components/FeedbackButton';

// Light Tech Theme Colors
const COLORS = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  primary: '#4F46E5',
  accent: '#06B6D4',
  border: '#E5E7EB',
  warning: '#F59E0B',
  success: '#10B981',
  error: '#EF4444',
  white: '#FFFFFF',
};

export default function CompanyDashboard() {
    const router = useRouter();
    const [jobs, setJobs] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [checkingProfile, setCheckingProfile] = useState(true);
    const [userSubscription, setUserSubscription] = useState<any>(null);
    const [totalCandidates, setTotalCandidates] = useState(0);

    const loadData = async () => {
        if (!auth.currentUser) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            let userDoc = await getDoc(doc(db, 'users_empresas', auth.currentUser.uid));
            if (!userDoc.exists()) {
                userDoc = await getDoc(doc(db, 'companies', auth.currentUser.uid));
            }

            if (!userDoc.exists() || !userDoc.data().profileCompleted) {
                return router.replace('/empresa/dashboard/onboarding');
            }

            const userData = userDoc.data();
            setUserSubscription(userData.subscription || {
                plan: 'Beta Free',
                aiAnalysisLimit: 200,
                internalVacanciesLimit: 5,
                publicVacanciesLimit: 3
            });
            const q = query(
                collection(db, 'jobs'),
                where('companyId', '==', auth.currentUser.uid)
            );

            const querySnapshot = await getDocs(q);
            const jobsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            jobsList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            const jobsWithCounts = await Promise.all(
                jobsList.map(async (job) => {
                    try {
                        const candidatesSnapshot = await getDocs(collection(db, 'jobs', job.id, 'candidates'));
                        return { ...job, candidateCount: candidatesSnapshot.size };
                    } catch (e) {
                        return { ...job, candidateCount: 0 };
                    }
                })
            );

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

    const activeJobsCount = jobs.filter((j: any) => j.status === 'Open' || !j.status).length;
    const publicJobsCount = jobs.filter((j: any) => (j.status === 'Open' || !j.status) && j.isExternal).length;

    const renderBetaBanner = () => (
        <View style={styles.betaBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.zapIconContainer}>
                    <Zap color={COLORS.warning} size={16} fill={COLORS.warning} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.betaText}>
                        Plan Actual: <Text style={{fontWeight: '700'}}>{userSubscription?.plan?.toUpperCase() || 'BETA'}</Text>
                    </Text>
                    <Text style={styles.betaSubText}>
                        Tienes {Math.max((userSubscription?.aiAnalysisLimit || 200) - totalCandidates, 0)} créditos de análisis disponibles.
                    </Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/empresa/dashboard/pricing')}>
                    <Text style={styles.upgradeTextSmall}>Ver Planes</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 20 }}>Cargando panel...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcomeTitle}>Dashboard</Text>
                    <Text style={styles.welcomeSub}>{jobs.length} Puestos Publicados</Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <LogOut color={COLORS.error} size={20} />
                </TouchableOpacity>
            </View>

            <ScrollView 
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
                contentContainerStyle={[
                    { paddingBottom: 120 },
                    Platform.OS === 'web' && { maxWidth: 1000, alignSelf: 'center', width: '100%', paddingHorizontal: 20 }
                ]}
                showsVerticalScrollIndicator={true}
            >
                {renderBetaBanner()}

                {/* Metrics */}
                <View style={styles.metricsContainer}>
                    <View style={styles.planCard}>
                        <View style={styles.planHeader}>
                            <View style={styles.planInfo}>
                                <Text style={styles.planLabel}>USO DE CRÉDITOS IA</Text>
                                <Text style={styles.planTitle}>{totalCandidates} / {userSubscription?.aiAnalysisLimit || 200}</Text>
                            </View>
                            <TrendingUp color={COLORS.primary} size={24} />
                        </View>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${Math.min((totalCandidates / (userSubscription?.aiAnalysisLimit || 200)) * 100, 100)}%` }]} />
                        </View>
                        <Text style={styles.planUsageText}>
                            Has analizado al {Math.round((totalCandidates / (userSubscription?.aiAnalysisLimit || 200)) * 100)}% de tu capacidad de IA.
                        </Text>
                    </View>

                    <View style={styles.limitsRow}>
                        {/* Internal Vacancies */}
                        <View style={styles.limitMiniCard}>
                            <View style={styles.limitMiniHeader}>
                                <Text style={styles.limitMiniLabel}>Puestos Internos</Text>
                                <Text style={styles.limitMiniValue}>{activeJobsCount} / {userSubscription?.internalVacanciesLimit || 5}</Text>
                            </View>
                            <View style={styles.miniBarBg}>
                                <View style={[styles.miniBarFill, { width: `${Math.min((activeJobsCount / (userSubscription?.internalVacanciesLimit || 5)) * 100, 100)}%` }]} />
                            </View>
                        </View>

                        {/* Public Vacancies */}
                        <View style={styles.limitMiniCard}>
                            <View style={styles.limitMiniHeader}>
                                <Text style={styles.limitMiniLabel}>Puestos Públicos</Text>
                                <Text style={styles.limitMiniValue}>{publicJobsCount} / {userSubscription?.publicVacanciesLimit || 3}</Text>
                            </View>
                            <View style={styles.miniBarBg}>
                                <View style={[styles.miniBarFill, { width: `${Math.min((publicJobsCount / (userSubscription?.publicVacanciesLimit || 3)) * 100, 100)}%`, backgroundColor: COLORS.accent }]} />
                            </View>
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        <TouchableOpacity style={styles.statBox} onPress={() => router.push('/empresa/dashboard/puestos')}>
                            <View style={[styles.statIconBox, { backgroundColor: 'rgba(79, 70, 229, 0.1)' }]}>
                                <Briefcase color={COLORS.primary} size={20} />
                            </View>
                            <Text style={styles.statNumber}>{activeJobsCount}</Text>
                            <Text style={styles.statLabel}>Vacantes</Text>
                        </TouchableOpacity>
                        
                        <View style={styles.statBox}>
                            <View style={[styles.statIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                <Activity color={COLORS.success} size={20} />
                            </View>
                            <Text style={styles.statNumber}>{totalCandidates}</Text>
                            <Text style={styles.statLabel}>Total Candidatos</Text>
                        </View>

                        <TouchableOpacity style={styles.statBox} onPress={() => router.push('/empresa/dashboard/job/create')}>
                            <View style={[styles.statIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.1)' }]}>
                                <Plus color={COLORS.accent} size={20} />
                            </View>
                            <Text style={styles.statNumber}>+</Text>
                            <Text style={styles.statLabel}>Crear</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Active Jobs List Quick Peek */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Puestos Recientes</Text>
                    <TouchableOpacity onPress={() => router.push('/empresa/dashboard/puestos')}>
                        <Text style={styles.seeAllText}>Ver todos</Text>
                    </TouchableOpacity>
                </View>

                {jobs.slice(0, 3).map((job) => (
                    <TouchableOpacity 
                        key={job.id} 
                        style={styles.jobCard}
                        onPress={() => router.push({
                            pathname: "/empresa/job/[id]",
                            params: { id: job.id, title: job.jobTitle }
                        })}
                    >
                        <View style={styles.jobCardContent}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.jobCardTitle} numberOfLines={1}>{job.jobTitle}</Text>
                                <Text style={styles.jobCardMeta}>
                                    {job.candidateCount} candidatos • {new Date(job.createdAt).toLocaleDateString()}
                                </Text>
                            </View>
                            <View style={styles.jobCardRight}>
                                <View style={styles.candidateBadge}>
                                    <Text style={styles.candidateBadgeText}>{job.candidateCount}</Text>
                                </View>
                                <ChevronRight size={20} color={COLORS.textTertiary} />
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}

                {jobs.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Sparkles size={40} color={COLORS.textTertiary} />
                        <Text style={styles.emptyTitle}>Comienza tu selección</Text>
                        <Text style={styles.emptyText}>Publica tu primer puesto para empezar a recibir candidatos filtrados por IA.</Text>
                        <TouchableOpacity 
                            style={styles.emptyBtn}
                            onPress={() => router.push('/empresa/dashboard/job/create')}
                        >
                            <Text style={styles.emptyBtnText}>Publicar Vacante</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity 
                style={styles.fab} 
                onPress={() => router.push('/empresa/dashboard/job/create')}
            >
                <Plus color="white" size={28} />
            </TouchableOpacity>

            <FeedbackButton />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: COLORS.background 
    },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 24,
        backgroundColor: COLORS.background
    },
    welcomeTitle: { 
        fontSize: 24, 
        fontWeight: '800', 
        color: COLORS.textPrimary,
        letterSpacing: -0.5
    },
    welcomeSub: { 
        fontSize: 14, 
        color: COLORS.textSecondary,
        marginTop: 4
    },
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    
    betaBanner: { 
        backgroundColor: COLORS.white, 
        padding: 16, 
        borderRadius: 16, 
        marginBottom: 24, 
        borderWidth: 1, 
        borderColor: COLORS.border,
        shadowColor: COLORS.textPrimary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    zapIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    betaText: { 
        color: COLORS.textPrimary, 
        fontSize: 14,
        fontWeight: '500'
    },
    betaSubText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 2
    },
    upgradeTextSmall: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 12,
        textDecorationLine: 'underline'
    },

    metricsContainer: { 
        marginBottom: 32 
    },
    planCard: { 
        backgroundColor: COLORS.white, 
        borderRadius: 20, 
        padding: 24, 
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.textPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 1
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    planLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textTertiary,
        letterSpacing: 1
    },
    planTitle: { 
        fontSize: 24, 
        fontWeight: '800', 
        color: COLORS.textPrimary,
        marginTop: 4
    },
    progressBarBg: { 
        height: 10, 
        backgroundColor: '#F3F4F6', 
        borderRadius: 5, 
        overflow: 'hidden', 
        marginBottom: 12 
    },
    progressBarFill: { 
        height: '100%', 
        backgroundColor: COLORS.primary, 
        borderRadius: 5 
    },
    planUsageText: { 
        fontSize: 13, 
        color: COLORS.textSecondary 
    },
    
    statsRow: { 
        flexDirection: 'row', 
        gap: 12 
    },
    statBox: { 
        flex: 1, 
        backgroundColor: COLORS.white, 
        borderRadius: 16, 
        padding: 16, 
        alignItems: 'flex-start',
        borderWidth: 1, 
        borderColor: COLORS.border,
    },
    statIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12
    },
    statNumber: { 
        fontSize: 22, 
        fontWeight: '800', 
        color: COLORS.textPrimary, 
        marginBottom: 2 
    },
    statLabel: { 
        fontSize: 11, 
        color: COLORS.textSecondary, 
        fontWeight: '600',
        textTransform: 'uppercase'
    },

    // Mini Limits
    limitsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20
    },
    limitMiniCard: {
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    limitMiniHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    limitMiniLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textTertiary,
        textTransform: 'uppercase'
    },
    limitMiniValue: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.textPrimary
    },
    miniBarBg: {
        height: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 3,
        overflow: 'hidden'
    },
    miniBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 3
    },

    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    sectionTitle: { 
        fontSize: 18, 
        fontWeight: '800', 
        color: COLORS.textPrimary,
        letterSpacing: -0.5
    },
    seeAllText: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '600'
    },

    jobCard: { 
        backgroundColor: COLORS.white, 
        borderRadius: 16, 
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    jobCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
    },
    jobCardTitle: { 
        color: COLORS.textPrimary, 
        fontSize: 16, 
        fontWeight: '700', 
        marginBottom: 4 
    },
    jobCardMeta: { 
        color: COLORS.textSecondary, 
        fontSize: 13 
    },
    jobCardRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    candidateBadge: { 
        backgroundColor: 'rgba(79, 70, 229, 0.1)', 
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 8, 
        minWidth: 32, 
        alignItems: 'center' 
    },
    candidateBadgeText: { 
        color: COLORS.primary, 
        fontSize: 12, 
        fontWeight: '800' 
    },

    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 16,
        marginBottom: 8
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24
    },
    emptyBtn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10
    },
    emptyBtnText: {
        color: COLORS.white,
        fontWeight: '700',
        fontSize: 15
    },

    fab: { 
        position: 'absolute', 
        bottom: 30, 
        right: 24, 
        backgroundColor: COLORS.primary, 
        width: 60, 
        height: 60, 
        borderRadius: 30, 
        alignItems: 'center', 
        justifyContent: 'center', 
        elevation: 8, 
        shadowColor: COLORS.primary, 
        shadowOffset: { width: 0, height: 6 }, 
        shadowOpacity: 0.3, 
        shadowRadius: 12 
    },
});
