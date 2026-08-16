import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendEmailVerification } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Briefcase, LogOut, Pencil, Plus, Trash2, Activity, Zap, TrendingUp, CreditCard, Sparkles, ChevronRight, RotateCw } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert as RNAlert, FlatList, Platform, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View, ScrollView, useWindowDimensions } from 'react-native';
import { auth, db } from '../../../config/firebase';
import FeedbackButton from '../../../components/FeedbackButton';
import { getEffectiveCompanyId } from '../../../services/auth-service';

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

const TooltipWrapper = Platform.OS === 'web' 
  ? ({ title, children, style }: any) => <div title={title} style={{ display: 'flex', flexDirection: 'column', ...style }}>{children}</div>
  : ({ children, style }: any) => <View style={style}>{children}</View>;

const Alert = {
    alert: (title: string, message?: string, buttons?: any) => {
        if (Platform.OS === 'web') {
            if (buttons && buttons.length > 1) {
                const confirmBtn = buttons.find((b: any) => b.style === 'destructive' || b.text === 'Eliminar' || b.text === 'Sincronizar');
                const cancelBtn = buttons.find((b: any) => b.style === 'cancel' || b.text === 'Cancelar');
                const confirmed = window.confirm(`${title}\n\n${message || ''}`);
                if (confirmed) {
                    if (confirmBtn && typeof confirmBtn.onPress === 'function') {
                        confirmBtn.onPress();
                    }
                } else {
                    if (cancelBtn && typeof cancelBtn.onPress === 'function') {
                        cancelBtn.onPress();
                    }
                }
            } else {
                window.alert(`${title}${message ? '\n\n' + message : ''}`);
                if (buttons && buttons.length === 1) {
                    if (typeof buttons[0].onPress === 'function') {
                        buttons[0].onPress();
                    }
                }
            }
        } else {
            RNAlert.alert(title, message, buttons);
        }
    }
};

