import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Building2, ChevronDown, MapPin, User, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../../config/firebase';
import { getDepartamentos, getDistritos, getProvincias } from '../../../utils/geo-peru';

export default function CompanyOnboarding() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // DATOS COMPAÑÍA
    const [ruc, setRuc] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [nombreComercial, setNombreComercial] = useState('');

    // UBICACIÓN (Perú)
    const [departamento, setDepartamento] = useState('Lima');
    const [provincia, setProvincia] = useState('');
    const [distrito, setDistrito] = useState('');
    const [direccion, setDireccion] = useState('');

    // Listas dinámicas
    const [departamentosList] = useState(getDepartamentos());
    const [provinciasList, setProvinciasList] = useState<string[]>([]);
    const [distritosList, setDistritosList] = useState<string[]>([]);

    // Modal Control
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'dep' | 'prov' | 'dist'>('dep');

    // RESPONSABLE
    const [nombreResponsable, setNombreResponsable] = useState('');
    const [cargoResponsable, setCargoResponsable] = useState('');
    const [celular, setCelular] = useState('');
    const [emailResponsable, setEmailResponsable] = useState('');

    useEffect(() => {
        const loadDraft = async () => {
            if (!auth.currentUser) return;

            // Pre-fill email with authenticated user's email
            if (auth.currentUser.email) {
                setEmailResponsable(auth.currentUser.email);
            }

            const docRef = doc(db, 'users_empresas', auth.currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.profileCompleted) {
                    router.replace('/empresa/dashboard');
                    return;
                }
                if (data.ruc) setRuc(data.ruc);
                if (data.razonSocial) setRazonSocial(data.razonSocial);
            }
        };
        loadDraft();
    }, []);

    // Actualizar provincias cuando cambia departamento
    useEffect(() => {
        const provs = getProvincias(departamento);
        setProvinciasList(provs);
        setProvincia('');
        setDistrito('');
    }, [departamento]);

    // Actualizar distritos cuando cambia provincia
    useEffect(() => {
        if (provincia) {
            const dists = getDistritos(departamento, provincia);
            setDistritosList(dists);
            setDistrito('');
        } else {
            setDistritosList([]);
        }
    }, [provincia]);

    const handleSave = async () => {
        const missing = [];
        if (!ruc || ruc.length !== 11) missing.push("RUC (Correcto)");
        if (!razonSocial) missing.push("Razón Social");
        if (!nombreComercial) missing.push("Nombre Comercial");
        if (!departamento || !provincia || !distrito) missing.push("Ubicación Completa (Dep/Prov/Dist)");
        if (!direccion) missing.push("Dirección Fiscal");
        if (!nombreResponsable) missing.push("Nombre Responsable");
        if (!cargoResponsable) missing.push("Cargo");
        if (!celular) missing.push("Celular");
        if (!emailResponsable) missing.push("Email de Contacto");

        if (missing.length > 0) {
            return Alert.alert(
                "Faltan completar datos",
                "Por favor llena los siguientes campos obligatorios:\n\n- " + missing.join("\n- ")
            );
        }

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            const companyData = {
                uid: user.uid,
                email: user.email,
                role: 'empresa', // ← ROLE ASSIGNMENT FOR FIRESTORE
                company: {
                    name: nombreComercial,
                    ruc,
                    razonSocial,
                    location: { departamento, provincia, distrito, address: direccion }
                },
                responsible: {
                    name: nombreResponsable,
                    position: cargoResponsable,
                    phone: celular,
                    email: emailResponsable
                },
                subscription: {
                    plan: 'free',
                    jobsLimit: 5,
                    candidatesAnalyzed: 0
                },
                profileCompleted: true,
                status: 'Active',
                verificationToken: Math.random().toString(36).substring(7),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Save to users_empresas collection (role-based)
            await setDoc(doc(db, 'users_empresas', user.uid), companyData, { merge: true });

            Alert.alert("¡Registro Exitoso!", "Tu empresa ha sido activada correctamente, ya puedes publicar.");
            router.replace('/empresa/dashboard');

        } catch (e: any) {
            Alert.alert("Error al Guardar", e.message);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (type: 'dep' | 'prov' | 'dist') => {
        if (type === 'prov' && !departamento) return Alert.alert("Atención", "Primero selecciona un Departamento");
        if (type === 'dist' && !provincia) return Alert.alert("Atención", "Primero selecciona una Provincia");
        setModalType(type);
        setModalVisible(true);
    };

    const handleSelect = (item: string) => {
        if (modalType === 'dep') setDepartamento(item);
        if (modalType === 'prov') setProvincia(item);
        if (modalType === 'dist') setDistrito(item);
        setModalVisible(false);
    };

    const getListData = () => {
        if (modalType === 'dep') return departamentosList;
        if (modalType === 'prov') return provinciasList;
        return distritosList;
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Perfil de Empresa</Text>
                <Text style={{ color: '#64748b', fontSize: 12 }}>Completa todos los campos (*)</Text>
            </View>

            <ScrollView contentContainerStyle={styles.form}>

                {/* SECCIÓN 1: DATOS CORPORATIVOS */}
                <View style={styles.sectionHeader}>
                    <Building2 color="#38bdf8" size={24} />
                    <Text style={styles.sectionTitle}>Datos Corporativos</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>RUC (11 Dígitos) *</Text>
                    <TextInput style={styles.input} placeholder="20100..." placeholderTextColor="#64748b" value={ruc} onChangeText={setRuc} keyboardType="numeric" maxLength={11} />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Razón Social *</Text>
                    <TextInput style={styles.input} placeholder="Mi Empresa S.A.C." placeholderTextColor="#64748b" value={razonSocial} onChangeText={setRazonSocial} />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nombre Comercial (Visible) *</Text>
                    <TextInput style={styles.input} placeholder="Mi Marca" placeholderTextColor="#64748b" value={nombreComercial} onChangeText={setNombreComercial} />
                </View>

                {/* SECCIÓN 2: UBICACIÓN */}
                <View style={[styles.sectionHeader, { marginTop: 25 }]}>
                    <MapPin color="#38bdf8" size={24} />
                    <Text style={styles.sectionTitle}>Ubicación</Text>
                </View>

                <Text style={styles.label}>Departamento *</Text>
                <TouchableOpacity style={styles.selectButton} onPress={() => openModal('dep')}>
                    <Text style={{ color: 'white' }}>{departamento || "Seleccionar..."}</Text>
                    <ChevronDown color="#94a3b8" size={20} />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Provincia *</Text>
                        <TouchableOpacity style={styles.selectButton} onPress={() => openModal('prov')}>
                            <Text style={{ color: provincia ? 'white' : '#64748b' }}>{provincia || "Seleccionar..."}</Text>
                            <ChevronDown color="#94a3b8" size={20} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Distrito *</Text>
                        <TouchableOpacity style={styles.selectButton} onPress={() => openModal('dist')}>
                            <Text style={{ color: distrito ? 'white' : '#64748b' }}>{distrito || "Seleccionar..."}</Text>
                            <ChevronDown color="#94a3b8" size={20} />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.label}>Dirección Fiscal</Text>
                <TextInput style={styles.input} placeholder="Av. Principal 123" placeholderTextColor="#64748b" value={direccion} onChangeText={setDireccion} />


                {/* SECCIÓN 3: RESPONSABLE */}
                <View style={[styles.sectionHeader, { marginTop: 25 }]}>
                    <User color="#38bdf8" size={24} />
                    <Text style={styles.sectionTitle}>Contacto Responsable</Text>
                </View>

                <Text style={styles.label}>Nombre Completo *</Text>
                <TextInput style={styles.input} placeholder="Nombre Apellido" placeholderTextColor="#64748b" value={nombreResponsable} onChangeText={setNombreResponsable} />

                <Text style={styles.label}>Cargo *</Text>
                <TextInput style={styles.input} placeholder="Ej: Gerente de RRHH" placeholderTextColor="#64748b" value={cargoResponsable} onChangeText={setCargoResponsable} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Celular *</Text>
                        <TextInput style={styles.input} placeholder="999..." placeholderTextColor="#64748b" value={celular} onChangeText={setCelular} keyboardType="phone-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Email (Registrado) *</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: '#1a2332', opacity: 0.7 }]}
                            placeholder="juan@empresa.com"
                            placeholderTextColor="#64748b"
                            value={emailResponsable}
                            editable={false}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>FINALIZAR REGISTRO</Text>}
                </TouchableOpacity>

                <View style={{ height: 50 }} />

            </ScrollView>

            {/* MODAL SELECTOR */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}><X color="white" size={24} /></TouchableOpacity>
                        </View>
                        <FlatList
                            data={getListData()}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.optionItem} onPress={() => handleSelect(item)}>
                                    <Text style={{ color: 'white', fontSize: 16 }}>{item}</Text>
                                    {(modalType === 'dep' && departamento === item) || (modalType === 'prov' && provincia === item) || (modalType === 'dist' && distrito === item) ? <View style={styles.selectedDot} /> : null}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center' },
    headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    form: { padding: 25 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 10 },
    sectionTitle: { color: '#38bdf8', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
    inputGroup: { marginBottom: 5 },
    label: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', marginBottom: 8, marginTop: 10 },
    input: { backgroundColor: '#1e293b', color: 'white', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#334155', fontSize: 15 },
    selectButton: { backgroundColor: '#1e293b', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    saveButton: { backgroundColor: '#10b981', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30 },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 15 },
    modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    optionItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' }
});
