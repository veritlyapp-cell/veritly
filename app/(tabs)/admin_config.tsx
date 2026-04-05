import { Bell, CreditCard, Lock, Save, Settings, ShieldCheck, ToggleLeft, ToggleRight, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AdminUsersTable from '../../components/AdminUsersTable';
import { auth } from '../../config/firebase';
import { AppConfig, getAppConfig, updateAppConfig } from '../../services/credits-service';

const ADMIN_EMAILS = ['oscarqv88@gmail.com'];

export default function AdminConfigScreen() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [currentTab, setCurrentTab] = useState<'config' | 'users' | 'analytics'>('config');
    const [totalB2B, setTotalB2B] = useState(0);
    const [b2cStats, setB2cStats] = useState({ revenue: 0, newThisMonth: 0, avgLogins: 0, total: 0 });

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        const user = auth.currentUser;
        if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
            setIsAdmin(true);
            const data = await getAppConfig();
            setConfig(data);
            
            // Fetch B2B cross-summary
            try {
                const { collection, getDocs, query } = require('firebase/firestore');
                const { db } = require('../../config/firebase');
                const snap = await getDocs(query(collection(db, 'users_empresas')));
                setTotalB2B(snap.size);

                // Fetch B2C insights
                const candsSnap = await getDocs(query(collection(db, 'users_candidatos')));
                let totalCands = candsSnap.size;
                let newThisMonth = 0;
                let totalLogins = 0;
                const currentMonthNum = new Date().getMonth();

                candsSnap.forEach((doc: any) => {
                    const data = doc.data();
                    if(data.createdAt) {
                        const d = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                        if(d.getMonth() === currentMonthNum) newThisMonth++;
                    }
                    totalLogins += (data.loginCount || 0);
                });

                // Fetch Revenue from credits
                const creditsSnap = await getDocs(query(collection(db, 'user_credits')));
                let totalRevenue = 0;
                creditsSnap.forEach((doc: any) => {
                    const data = doc.data();
                    if(data.purchaseHistory && Array.isArray(data.purchaseHistory)) {
                        data.purchaseHistory.forEach((p: any) => {
                            totalRevenue += (p.amountUSD || 0);
                        });
                    }
                });

                setB2cStats({
                    revenue: totalRevenue,
                    newThisMonth,
                    total: totalCands,
                    avgLogins: totalCands > 0 ? (totalLogins / totalCands) : 0
                });
            } catch (e) {
                console.error(e);
            }
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        try {
            await updateAppConfig(config);
            Alert.alert("✅ Éxito", "Configuración actualizada correctamente.");
        } catch (e) {
            Alert.alert("❌ Error", "No se pudo guardar la configuración.");
        } finally {
            setSaving(false);
        }
    };

    const updatePackage = (id: string, field: string, value: any) => {
        if (!config) return;
        const newPackages = config.packages.map(pkg =>
            pkg.id === id ? { ...pkg, [field]: value } : pkg
        );
        setConfig({ ...config, packages: newPackages });
    };

    const togglePackageStatus = (id: string) => {
        if (!config) return;
        const newPackages = config.packages.map(pkg =>
            pkg.id === id ? { ...pkg, active: !pkg.active } : pkg
        );
        setConfig({ ...config, packages: newPackages });
    };

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#3b82f6" />
        </View>
    );

    if (!isAdmin) return (
        <View style={styles.center}>
            <Lock size={64} color="#64748b" />
            <Text style={styles.errorText}>Acceso Denegado</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Configuración</Text>
                    <Text style={styles.subtitle}>Gestión Global de Veritly</Text>
                </View>
                <ShieldCheck color="#10b981" size={24} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.mainTab, currentTab === 'config' && styles.mainTabActive]}
                        onPress={() => setCurrentTab('config')}
                    >
                        <Settings size={20} color={currentTab === 'config' ? 'white' : '#94a3b8'} />
                        <Text style={[styles.mainTabText, currentTab === 'config' && styles.mainTabTextActive]}>Configuración</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.mainTab, currentTab === 'users' && styles.mainTabActive]}
                        onPress={() => setCurrentTab('users')}
                    >
                        <Users size={20} color={currentTab === 'users' ? 'white' : '#94a3b8'} />
                        <Text style={[styles.mainTabText, currentTab === 'users' && styles.mainTabTextActive]}>Usuarios ({b2cStats.total})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.mainTab, currentTab === 'analytics' && styles.mainTabActive]}
                        onPress={() => setCurrentTab('analytics')}
                    >
                        <CreditCard size={20} color={currentTab === 'analytics' ? 'white' : '#94a3b8'} />
                        <Text style={[styles.mainTabText, currentTab === 'analytics' && styles.mainTabTextActive]}>Métricas</Text>
                    </TouchableOpacity>
                </View>

                {currentTab === 'analytics' ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💰 Ingresos y Uso B2C</Text>
                        <View style={{ flexDirection: 'row', gap: 15, flexWrap: 'wrap' }}>
                            <View style={[styles.metricCard, { backgroundColor: '#10b981' }]}>
                                <Text style={{ color: 'white', fontSize: 14 }}>Ingresos Totales</Text>
                                <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>${b2cStats.revenue.toFixed(2)}</Text>
                                <Text style={{ color: '#d1fae5', fontSize: 10 }}>Por venta de créditos</Text>
                            </View>
                            <View style={styles.metricCard}>
                                <Text style={{ color: '#94a3b8', fontSize: 14 }}>Nuevos este mes</Text>
                                <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>+{b2cStats.newThisMonth}</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 10 }}>Candidatos registrados</Text>
                            </View>
                            <View style={styles.metricCard}>
                                <Text style={{ color: '#94a3b8', fontSize: 14 }}>Uso de Plataforma</Text>
                                <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>{Math.round(b2cStats.avgLogins)}</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 10 }}>Logins promedio por usuario</Text>
                            </View>
                        </View>
                    </View>
                ) : currentTab === 'users' ? (
                    <AdminUsersTable />
                ) : (
                    <>
                        {/* CROSS SUMMARY */}
                        <View style={[styles.section, { backgroundColor: '#3b82f6' }]}>
                            <Text style={styles.sectionTitle}>Resumen B2B 🚀</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ color: 'white', fontSize: 16 }}>Empresas Registradas:</Text>
                                <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>{totalB2B}</Text>
                            </View>
                            <Text style={{ color: '#dbeafe', fontSize: 12, marginTop: 5 }}>Ir al portal de Empresas para gestionar clientes.</Text>
                        </View>

                        {/* GLOBAL SWITCHES */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Módulos y Visibilidad</Text>

                            <TouchableOpacity
                                style={styles.switchRow}
                                onPress={() => setConfig(prev => prev ? ({ ...prev, showCreditsUI: !prev.showCreditsUI }) : null)}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.switchLabel}>Sistema de Créditos</Text>
                                    <Text style={styles.switchDesc}>Mostrar balance y límites a los usuarios</Text>
                                </View>
                                {config?.showCreditsUI !== false ? (
                                    <ToggleRight size={32} color="#10b981" />
                                ) : (
                                    <ToggleLeft size={32} color="#64748b" />
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.switchRow}
                                onPress={() => setConfig(prev => prev ? ({ ...prev, packagesEnabled: !prev.packagesEnabled }) : null)}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.switchLabel}>Venta de Paquetes</Text>
                                    <Text style={styles.switchDesc}>Habilitar modal de compra en el Scanner</Text>
                                </View>
                                {config?.packagesEnabled ? (
                                    <ToggleRight size={32} color="#10b981" />
                                ) : (
                                    <ToggleLeft size={32} color="#64748b" />
                                )}
                            </TouchableOpacity>

                            <View style={styles.inputBox}>
                                <Text style={styles.label}>Créditos Gratuitos Mensuales</Text>
                                <TextInput
                                    style={styles.input}
                                    value={config?.freeCreditsPerMonth.toString()}
                                    onChangeText={(t) => setConfig(prev => prev ? ({ ...prev, freeCreditsPerMonth: parseInt(t) || 0 }) : null)}
                                    keyboardType="numeric"
                                />
                            </View>

                            {/* NOTIFICATIONS SETTINGS */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Bell color="#38bdf8" size={20} />
                                    <Text style={styles.sectionTitle}>Notificaciones por Correo</Text>
                                </View>

                                <View style={styles.inputBox}>
                                    <Text style={styles.label}>Email Admin (Recibe las alertas)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={config?.notifications?.adminEmail || ''}
                                        onChangeText={(t) => setConfig(prev => prev ? ({ ...prev, notifications: { ...prev.notifications, adminEmail: t } as any }) : null)}
                                        placeholder="admin@ejemplo.com"
                                        placeholderTextColor="#64748b"
                                    />
                                </View>

                                <View style={{ height: 15 }} />

                                <TouchableOpacity
                                    style={styles.switchRow}
                                    onPress={() => setConfig(prev => prev ? ({ ...prev, notifications: { ...prev.notifications, newCandidateEmail: !prev.notifications?.newCandidateEmail } as any }) : null)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.switchLabel}>Nuevos Candidatos</Text>
                                        <Text style={styles.switchDesc}>Recibir email cuando se registre un candidato</Text>
                                    </View>
                                    {config?.notifications?.newCandidateEmail ? (
                                        <ToggleRight size={32} color="#10b981" />
                                    ) : (
                                        <ToggleLeft size={32} color="#64748b" />
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.switchRow, { marginBottom: 0 }]}
                                    onPress={() => setConfig(prev => prev ? ({ ...prev, notifications: { ...prev.notifications, newCompanyEmail: !prev.notifications?.newCompanyEmail } as any }) : null)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.switchLabel}>Nuevas Empresas</Text>
                                        <Text style={styles.switchDesc}>Recibir email cuando se registre una empresa</Text>
                                    </View>
                                    {config?.notifications?.newCompanyEmail ? (
                                        <ToggleRight size={32} color="#10b981" />
                                    ) : (
                                        <ToggleLeft size={32} color="#64748b" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* PACKAGE EDITOR */}
                        <Text style={styles.sectionTitle}>Edición de Paquetes</Text>
                        {config?.packages.map((pkg) => (
                            <View key={pkg.id} style={styles.packageCard}>
                                <View style={styles.packageHeader}>
                                    <CreditCard size={20} color={pkg.active ? "#3b82f6" : "#64748b"} />
                                    <TextInput
                                        style={[styles.packageName, !pkg.active && { color: '#64748b' }]}
                                        value={pkg.name}
                                        onChangeText={(t) => updatePackage(pkg.id, 'name', t)}
                                    />
                                    <TouchableOpacity onPress={() => togglePackageStatus(pkg.id)}>
                                        <Text style={{ color: pkg.active ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: 12 }}>
                                            {pkg.active ? 'ACTIVO' : 'INACTIVO'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.packageGrid}>
                                    <View style={styles.gridItem}>
                                        <Text style={styles.miniLabel}>Créditos</Text>
                                        <TextInput
                                            style={styles.gridInput}
                                            value={pkg.credits.toString()}
                                            onChangeText={(t) => updatePackage(pkg.id, 'credits', parseInt(t) || 0)}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={styles.gridItem}>
                                        <Text style={styles.miniLabel}>Precio USD</Text>
                                        <TextInput
                                            style={styles.gridInput}
                                            value={pkg.priceUSD.toString()}
                                            onChangeText={(t) => updatePackage(pkg.id, 'priceUSD', parseFloat(t) || 0)}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={styles.gridItem}>
                                        <Text style={styles.miniLabel}>Precio PEN</Text>
                                        <TextInput
                                            style={styles.gridInput}
                                            value={pkg.pricePEN.toString()}
                                            onChangeText={(t) => updatePackage(pkg.id, 'pricePEN', parseFloat(t) || 0)}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>
                            </View>
                        ))}

                        <TouchableOpacity
                            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Save size={20} color="white" />
                                    <Text style={styles.saveBtnText}>Guardar Configuración</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    title: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    subtitle: { color: '#64748b', fontSize: 13 },
    content: { padding: 20 },
    errorText: { color: '#94a3b8', marginTop: 20, fontSize: 18, fontWeight: 'bold' },

    section: { backgroundColor: '#1e293b', borderRadius: 16, padding: 15, marginBottom: 25 },
    sectionTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },

    switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    switchLabel: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    switchDesc: { color: '#94a3b8', fontSize: 13 },
    metricCard: { flex: 1, minWidth: 100, backgroundColor: '#334155', padding: 15, borderRadius: 12 },

    inputBox: { gap: 8 },
    label: { color: '#94a3b8', fontSize: 12 },
    input: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, color: 'white', borderWidth: 1, borderColor: '#334155' },

    packageCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
    packageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
    packageName: { flex: 1, color: 'white', fontSize: 16, fontWeight: 'bold', padding: 0 },

    packageGrid: { flexDirection: 'row', gap: 10 },
    gridItem: { flex: 1 },
    miniLabel: { color: '#64748b', fontSize: 10, marginBottom: 4 },
    gridInput: { backgroundColor: '#0f172a', borderRadius: 8, padding: 8, color: 'white', fontSize: 14, borderWidth: 1, borderColor: '#334155' },

    saveBtn: { backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 10, marginTop: 10 },
    saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Tabs
    tabContainer: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 12, padding: 4, marginBottom: 20 },
    mainTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8, borderRadius: 8 },
    mainTabActive: { backgroundColor: '#3b82f6' },
    mainTabText: { color: '#94a3b8', fontWeight: '600' },
    mainTabTextActive: { color: 'white' },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 }
});