export default function CompanyDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const showPublishText = width > 480;
    const [jobs, setJobs] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [checkingProfile, setCheckingProfile] = useState(true);
    const [userSubscription, setUserSubscription] = useState<any>(null);
    const [totalCandidates, setTotalCandidates] = useState(0);
    const [totalAnalyzedCandidates, setTotalAnalyzedCandidates] = useState(0);

    // Nuevos estados para seguridad progresiva y guía interactiva
    const [isEmailVerified, setIsEmailVerified] = useState(true);
    const [isProfileSkipped, setIsProfileSkipped] = useState(false);
    const [tourStep, setTourStep] = useState(0);

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
                onRefresh();
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
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>
                    {refreshing ? "Actualizando..." : (pullDistance > 45 ? "Suelta para actualizar" : "Desliza para actualizar")}
                </Text>
            </View>
        );
    };

    const startInteractiveTour = () => {
        setTourStep(1);
    };

    const handleNextTour = () => {
        if (tourStep < 5) {
            setTourStep(tourStep + 1);
        } else {
            setTourStep(0);
            if (auth.currentUser) {
                AsyncStorage.setItem(`seen_tour_${auth.currentUser.uid}`, 'true').catch(e => console.log(e));
            }
        }
    };

    const handleSkipTour = () => {
        setTourStep(0);
        if (auth.currentUser) {
            AsyncStorage.setItem(`seen_tour_${auth.currentUser.uid}`, 'true').catch(e => console.log(e));
        }
    };

    const handleResendVerification = async () => {
        try {
            if (auth.currentUser) {
                await sendEmailVerification(auth.currentUser);
                Alert.alert("Correo Enviado", "Hemos reenviado el correo de verificación. Revisa tu bandeja de entrada.");
            }
        } catch (e: any) {
            Alert.alert("Error", "No se pudo reenviar el correo: " + e.message);
        }
    };

    const loadData = async () => {
        if (!auth.currentUser) {
            setLoading(false);
            return;
        }

        if (jobs.length === 0) {
            setLoading(true);
        }
        try {
            const companyId = await getEffectiveCompanyId(auth.currentUser.uid);
            let userDoc = await getDoc(doc(db, 'users_empresas', companyId));
            if (!userDoc.exists()) {
                userDoc = await getDoc(doc(db, 'companies', companyId));
            }

            if (!userDoc.exists() || !userDoc.data().profileCompleted) {
                return router.replace('/empresa/dashboard/profile');
            }

            const userData = userDoc.data();
            let subscription = userData.subscription || { plan: 'beta_free' };
            
            setIsProfileSkipped(!!userData.profileSkipped);

            if (auth.currentUser) {
                try {
                    await auth.currentUser.reload();
                    setIsEmailVerified(auth.currentUser.emailVerified);
                } catch (reloadErr) {
                    console.log("Error reloading user info:", reloadErr);
                }
            }
            
            // [FIX] Query by 'id' field instead of Doc ID
            try {
                const planId = (subscription.plan || 'beta_free').toLowerCase().replace(' ', '_');
                const plansRef = collection(db, 'config_plans');
                const qPlan = query(plansRef, where('id', '==', planId));
                const planSnap = await getDocs(qPlan);
                
                if (!planSnap.empty) {
                    const planData = planSnap.docs[0].data();
                    subscription = {
                        ...subscription,
                        internalVacanciesLimit: planData.internalVacanciesLimit ?? subscription.internalVacanciesLimit,
                        publicVacanciesLimit: planData.publicVacanciesLimit ?? subscription.publicVacanciesLimit,
                        killerQuestionsLimit: planData.killerQuestionsLimit ?? subscription.killerQuestionsLimit,
                        aiAnalysisLimit: planData.aiAnalysisLimit ?? subscription.aiAnalysisLimit,
                        planName: planData.name || subscription.planName
                    };
                }
            } catch (planErr) {
                console.error("Error syncing dashboard plan limits:", planErr);
            }

            setUserSubscription(subscription);
            const q = query(
                collection(db, 'jobs'),
                where('companyId', '==', companyId)
            );

            const querySnapshot = await getDocs(q);
            const jobsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            jobsList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // El limite de "Analisis IA" del plan es mensual, asi que solo contamos
            // candidatos analizados dentro del mes calendario actual.
            const now = new Date();
            const isThisMonth = (raw: any): boolean => {
                if (!raw) return false;
                const d = raw?.toDate ? raw.toDate() : new Date(raw);
                if (isNaN(d.getTime())) return false;
                return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            };

            const jobsWithCounts = await Promise.all(
                jobsList.map(async (job) => {
                    try {
                        const candidatesSnapshot = await getDocs(collection(db, 'jobs', job.id, 'candidates'));
                        const candidates = candidatesSnapshot.docs.map(doc => doc.data());
                        const analyzedCount = candidates.filter((c: any) =>
                            c.matchScore && c.matchScore > 0 && isThisMonth(c.analyzedAt)
                        ).length;
                        return {
                            ...job,
                            candidateCount: candidatesSnapshot.size,
                            analyzedCount: analyzedCount
                        };
                    } catch (e) {
                        return { ...job, candidateCount: 0, analyzedCount: 0 };
                    }
                })
            );

            setJobs(jobsWithCounts);
            const total = jobsWithCounts.reduce((acc, job) => acc + job.candidateCount, 0);
            const totalAnalyzed = jobsWithCounts.reduce((acc, job) => acc + (job.analyzedCount || 0), 0);
            setTotalCandidates(total);
            setTotalAnalyzedCandidates(totalAnalyzed);

            // Disparar tour automáticamente si no tienen vacantes y es su primera vez
            if (jobsWithCounts.length === 0 && auth.currentUser) {
                try {
                    const seen = await AsyncStorage.getItem(`seen_tour_${auth.currentUser.uid}`);
                    if (!seen) {
                        setTourStep(1);
                    }
                } catch (storeErr) {
                    console.log("Error reading tour flag:", storeErr);
                }
            }

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
            if (auth.currentUser) {
                loadData();
            }
        }, [auth.currentUser])
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
                        Tienes {Math.max((userSubscription?.aiAnalysisLimit || 200) - totalAnalyzedCandidates, 0)} créditos de análisis disponibles.
                    </Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/empresa/dashboard/pricing')}>
                    <Text style={styles.upgradeTextSmall}>Ver Planes</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderTourOverlay = () => {
        if (tourStep === 0) return null;

        const steps = [
            {
                title: "👋 ¡Bienvenido a Veritly!",
                description: "Vamos a guiarte rápidamente por el panel en 5 pasos para que conozcas la herramienta y publiques tu primer puesto hoy.",
                btnText: "Iniciar Guía"
            },
            {
                title: "➕ Publicar Vacante",
                description: "Haz clic en este botón en cualquier momento para redactar un puesto con IA o subir un PDF de perfil de cargo.",
                btnText: "Siguiente"
            },
            {
                title: "🎯 Auto-filtrado de Candidatos",
                description: "Al crear el puesto, puedes configurar expectativas salariales y preguntas filtro (killer questions). Los candidatos que no cumplan se auto-descartarán sin que tengas que verlos ni consumir créditos.",
                btnText: "Siguiente"
            },
            {
                title: "📊 Créditos de IA",
                description: "Tú eliges qué candidatos analizar a fondo con nuestra IA. Cada análisis de perfil detallado consume un crédito de tu plan.",
                btnText: "Siguiente"
            },
            {
                title: "⚙️ Gestión de Puestos",
                description: "Controla tu capacidad de vacantes, copia el enlace de postulación y compártelo directamente en tus redes de LinkedIn.",
                btnText: "Finalizar"
            }
        ];

        const currentStep = steps[tourStep - 1];

        return (
            <View style={styles.tourBackdrop}>
                <View style={styles.tourCard}>
                    <View style={styles.tourProgressRow}>
                        <Text style={styles.tourStepIndicator}>Paso {tourStep} de 5</Text>
                        <TouchableOpacity onPress={handleSkipTour}>
                            <Text style={styles.tourSkipText}>Omitir</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.tourTitle}>{currentStep.title}</Text>
                    <Text style={styles.tourDescription}>{currentStep.description}</Text>
                    <View style={styles.tourFooter}>
                        <TouchableOpacity style={styles.tourBtn} onPress={handleNextTour}>
                            <Text style={styles.tourBtnText}>{currentStep.btnText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

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
                <View style={{ flex: 1 }}>
                    <Text style={styles.welcomeTitle}>Dashboard</Text>
                    <Text style={styles.welcomeSub}>{jobs.length} Puestos en total</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TooltipWrapper title="Actualizar Datos">
                        <TouchableOpacity 
                            style={styles.headerTourBtn} 
                            onPress={onRefresh}
                            disabled={refreshing}
                        >
                            {refreshing ? (
                                <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                                <RotateCw color={COLORS.primary} size={16} />
                            )}
                        </TouchableOpacity>
                    </TooltipWrapper>

                    <TooltipWrapper title="Ver Guía del Dashboard">
                        <TouchableOpacity 
                            style={styles.headerTourBtn} 
                            onPress={startInteractiveTour}
                        >
                            <Text style={styles.headerTourBtnText}>?</Text>
                        </TouchableOpacity>
                    </TooltipWrapper>
                    <TooltipWrapper title="Publicar Nueva Vacante">
                        <TouchableOpacity 
                            style={styles.headerPublishBtn} 
                            onPress={() => router.push('/empresa/dashboard/job/create')}
                        >
                            <Plus color="white" size={16} style={{ marginRight: showPublishText ? 4 : 0 }} />
                            {showPublishText && <Text style={styles.headerPublishBtnText}>Publicar Vacante</Text>}
                        </TouchableOpacity>
                    </TooltipWrapper>
                    <TooltipWrapper title="Cerrar Sesión">
                        <TouchableOpacity 
                            style={styles.logoutBtn} 
                            onPress={handleLogout}
                        >
                            <LogOut color={COLORS.error} size={20} />
                        </TouchableOpacity>
                    </TooltipWrapper>
                </View>
            </View>

            <ScrollView 
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
                contentContainerStyle={[
                    { paddingBottom: 120 },
                    Platform.OS === 'web' && { maxWidth: 1000, alignSelf: 'center', width: '100%', paddingHorizontal: 20 }
                ]}
                showsVerticalScrollIndicator={true}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {renderWebRefreshIndicator()}
                {/* Email Verification Banner */}
                {!isEmailVerified && auth.currentUser?.email !== 'oscar@veritlyapp.com' && (
                    <View style={styles.warningBanner}>
                        <Text style={styles.warningBannerText}>
                            ⚠️ Verifica tu correo para activar las vacantes públicas y poder ver postulantes.
                        </Text>
                        <TouchableOpacity onPress={handleResendVerification}>
                            <Text style={styles.bannerActionText}>Reenviar</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Profile Skipped Banner */}
                {isProfileSkipped && (
                    <View style={styles.infoBanner}>
                        <Text style={styles.infoBannerText}>
                            💡 Completa tu perfil corporativo para registrar datos de contacto oficiales.
                        </Text>
                        <TouchableOpacity onPress={() => router.push('/empresa/dashboard/profile')}>
                            <Text style={[styles.bannerActionText, { color: COLORS.primary }]}>Completar</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Empty State al Inicio */}
                {jobs.length === 0 && (
                    <View style={[styles.emptyContainer, { backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 24, marginBottom: 24, shadowColor: COLORS.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }]}>
                        <Sparkles size={40} color={COLORS.primary} />
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
                
                {renderBetaBanner()}

                {/* Metrics */}
                <View style={styles.metricsContainer}>
                    <View style={styles.planCard}>
                        <View style={styles.planHeader}>
                            <View style={styles.planInfo}>
                                <Text style={styles.planLabel}>USO DE CRÉDITOS IA</Text>
                                <Text style={styles.planTitle}>{totalAnalyzedCandidates} / {userSubscription?.aiAnalysisLimit || 200}</Text>
                            </View>
                            <TrendingUp color={COLORS.primary} size={24} />
                        </View>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${Math.min((totalAnalyzedCandidates / (userSubscription?.aiAnalysisLimit || 200)) * 100, 100)}%` }]} />
                        </View>
                        <Text style={styles.planUsageText}>
                            Has analizado al {Math.round((totalAnalyzedCandidates / (userSubscription?.aiAnalysisLimit || 200)) * 100)}% de tu capacidad de IA.
                        </Text>
                    </View>

                    <View style={styles.limitsRow}>
                        {/* Vacantes Activas (total, internas + públicas) */}
                        <View style={styles.limitMiniCard}>
                            <View style={styles.limitMiniHeader}>
                                <Text style={styles.limitMiniLabel}>Vacantes Activas</Text>
                                <Text style={styles.limitMiniValue}>{jobs.length} / {userSubscription?.internalVacanciesLimit || 10}</Text>
                            </View>
                            <View style={styles.miniBarBg}>
                                <View style={[styles.miniBarFill, { width: `${Math.min((activeJobsCount / (userSubscription?.internalVacanciesLimit || 10)) * 100, 100)}%` }]} />
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

                {/* El empty state antiguo se ha removido de aquí */}
            </ScrollView>

            <TooltipWrapper 
                title="Publicar Vacante" 
                style={{ position: 'absolute', bottom: 30, right: 24, zIndex: 999 }}
            >
                <TouchableOpacity 
                    style={[styles.fab, { position: 'relative', bottom: 0, right: 0 }]} 
                    onPress={() => router.push('/empresa/dashboard/job/create')}
                >
                    <Plus color="white" size={28} />
                </TouchableOpacity>
            </TooltipWrapper>

            <FeedbackButton />
            {renderTourOverlay()}
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
    planInfo: {
        flex: 1,
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
    warningBanner: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    warningBannerText: {
        color: '#92400E',
        fontSize: 13,
        fontWeight: '600',
        flex: 1
    },
    infoBanner: {
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    infoBannerText: {
        color: '#0369A1',
        fontSize: 13,
        fontWeight: '600',
        flex: 1
    },
    bannerActionText: {
        fontWeight: '700',
        fontSize: 13,
        color: '#B45309',
        marginLeft: 10,
        textDecorationLine: 'underline'
    },
    headerTourBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB'
    },
    headerTourBtnText: {
        fontWeight: '800',
        fontSize: 16,
        color: '#4B5563'
    },
    headerPublishBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4F46E5',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    headerPublishBtnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 12,
        marginLeft: 4
    },
    tourBackdrop: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: 24
    },
    tourCard: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        maxWidth: 400,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10
    },
    tourProgressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    tourStepIndicator: {
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    tourSkipText: {
        color: '#9CA3AF',
        fontWeight: '600',
        fontSize: 12,
        textDecorationLine: 'underline'
    },
    tourTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 8
    },
    tourDescription: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 20,
        marginBottom: 20
    },
    tourFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end'
    },
    tourBtn: {
        backgroundColor: '#4F46E5',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20
    },
    tourBtnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 13
    }
});
