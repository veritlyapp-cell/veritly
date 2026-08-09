import { collection, getDocs, orderBy, query, updateDoc, doc, setDoc, where, limit, collectionGroup, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Building2, CreditCard, DollarSign, Edit3, ShieldCheck, TrendingUp, Users, RefreshCw, Key, Plus, MessageSquare, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, TextInput, Modal, Platform } from 'react-native';
import { auth, db } from '../../../config/firebase';
import { CompanyProfile } from '../../../services/auth-service';
import { sendPasswordResetEmail } from 'firebase/auth';

const COLORS = {
    background: '#F9FAFB',
    surface: '#FFFFFF',
    textPrimary: '#111827',
    textSecondary: '#4B5563',
    textTertiary: '#9CA3AF',
    primary: '#4F46E5',
    accent: '#06B6D4',
    border: '#E5E7EB',
    white: '#FFFFFF',
    success: '#10B981',
};

const PREDEFINED_FEATURES = [
    "Subida CVs (PDF/Word)",
    "Subida masiva por Excel",
    "Análisis de IA",
    "Vacantes Internas",
    "Vacantes Públicas",
    "Exportación a Excel/PDF",
    "Soporte VIP Directo",
    "Filtros Avanzados",
    "Dashboards de Analítica",
    "API Access / SSO"
];

