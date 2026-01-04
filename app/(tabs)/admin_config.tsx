import { CreditCard, Lock, Save, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../config/firebase';
import { AppConfig, getAppConfig, updateAppConfig } from '../../services/credits-service';

const ADMIN_EMAILS = ['test+1@gmail.com', 'oscar@veritlyapp.com', 'oscar@relielabs.com'];

export default function AdminConfigScreen() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [config, setConfig] = useState<AppConfig | null>(null);

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        const user = auth.currentUser;
        if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
            setIsAdmin(true);
            const data = await getAppConfig();
            setConfig(data);
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

                {/* GLOBAL SWITCHES */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Módulo de Créditos</Text>
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

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
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
    switchLabel: { color: 'white', fontSize: 15, fontWeight: 'bold' },
    switchDesc: { color: '#64748b', fontSize: 12 },

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
    saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
