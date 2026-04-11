import { collection, getDocs, orderBy, query, updateDoc, doc, setDoc, where } from 'firebase/firestore';
import { Building2, CreditCard, DollarSign, Edit3, ShieldCheck, TrendingUp, Users, RefreshCw, Key } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, TextInput, Modal, Platform } from 'react-native';
import { auth, db } from '../../../config/firebase';
import { CompanyProfile } from '../../../services/auth-service';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function EmpresaAdminDashboard() {
    const [companies, setCompanies] = useState<CompanyProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [totalB2C, setTotalB2C] = useState(0);
    
    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<CompanyProfile | null>(null);
    const [editingPlan, setEditingPlan] = useState<'free' | 'pro' | 'enterprise'>('free');
    const [editingCredits, setEditingCredits] = useState('0');

    useEffect(() => {
        const user = auth.currentUser;
        if (user && user.email === 'oscar@veritlyapp.com') {
            setIsAdmin(true);
            fetchData();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchData = async () => {
        try {
            const q = query(collection(db, 'users_empresas'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => doc.data() as CompanyProfile);
            setCompanies(data);
            
            // Fetch B2C metrics
            try {
                const b2cSnapshot = await getDocs(query(collection(db, 'users_candidatos')));
                setTotalB2C(b2cSnapshot.size);

                // Fetch real usage for each company based on their jobs' candidates
                const updatedCompanies = await Promise.all(data.map(async (company) => {
                    let usage = 0;
                    try {
                        const jobsQ = query(collection(db, 'jobs'), where('companyId', '==', company.uid));
                        const jobsSnap = await getDocs(jobsQ);
                        
                        // Sum up all candidates for each job of this company
                        for (const jobDoc of jobsSnap.docs) {
                            const candidatesSnap = await getDocs(collection(db, 'jobs', jobDoc.id, 'candidates'));
                            usage += candidatesSnap.size;
                        }
                    } catch (e) {
                        console.error("Error fetching usage for company:", company.uid, e);
                    }
                    return { ...company, analyzedUsage: usage };
                }));
                
                setCompanies(updatedCompanies);
            } catch(e) {
                console.error("Error cargando B2C en Admin Empresas:", e);
            }
        } catch (error) {
            console.error("Error cargando empresas:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const MetricsTabs = () => {
        // Calculando métricas más complejas
        const totalCompanies = companies.length;
        const totalPro = companies.filter(c => c.subscription?.plan === 'pro').length;
        const totalFree = totalCompanies - totalPro;
        
        let mrrUSD = totalPro * 12;

        // Historial básico y uso
        const currentMonthNum = new Date().getMonth();
        const thisMonthComps = companies.filter(c => {
            if(!c.createdAt) return false;
            const createdAt: any = c.createdAt;
            const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
            return d.getMonth() === currentMonthNum;
        });
        
        let avgLogins = 0;
        if(totalCompanies > 0) {
           avgLogins = companies.reduce((acc, c) => acc + ((c as any).loginCount || 0), 0) / totalCompanies;
        }

        return (
            <>
                <View style={[styles.metricsWrapper, { marginBottom: 15, backgroundColor: '#38bdf8', padding: 15, borderRadius: 16 }]}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                            <Users color="white" size={24} />
                            <View>
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Resumen Candidatos B2C</Text>
                                <Text style={{ color: '#bae6fd', fontSize: 12 }}>Candidatos registrados en la plataforma</Text>
                            </View>
                        </View>
                        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>{totalB2C}</Text>
                    </View>
                </View>
                
                <View style={styles.metricsWrapper}>
                    <View style={styles.metricCard}>
                        <Building2 color="#3b82f6" size={24} />
                        <Text style={styles.metricValue}>{totalCompanies}</Text>
                        <Text style={styles.metricLabel}>Total Cuentas</Text>
                    </View>

                    <View style={styles.metricCard}>
                        <CreditCard color="#f59e0b" size={24} />
                        <Text style={styles.metricValue}>{totalPro}</Text>
                        <Text style={styles.metricLabel}>Cuentas PRO</Text>
                        <View style={{flexDirection: 'row', marginTop: 5, gap: 5}}>
                            <Text style={{color: '#10b981', fontSize: 10, fontWeight: 'bold'}}>+{thisMonthComps.length} este mes</Text>
                        </View>
                    </View>

                    <View style={styles.metricCard}>
                        <DollarSign color="#10b981" size={24} />
                        <Text style={styles.metricValue}>${mrrUSD}</Text>
                        <Text style={styles.metricLabel}>MRR Estimado</Text>
                        <Text style={{color: '#38bdf8', fontSize: 10, marginTop: 5, textAlign: 'center'}}>Prom. {Math.round(avgLogins)} logins/usuario</Text>
                    </View>
                </View>
            </>
        );
    };

    const handleSaveEdit = async () => {
        if (!selectedCompany) return;
        try {
            await setDoc(doc(db, 'users_empresas', selectedCompany.uid), {
                subscription: {
                    ...selectedCompany.subscription,
                    plan: editingPlan,
                    jobsLimit: parseInt(editingCredits) || 5,
                }
            }, { merge: true });
            
            Alert.alert("Éxito", "Cuenta actualizada.");
            setEditModalVisible(false);
            fetchData(); // reload
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo actualizar " + error);
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

    const openEditModal = (comp: CompanyProfile) => {
        setSelectedCompany(comp);
        setEditingPlan(comp.subscription?.plan || 'free');
        setEditingCredits((comp.subscription?.jobsLimit || 5).toString());
        setEditModalVisible(true);
    };

    const renderRow = ({ item }: { item: any }) => {
        const isIndependiente = item.company?.type === 'independiente';
        return (
            <View style={styles.tableRow}>
                <View style={{ flex: 1.5 }}>
                    <Text style={styles.cellMain} numberOfLines={1}>
                        {isIndependiente ? item.company.name || item.email : item.company.name || item.company.razonSocial || 'Sin Nombre'}
                    </Text>
                    <Text style={styles.cellSub}>{item.email}</Text>
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{isIndependiente ? 'Independiente' : 'Empresa'}</Text>
                    </View>
                </View>

                <View style={{ flex: 1.2 }}>
                    <Text style={styles.cellValue}>{item.subscription?.plan === 'pro' ? 'PRO' : 'BETA'}</Text>
                    <Text style={styles.cellSub}>Créditos: {item.subscription?.creditsUsage || 0} / {item.subscription?.creditsLimit || 200}</Text>
                    {item.subscription?.plan === 'pro' && <Text style={{color: '#10b981', fontSize: 10, marginTop:2}}>Upsell / Activo</Text>}
                </View>
                
                <View style={{ flex: 1 }}>
                     <Text style={styles.cellValue}>{item.loginCount || 0}</Text>
                     <Text style={styles.cellSub}>Sesiones</Text>
                     <Text style={{color: '#94a3b8', fontSize: 10, marginTop: 2}}>{item.lastLoginAt ? new Date(item.lastLoginAt.seconds ? item.lastLoginAt.toDate() : item.lastLoginAt).toLocaleDateString() : 'N/A'}</Text>
                </View>

                <View style={styles.actionsColumn}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
                        <Edit3 size={16} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnAlt} onPress={() => handleResetPassword(item.email)}>
                        <Key size={16} color="#38bdf8" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (!isAdmin) {
        return (
            <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
                <ShieldCheck size={64} color="#64748b" />
                <Text style={{ color: 'white', marginTop: 10, fontSize: 18 }}>Acceso denegado</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>B2B Admin Dashboard</Text>
                    <TouchableOpacity onPress={() => router.push('/empresa/dashboard/insights')} style={{flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4}}>
                         <TrendingUp size={14} color="#38bdf8" />
                         <Text style={{color: '#38bdf8', fontSize: 12, fontWeight: 'bold'}}>Ver Analytics DNA (Roadmap 2027)</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={fetchData}>
                    <RefreshCw color="#38bdf8" size={20} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color="#3b82f6" style={{ marginTop: 50 }} />
            ) : (
                <View style={{ flex: 1 }}>
                    <MetricsTabs />
                    
                    <View style={styles.tableContainer}>
                        <Text style={styles.sectionTitle}>Cuentas B2B ({companies.length})</Text>
                        <FlatList
                            data={companies}
                            keyExtractor={i => i.uid}
                            renderItem={renderRow}
                            contentContainerStyle={{ paddingBottom: 50 }}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#3b82f6" />}
                        />
                    </View>
                </View>
            )}

            {/* EDIT MODAL */}
            <Modal visible={editModalVisible} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Editar Cuenta</Text>
                        <Text style={styles.modalSub}>{selectedCompany?.email}</Text>

                        <Text style={styles.label}>Plan Activo</Text>
                        <View style={styles.planSelector}>
                            <TouchableOpacity 
                                style={[styles.planBtn, editingPlan === 'free' && styles.planBtnActive]}
                                onPress={() => setEditingPlan('free')}
                            ><Text style={[styles.planBtnText, editingPlan === 'free' && {color: 'white'}]}>FREE</Text></TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.planBtn, editingPlan === 'pro' && styles.planBtnActive]}
                                onPress={() => setEditingPlan('pro')}
                            ><Text style={[styles.planBtnText, editingPlan === 'pro' && {color: 'white'}]}>PRO</Text></TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Límite de Vacantes (Créditos)</Text>
                        <TextInput 
                            style={styles.input}
                            value={editingCredits}
                            onChangeText={setEditingCredits}
                            keyboardType="numeric"
                        />

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                                <Text style={styles.saveBtnText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
    title: { fontSize: 24, fontWeight: 'bold', color: 'white' },
    sectionTitle: { fontSize: 18, color: 'white', fontWeight: 'bold', marginBottom: 15 },
    
    metricsWrapper: { flexDirection: 'row', gap: 15, marginBottom: 25 },
    metricCard: { flex: 1, backgroundColor: '#1e293b', padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    metricValue: { color: 'white', fontSize: 28, fontWeight: 'bold', marginVertical: 8 },
    metricLabel: { color: '#94a3b8', fontSize: 12 },

    tableContainer: { flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#334155' },
    tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155', alignItems: 'center' },
    cellMain: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    cellSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    cellValue: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    
    typeBadge: { backgroundColor: '#334155', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
    typeBadgeText: { color: '#cbd5e1', fontSize: 10, fontWeight: 'bold' },

    actionsColumn: { flexDirection: 'row', gap: 8 },
    actionBtn: { backgroundColor: '#3b82f6', padding: 10, borderRadius: 8 },
    actionBtnAlt: { backgroundColor: 'transparent', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#38bdf8' },

    // Modal
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalCard: { width: '90%', maxWidth: 400, backgroundColor: '#1e293b', borderRadius: 16, padding: 25, borderWidth: 1, borderColor: '#334155' },
    modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    modalSub: { color: '#94a3b8', marginBottom: 20 },
    label: { color: '#e2e8f0', marginBottom: 8, marginTop: 10, fontSize: 13 },
    input: { backgroundColor: '#0f172a', color: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
    planSelector: { flexDirection: 'row', gap: 10 },
    planBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
    planBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    planBtnText: { color: '#94a3b8', fontWeight: 'bold' },
    cancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#334155' },
    cancelBtnText: { color: 'white', fontWeight: 'bold' },
    saveBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#10b981' },
    saveBtnText: { color: 'white', fontWeight: 'bold' }
});