export default function EmpresaAdminDashboard() {
    const router = useRouter();
    const [companies, setCompanies] = useState<CompanyProfile[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [candidatesCounts, setCandidatesCounts] = useState<Record<string, number>>({});
    const [totalJobsCounts, setTotalJobsCounts] = useState<Record<string, number>>({});
    const [publicJobsCounts, setPublicJobsCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [totalB2C, setTotalB2C] = useState(0);
    const [totalB2CRegistered, setTotalB2CRegistered] = useState(0);
    const [totalB2CRegisteredWithMatch, setTotalB2CRegisteredWithMatch] = useState(0);
    const [totalB2CAnonWithMatch, setTotalB2CAnonWithMatch] = useState(0);
    const [totalRacsoClicks, setTotalRacsoClicks] = useState(0);
    const [activeTab, setActiveTab] = useState<'cuentas' | 'planes' | 'feedback' | 'b2c'>('cuentas');
    const [feedback, setFeedback] = useState<any[]>([]);
    
    // Edit Modal State (Cuentas)
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<CompanyProfile | null>(null);
    const [editSub, setEditSub] = useState({
        plan: '',
        aiAnalysisLimit: 0,
        internalVacanciesLimit: 0,
        publicVacanciesLimit: 0,
        killerQuestionsLimit: 0,
    });

    // Plan Modal State
    const [planModalVisible, setPlanModalVisible] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [newPlan, setNewPlan] = useState({
        id: '',
        name: '',
        aiAnalysisLimit: 200,
        internalVacanciesLimit: 10,
        publicVacanciesLimit: 5,
        killerQuestionsLimit: 2,
        maxAdmins: 1,
        maxRecruiters: 0,
        priceMonthly: 0,
        priceAnnual: 0,
        stripePriceIdMonthly: '',
        stripePriceIdAnnual: '',
        isComingSoon: false,
        isRecommended: false,
        isHidden: false,
        features: [] as string[],
    });

    useEffect(() => {
        const user = auth.currentUser;
        if (user && (user.email === 'oscar@veritlyapp.com' || user.email === 'oscar@relielabs.com')) {
            setIsAdmin(true);
            fetchData();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchData = async () => {
        try {
            // Fetch Accounts
            const q = query(collection(db, 'users_empresas'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => doc.data() as CompanyProfile);
            setCompanies(data);
            
            // Fetch Plans
            const plansSnap = await getDocs(collection(db, 'config_plans'));
            setPlans(plansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Fetch dynamic candidate counts and job metrics to keep AI usage synchronized
            const jobsSnap = await getDocs(collection(db, 'jobs'));
            const jobCompanyMap: Record<string, string> = {};
            const totalJobsMap: Record<string, number> = {};
            const publicJobsMap: Record<string, number> = {};
            
            jobsSnap.docs.forEach(doc => {
                const jobData = doc.data();
                const companyId = jobData.companyId || '';
                jobCompanyMap[doc.id] = companyId;
                if (companyId) {
                    totalJobsMap[companyId] = (totalJobsMap[companyId] || 0) + 1;
                    if (jobData.isExternal === true) {
                        publicJobsMap[companyId] = (publicJobsMap[companyId] || 0) + 1;
                    }
                }
            });
            setTotalJobsCounts(totalJobsMap);
            setPublicJobsCounts(publicJobsMap);

            const counts: Record<string, number> = {};
            try {
                const candidatesSnap = await getDocs(query(collectionGroup(db, 'candidates')));
                candidatesSnap.docs.forEach(doc => {
                    const candData = doc.data();
                    const jobId = candData.jobId || doc.ref.parent.parent?.id || '';
                    const companyId = candData.companyId || jobCompanyMap[jobId] || '';
                    if (companyId) {
                        counts[companyId] = (counts[companyId] || 0) + 1;
                    }
                });
                setCandidatesCounts(counts);
            } catch (groupError) {
                console.error("Error fetching collectionGroup candidates:", groupError);
            }

            // Fetch B2C metrics
            try {
                const candsSnap = await getDocs(collection(db, 'users_candidatos'));
                setTotalB2C(candsSnap.size);

                const registeredCands = candsSnap.docs.filter(docSnap => {
                    const email = docSnap.data().email;
                    return email && email.includes('@');
                });
                setTotalB2CRegistered(registeredCands.length);
                
                const registeredWithMatch = registeredCands.filter(docSnap => {
                    const data = docSnap.data();
                    return data.lastMatches && Object.keys(data.lastMatches).length > 0;
                });
                setTotalB2CRegisteredWithMatch(registeredWithMatch.length);

                const anonymousWithMatch = candsSnap.docs.filter(docSnap => {
                    const data = docSnap.data();
                    const email = data.email;
                    const hasEmail = email && email.includes('@');
                    return !hasEmail && data.lastMatches && Object.keys(data.lastMatches).length > 0;
                });
                setTotalB2CAnonWithMatch(anonymousWithMatch.length);
            } catch (b2cError) {
                console.error("Error fetching total B2C candidates:", b2cError);
            }

            // Fetch Feedback
            try {
                const feedbackSnap = await getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(50)));
                setFeedback(feedbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch(e) {}

            // Fetch Racso clicks
            try {
                const clicksSnap = await getDocs(collection(db, 'racso_clicks'));
                setTotalRacsoClicks(clicksSnap.size);
            } catch (clicksError) {
                console.error("Error fetching Racso clicks count:", clicksError);
            }
        } catch (error) {
            console.error("Error cargando data admin:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const MetricsTabs = () => {
        const totalCompanies = companies.length;
        const totalPro = companies.filter(c => c.subscription?.plan?.includes('pro')).length;
        
        return (
            <View style={{ marginBottom: 20 }}>
                <View style={styles.metricsWrapper}>
                    <View style={[styles.metricCard, { backgroundColor: COLORS.primary }]}>
                        <Users color="white" size={20} />
                        <Text style={[styles.metricValue, { color: 'white' }]}>{totalB2C}</Text>
                        <Text style={[styles.metricLabel, { color: 'rgba(255,255,255,0.7)' }]}>Candidatos B2C</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Building2 color={COLORS.primary} size={20} />
                        <Text style={styles.metricValue}>{totalCompanies}</Text>
                        <Text style={styles.metricLabel}>Empresas</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <CreditCard color={COLORS.accent} size={20} />
                        <Text style={styles.metricValue}>{totalPro}</Text>
                        <Text style={styles.metricLabel}>Cuentas PRO</Text>
                    </View>
                </View>

                {/* Tabs Selector */}
                <View style={styles.tabSelector}>
                    <TouchableOpacity 
                        style={[styles.tabBtn, activeTab === 'cuentas' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('cuentas')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'cuentas' && styles.tabBtnTextActive]}>Cuentas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabBtn, activeTab === 'planes' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('planes')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'planes' && styles.tabBtnTextActive]}>Configurar Planes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabBtn, activeTab === 'feedback' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('feedback')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'feedback' && styles.tabBtnTextActive]}>Sugerencias</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabBtn, activeTab === 'b2c' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('b2c')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'b2c' && styles.tabBtnTextActive]}>B2C IA</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const handleSaveEdit = async () => {
        if (!selectedCompany) return;
        try {
            await setDoc(doc(db, 'users_empresas', selectedCompany.uid), {
                subscription: {
                    ...selectedCompany.subscription,
                    ...editSub,
                    updatedAt: new Date()
                }
            }, { merge: true });
            
            Alert.alert("Éxito", "Cuenta actualizada.");
            setEditModalVisible(false);
            fetchData();
        } catch (error) {
            Alert.alert("Error", "No se pudo actualizar " + error);
        }
    };

    const handleSavePlan = async () => {
        try {
            if (!newPlan.id) {
                Alert.alert("Error", "El plan debe tener un ID único (ej: beta_free, plan_pro)");
                return;
            }
            await setDoc(doc(db, 'config_plans', newPlan.id), {
                ...newPlan,
                isRecommended: newPlan.isRecommended || false,
                isComingSoon: newPlan.isComingSoon || false,
                isHidden: newPlan.isHidden || false,
                updatedAt: new Date()
            });
            Alert.alert("Éxito", "Plan guardado.");
            setPlanModalVisible(false);
            fetchData();
        } catch (error) {
            Alert.alert("Error", "No se pudo guardar el plan");
        }
    };

    const handleRestoreDefaults = async () => {
        const defaults = [
            {
                id: 'beta_free',
                name: 'Beta Free',
                aiAnalysisLimit: 100,
                internalVacanciesLimit: 5,
                publicVacanciesLimit: 5,
                killerQuestionsLimit: 3,
                maxAdmins: 1,
                maxRecruiters: 0,
                priceMonthly: 0,
                priceAnnual: 0,
                stripePriceIdMonthly: '',
                stripePriceIdAnnual: '',
                isComingSoon: false,
                isHidden: false,
                isRecommended: false,
                features: ["Subida CVs (PDF/Word)", "Subida masiva por Excel", "Análisis de IA", "Vacantes Activas", "Soporte Directo"]
            },
            {
                id: 'plan_pro',
                name: 'Pro',
                aiAnalysisLimit: 500,
                internalVacanciesLimit: 10,
                publicVacanciesLimit: 10,
                killerQuestionsLimit: 5,
                maxAdmins: 1,
                maxRecruiters: 0,
                priceMonthly: 89,
                priceAnnual: 908,
                stripePriceIdMonthly: '',
                stripePriceIdAnnual: '',
                isComingSoon: false,
                isHidden: false,
                isRecommended: true,
                features: ["Análisis de IA", "Vacantes Activas", "Exportación a Excel/PDF", "Filtros Avanzados"]
            },
            {
                id: 'plan_pro_team',
                name: 'Pro Team',
                aiAnalysisLimit: 1200,
                internalVacanciesLimit: 15,
                publicVacanciesLimit: 15,
                killerQuestionsLimit: 5,
                maxAdmins: 2,
                maxRecruiters: 4,
                priceMonthly: 149,
                priceAnnual: 1520,
                stripePriceIdMonthly: '',
                stripePriceIdAnnual: '',
                isComingSoon: false,
                isHidden: false,
                isRecommended: false,
                features: ["Análisis de IA", "Vacantes Activas", "Exportación a Excel/PDF", "Filtros Avanzados", "Hasta 2 Admins y 4 Reclutadores"]
            },
            {
                id: 'plan_gold',
                name: 'Gold',
                aiAnalysisLimit: 2000,
                internalVacanciesLimit: 15,
                publicVacanciesLimit: 15,
                killerQuestionsLimit: 999,
                maxAdmins: 2,
                maxRecruiters: 6,
                priceMonthly: 199,
                priceAnnual: 2028,
                stripePriceIdMonthly: '',
                stripePriceIdAnnual: '',
                isComingSoon: true,
                isHidden: true,
                isRecommended: false,
                features: ["Análisis de IA", "Vacantes Activas", "Preguntas Filtro Ilimitadas", "Exportación a Excel/PDF", "Soporte VIP Directo", "Dashboards de Analítica", "Hasta 2 Admins y 6 Reclutadores"]
            },
        ];

        try {
            setLoading(true);
            for (const p of defaults) {
                await setDoc(doc(db, 'config_plans', p.id), { ...p, updatedAt: new Date() });
            }
            Alert.alert("Éxito", "Planes restaurados.");
            fetchData();
        } catch (e) {
            Alert.alert("Error", "No se pudo restaurar.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
            Alert.alert("Enviado", `Se ha enviado el enlace de reset a ${email}`);
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    const handleDeleteCompany = async (companyId: string, email: string) => {
        const confirmDelete = () => {
            return new Promise((resolve) => {
                if (Platform.OS === 'web') {
                    resolve(window.confirm(`¿Estás seguro de eliminar la cuenta de ${email}?\nEsta acción eliminará su perfil, sus vacantes y sus candidatos.`));
                } else {
                    Alert.alert(
                        "Eliminar Cuenta",
                        `¿Estás seguro de eliminar la cuenta de ${email}? Esta acción no se puede deshacer y borrará todos sus datos.`,
                        [
                            { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
                            { text: "Eliminar", style: "destructive", onPress: () => resolve(true) }
                        ]
                    );
                }
            });
        };

        const confirmed = await confirmDelete();
        if (!confirmed) return;

        setLoading(true);
        try {
            // 1. Delete company document in users_empresas and companies
            await deleteDoc(doc(db, 'users_empresas', companyId));
            await deleteDoc(doc(db, 'companies', companyId)).catch(() => {});

            // 2. Find and delete jobs of this company
            const jobsQuery = query(collection(db, 'jobs'), where('companyId', '==', companyId));
            const jobsSnap = await getDocs(jobsQuery);
            for (const jobDoc of jobsSnap.docs) {
                // Delete candidates first
                const candidatesSnap = await getDocs(collection(db, 'jobs', jobDoc.id, 'candidates'));
                for (const candDoc of candidatesSnap.docs) {
                    await deleteDoc(doc(db, 'jobs', jobDoc.id, 'candidates', candDoc.id));
                }
                // Delete job
                await deleteDoc(doc(db, 'jobs', jobDoc.id));
            }

            Alert.alert("Éxito", `La cuenta de ${email} y todos sus datos han sido eliminados.`);
            fetchData();
        } catch (error: any) {
            console.error("Error deleting company:", error);
            Alert.alert("Error", "No se pudo eliminar la cuenta: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePlan = async (planId: string, planName: string) => {
        const confirmDelete = () => {
            return new Promise((resolve) => {
                if (Platform.OS === 'web') {
                    resolve(window.confirm(`¿Estás seguro de eliminar el plan "${planName}"?`));
                } else {
                    Alert.alert(
                        "Eliminar Plan",
                        `¿Estás seguro de eliminar el plan "${planName}"? Esta acción no se puede deshacer.`,
                        [
                            { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
                            { text: "Eliminar", style: "destructive", onPress: () => resolve(true) }
                        ]
                    );
                }
            });
        };

        const confirmed = await confirmDelete();
        if (!confirmed) return;

        setLoading(true);
        try {
            await deleteDoc(doc(db, 'config_plans', planId));
            Alert.alert("Éxito", `El plan "${planName}" ha sido eliminado.`);
            fetchData();
        } catch (error: any) {
            console.error("Error deleting plan:", error);
            Alert.alert("Error", "No se pudo eliminar el plan: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (comp: CompanyProfile) => {
        setSelectedCompany(comp);
        setEditSub({
            plan: comp.subscription?.plan || 'beta_free',
            aiAnalysisLimit: comp.subscription?.aiAnalysisLimit || 200,
            internalVacanciesLimit: comp.subscription?.internalVacanciesLimit || 10,
            publicVacanciesLimit: comp.subscription?.publicVacanciesLimit || 5,
            killerQuestionsLimit: comp.subscription?.killerQuestionsLimit || 2,
        });
        setEditModalVisible(true);
    };

    const openPlanModal = (plan?: any) => {
        if (plan) {
            setSelectedPlan(plan);
            setNewPlan({
                id: plan.id || '',
                name: plan.name || '',
                aiAnalysisLimit: plan.aiAnalysisLimit || 200,
                internalVacanciesLimit: plan.internalVacanciesLimit || 10,
                publicVacanciesLimit: plan.publicVacanciesLimit || 5,
                killerQuestionsLimit: plan.killerQuestionsLimit || 2,
                maxAdmins: plan.maxAdmins || 1,
                maxRecruiters: plan.maxRecruiters || 0,
                priceMonthly: plan.priceMonthly || 0,
                priceAnnual: plan.priceAnnual || 0,
                stripePriceIdMonthly: plan.stripePriceIdMonthly || '',
                stripePriceIdAnnual: plan.stripePriceIdAnnual || '',
                isComingSoon: plan.isComingSoon || false,
                isRecommended: plan.isRecommended || false,
                isHidden: plan.isHidden || false,
                features: plan.features || [],
            });
        } else {
            setSelectedPlan(null);
            setNewPlan({
                id: '',
                name: '',
                aiAnalysisLimit: 200,
                internalVacanciesLimit: 10,
                publicVacanciesLimit: 5,
                killerQuestionsLimit: 2,
                maxAdmins: 1,
                maxRecruiters: 0,
                priceMonthly: 0,
                priceAnnual: 0,
                stripePriceIdMonthly: '',
                stripePriceIdAnnual: '',
                isComingSoon: false,
                isRecommended: false,
                isHidden: false,
                features: [],
            });
        }
        setPlanModalVisible(true);
    };

    const renderRow = ({ item }: { item: CompanyProfile }) => {
        const isIndependiente = (item.company as any)?.type === 'independiente';
        return (
            <View style={styles.tableRow}>
                <View style={{ flex: 1.5 }}>
                    <Text style={styles.cellMain} numberOfLines={1}>
                        {isIndependiente ? item.company.name || item.email : item.company.name || (item.company as any).razonSocial || 'Sin Nombre'}
                    </Text>
                    <Text style={styles.cellSub}>{item.email}</Text>
                </View>

                <View style={{ flex: 1.2 }}>
                    <Text style={styles.cellValue}>{item.subscription?.plan?.toUpperCase() || 'BETA'}</Text>
                    <Text style={styles.cellSub}>Créditos IA: {candidatesCounts[item.uid] || 0} / {item.subscription?.aiAnalysisLimit || 200}</Text>
                    <Text style={styles.cellSub}>Links de Pub: {publicJobsCounts[item.uid] || 0} / {item.subscription?.publicVacanciesLimit || 5}</Text>
                    <Text style={styles.cellSub}>Postulantes: {candidatesCounts[item.uid] || 0}</Text>
                </View>
                
                <View style={styles.actionsColumn}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
                        <Edit3 size={16} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnAlt} onPress={() => handleResetPassword(item.email)}>
                        <Key size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnDelete} onPress={() => handleDeleteCompany(item.uid, item.email)}>
                        <Trash2 size={16} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const renderPlanRow = ({ item }: { item: any }) => (
        <View style={styles.tableRow}>
            <View style={{ flex: 1.5 }}>
                <Text style={styles.cellMain}>{item.name}</Text>
                <Text style={styles.cellSub}>ID: {item.id}</Text>
            </View>
            <View style={{ flex: 1.5 }}>
                <Text style={styles.cellSub}>IA: {item.aiAnalysisLimit}</Text>
                <Text style={styles.cellSub}>S/ {item.priceMonthly || 0} mes</Text>
                <Text style={styles.cellSub}>Filtros: {item.killerQuestionsLimit || 0} preguntas</Text>
                {item.isRecommended && <Text style={[styles.cellSub, { color: COLORS.success, fontWeight: 'bold' }]}>★ RECOMENDADO</Text>}
                {item.isHidden && <Text style={[styles.cellSub, { color: '#EF4444', fontWeight: 'bold' }]}>Ø OCULTO</Text>}
                <Text style={styles.cellSub}>{item.features?.length || 0} características</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openPlanModal(item)}>
                    <Edit3 size={16} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnDelete} onPress={() => handleDeletePlan(item.id, item.name)}>
                    <Trash2 size={16} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );

    if (!isAdmin) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
                <ShieldCheck size={64} color={COLORS.textTertiary} />
                <Text style={{ color: COLORS.textPrimary, marginTop: 10, fontSize: 18 }}>Acceso denegado</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Panel de Control Veritly</Text>
                    <TouchableOpacity onPress={() => router.push('/empresa/dashboard/admin_analytics')} style={{flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4}}>
                         <TrendingUp size={14} color={COLORS.primary} />
                         <Text style={{color: COLORS.primary, fontSize: 12, fontWeight: 'bold'}}>Ver Analytics DNA Global</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={fetchData}>
                    <RefreshCw color={COLORS.primary} size={20} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 50 }} />
            ) : (
                <View style={{ flex: 1 }}>
                    <MetricsTabs />
                    
                    {activeTab === 'b2c' ? (
                        <View style={styles.tableContainer}>
                            <Text style={styles.sectionTitle}>Embudo B2C & Uso de IA</Text>
                            <View style={{ flexDirection: 'row', gap: 15, flexWrap: 'wrap', marginTop: 15 }}>
                                <View style={[styles.metricCard, { backgroundColor: COLORS.primary, flex: 1, minWidth: 140, padding: 20 }]}>
                                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Inscritos B2C</Text>
                                    <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold', marginVertical: 6 }}>{totalB2CRegistered}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Cuentas reales registradas</Text>
                                </View>
                                <View style={[styles.metricCard, { backgroundColor: COLORS.success, flex: 1, minWidth: 140, padding: 20 }]}>
                                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Match con Registro</Text>
                                    <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold', marginVertical: 6 }}>{totalB2CRegisteredWithMatch}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Usuarios con cuenta + IA</Text>
                                </View>
                                <View style={[styles.metricCard, { backgroundColor: COLORS.accent, flex: 1, minWidth: 140, padding: 20 }]}>
                                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Match sin Registro</Text>
                                    <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold', marginVertical: 6 }}>{totalB2CAnonWithMatch}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Postulantes invitados + IA</Text>
                                </View>
                                <View style={[styles.metricCard, { backgroundColor: '#8b5cf6', flex: 1, minWidth: 140, padding: 20 }]}>
                                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Clics a Racso 🚀</Text>
                                    <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold', marginVertical: 6 }}>{totalRacsoClicks}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Redirecciones totales a la app</Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.tableContainer}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                <Text style={styles.sectionTitle}>
                                    {activeTab === 'cuentas' ? 'Cuentas B2B' : (activeTab === 'planes' ? 'Planes del Sistema' : 'Sugerencias / Feedback')}
                                </Text>
                                {activeTab === 'planes' && (
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TouchableOpacity style={[styles.addBtn, { backgroundColor: COLORS.primary }]} onPress={handleRestoreDefaults}>
                                            <RefreshCw size={16} color="white" />
                                            <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 5 }}>Restaurar Iniciales</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.addBtn} onPress={() => openPlanModal()}>
                                            <Plus size={16} color="white" />
                                            <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 5 }}>Nuevo Plan</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                            
                            <FlatList
                                data={activeTab === 'cuentas' ? companies : (activeTab === 'planes' ? plans : feedback)}
                                keyExtractor={i => i.uid || i.id}
                                renderItem={({ item }) => {
                                    if (activeTab === 'cuentas') return renderRow({ item });
                                    if (activeTab === 'planes') return renderPlanRow({ item });
                                    return (
                                        <View style={styles.feedbackCard}>
                                            <View style={styles.feedbackHeader}>
                                                <Text style={styles.feedbackEmail}>{item.email}</Text>
                                                <Text style={styles.feedbackDate}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}</Text>
                                            </View>
                                            <Text style={styles.feedbackMessage}>{item.message}</Text>
                                        </View>
                                    );
                                }}
                                contentContainerStyle={{ paddingBottom: 50 }}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={COLORS.primary} />}
                                ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 30, color: COLORS.textTertiary }}>No hay datos para mostrar.</Text>}
                            />
                        </View>
                    )}
                </View>
            )}

            {/* EDIT ACCOUNT MODAL */}
            <Modal visible={editModalVisible} transparent animationType="fade">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Editar Cuenta</Text>
                        <Text style={styles.modalSub}>{selectedCompany?.email}</Text>

                        <Text style={styles.label}>Plan Activo (ID)</Text>
                        <TextInput 
                            style={styles.input}
                            value={editSub.plan}
                            onChangeText={t => setEditSub({...editSub, plan: t})}
                        />

                        <Text style={styles.label}>Límite Análisis IA</Text>
                        <TextInput 
                            style={styles.input}
                            value={(editSub.aiAnalysisLimit || 0).toString()}
                            onChangeText={t => setEditSub({...editSub, aiAnalysisLimit: parseInt(t) || 0})}
                            keyboardType="numeric"
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Vacantes Internas</Text>
                                <TextInput 
                                    style={styles.input}
                                    value={(editSub.internalVacanciesLimit || 0).toString()}
                                    onChangeText={t => setEditSub({...editSub, internalVacanciesLimit: parseInt(t) || 0})}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Vacantes Públicas</Text>
                                <TextInput 
                                    style={styles.input}
                                    value={(editSub.publicVacanciesLimit || 0).toString()}
                                    onChangeText={t => setEditSub({...editSub, publicVacanciesLimit: parseInt(t) || 0})}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <Text style={styles.label}>Límite Preguntas Filtro (Killer)</Text>
                        <TextInput 
                            style={styles.input}
                            value={(editSub.killerQuestionsLimit || 0).toString()}
                            onChangeText={t => setEditSub({...editSub, killerQuestionsLimit: parseInt(t) || 0})}
                            keyboardType="numeric"
                        />

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 25 }}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                                <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* PLAN MODAL */}
            <Modal visible={planModalVisible} transparent animationType="fade">
                <View style={styles.modalBg}>
                    <View style={[styles.modalCard, { maxHeight: '90%' }]}>
                        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 20 }}>
                            <Text style={styles.modalTitle}>{selectedPlan ? 'Editar Plan' : 'Nuevo Plan'}</Text>
                            
                            <Text style={styles.label}>ID del Plan (ej: pro_monthly)</Text>
                            <TextInput 
                                style={styles.input}
                                value={newPlan.id}
                                onChangeText={t => setNewPlan({...newPlan, id: t})}
                                editable={true}
                                placeholder="ej: beta_free, plan_pro"
                            />

                            <Text style={styles.label}>Nombre para mostrar</Text>
                            <TextInput 
                                style={styles.input}
                                value={newPlan.name}
                                onChangeText={t => setNewPlan({...newPlan, name: t})}
                            />

                            <Text style={styles.label}>Límite Análisis IA</Text>
                            <TextInput 
                                style={styles.input}
                                value={(newPlan.aiAnalysisLimit || 0).toString()}
                                onChangeText={t => setNewPlan({...newPlan, aiAnalysisLimit: parseInt(t) || 0})}
                                keyboardType="numeric"
                            />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Precio Mensual (S/)</Text>
                                    <TextInput 
                                        style={styles.input}
                                        value={(newPlan.priceMonthly || 0).toString()}
                                        onChangeText={t => setNewPlan({...newPlan, priceMonthly: parseInt(t) || 0})}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Precio Anual (S/)</Text>
                                    <TextInput 
                                        style={styles.input}
                                        value={(newPlan.priceAnnual || 0).toString()}
                                        onChangeText={t => setNewPlan({...newPlan, priceAnnual: parseInt(t) || 0})}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Stripe Price ID (mensual)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={newPlan.stripePriceIdMonthly || ''}
                                        onChangeText={t => setNewPlan({...newPlan, stripePriceIdMonthly: t})}
                                        placeholder="price_..."
                                        autoCapitalize="none"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Stripe Price ID (anual)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={newPlan.stripePriceIdAnnual || ''}
                                        onChangeText={t => setNewPlan({...newPlan, stripePriceIdAnnual: t})}
                                        placeholder="price_..."
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <Text style={styles.label}>Vacantes Activas (total, internas + públicas)</Text>
                            <TextInput
                                style={styles.input}
                                value={(newPlan.internalVacanciesLimit || 0).toString()}
                                onChangeText={t => {
                                    const n = parseInt(t) || 0;
                                    setNewPlan({...newPlan, internalVacanciesLimit: n, publicVacanciesLimit: n});
                                }}
                                keyboardType="numeric"
                            />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Límite Preguntas Filtro (Killer)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={(newPlan.killerQuestionsLimit || 0).toString()}
                                        onChangeText={t => setNewPlan({...newPlan, killerQuestionsLimit: parseInt(t) || 0})}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Máx. Admins (Team)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={(newPlan.maxAdmins || 0).toString()}
                                        onChangeText={t => setNewPlan({...newPlan, maxAdmins: parseInt(t) || 0})}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Máx. Reclutadores (Team)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={(newPlan.maxRecruiters || 0).toString()}
                                        onChangeText={t => setNewPlan({...newPlan, maxRecruiters: parseInt(t) || 0})}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                             <View style={{ flexDirection: 'row', gap: 15, marginTop: 15, flexWrap: 'wrap' }}>
                                 <TouchableOpacity 
                                     style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 110, marginVertical: 5 }}
                                     onPress={() => setNewPlan({...newPlan, isComingSoon: !newPlan.isComingSoon})}
                                 >
                                     <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: newPlan.isComingSoon ? COLORS.primary : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                                         {newPlan.isComingSoon && <Text style={{ color: 'white', fontSize: 12 }}>✓</Text>}
                                     </View>
                                     <Text style={{ marginLeft: 10, fontSize: 13, color: COLORS.textPrimary }}>Próximamente</Text>
                                 </TouchableOpacity>

                                 <TouchableOpacity 
                                     style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 110, marginVertical: 5 }}
                                     onPress={() => setNewPlan({...newPlan, isRecommended: !newPlan.isRecommended})}
                                 >
                                     <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: COLORS.success, backgroundColor: newPlan.isRecommended ? COLORS.success : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                                         {newPlan.isRecommended && <Text style={{ color: 'white', fontSize: 12 }}>✓</Text>}
                                     </View>
                                     <Text style={{ marginLeft: 10, fontSize: 13, color: COLORS.textPrimary }}>Recomendado</Text>
                                 </TouchableOpacity>

                                 <TouchableOpacity 
                                     style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 110, marginVertical: 5 }}
                                     onPress={() => setNewPlan({...newPlan, isHidden: !newPlan.isHidden})}
                                 >
                                     <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#EF4444', backgroundColor: newPlan.isHidden ? '#EF4444' : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                                         {newPlan.isHidden && <Text style={{ color: 'white', fontSize: 12 }}>✓</Text>}
                                     </View>
                                     <Text style={{ marginLeft: 10, fontSize: 13, color: COLORS.textPrimary }}>Ocultar Plan</Text>
                                 </TouchableOpacity>
                             </View>

                            <Text style={[styles.label, { marginTop: 15 }]}>Características Extras (Checklist)</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 }}>
                                {PREDEFINED_FEATURES.map(feat => {
                                    const isSelected = newPlan.features?.includes(feat);
                                    return (
                                        <TouchableOpacity 
                                            key={feat}
                                            style={{ 
                                                paddingHorizontal: 12, 
                                                paddingVertical: 6, 
                                                borderRadius: 20, 
                                                borderWidth: 1, 
                                                borderColor: isSelected ? COLORS.primary : COLORS.border,
                                                backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.1)' : 'transparent'
                                            }}
                                            onPress={() => {
                                                const current = newPlan.features || [];
                                                if (isSelected) {
                                                    setNewPlan({...newPlan, features: current.filter((f: string) => f !== feat)});
                                                } else {
                                                    setNewPlan({...newPlan, features: [...current, feat]});
                                                }
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, color: isSelected ? COLORS.primary : COLORS.textSecondary }}>
                                                {feat}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 25 }}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPlanModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={handleSavePlan}>
                                    <Text style={styles.saveBtnText}>Guardar Plan</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 20 },
    title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
    sectionTitle: { fontSize: 18, color: COLORS.textPrimary, fontWeight: '800' },
    
    metricsWrapper: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    metricCard: { flex: 1, backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
    metricValue: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginVertical: 4 },
    metricLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },

    tabSelector: { flexDirection: 'row', gap: 10, marginBottom: 5, flexWrap: 'wrap' },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)' },
    tabBtnActive: { backgroundColor: COLORS.primary },
    tabBtnText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },
    tabBtnTextActive: { color: 'white' },

    tableContainer: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border },
    tableRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    cellMain: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
    cellSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
    cellValue: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
    
    actionsColumn: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    actionBtn: { backgroundColor: COLORS.primary, padding: 8, borderRadius: 8 },
    actionBtnAlt: { backgroundColor: 'transparent', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary },
    actionBtnDelete: { backgroundColor: '#EF4444', padding: 8, borderRadius: 8 },
    addBtn: { backgroundColor: COLORS.success, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },

    // Modal
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    modalCard: { width: '90%', maxWidth: 450, backgroundColor: COLORS.surface, borderRadius: 24, padding: 30, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20 },
    modalTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 5 },
    modalSub: { color: COLORS.textSecondary, marginBottom: 20, fontSize: 14 },
    label: { color: COLORS.textPrimary, marginBottom: 8, marginTop: 15, fontSize: 13, fontWeight: '700' },
    input: { backgroundColor: COLORS.background, color: COLORS.textPrimary, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 15 },
    cancelBtn: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.05)' },
    cancelBtnText: { color: COLORS.textSecondary, fontWeight: '700' },
    saveBtn: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: COLORS.primary },
    saveBtnText: { color: 'white', fontWeight: '800' },
    feedbackCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    feedbackEmail: { fontWeight: 'bold', color: '#111827', fontSize: 14 },
    feedbackDate: { color: '#64748b', fontSize: 12 },
    feedbackMessage: { color: '#374151', fontSize: 14, lineHeight: 20 },
});
