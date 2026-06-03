import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Building2, ChevronDown, MapPin, User, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert as RNAlert, FlatList, Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppHeader from '../../../components/AppHeader';
import { auth, db } from '../../../config/firebase';
import { getDepartamentos, getDistritos, getProvincias } from '../../../utils/geo-peru';

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

export default function CompanyOnboarding() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // DATOS COMPAÑÍA
    const [ruc, setRuc] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [nombreComercial, setNombreComercial] = useState('');
    const [userType, setUserType] = useState<'empresa' | 'independiente'>('empresa');
    const [dni, setDni] = useState('');

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
                const fetchedType = data.company?.type || 'empresa';
                setUserType(fetchedType);
                if (fetchedType === 'independiente') {
                    if (data.company?.dni) setDni(data.company.dni);
                    if (data.company?.name && !nombreResponsable) {
                        setNombreResponsable(data.company.name);
                    }
                }
                if (data.company?.ruc) setRuc(data.company.ruc);
                if (data.company?.razonSocial) setRazonSocial(data.company.razonSocial);
                if (data.company?.name) setNombreComercial(data.company.name);
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

    const handleSkip = async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            // Guardamos que el perfil fue omitido pero completado de forma mínima
            await setDoc(doc(db, 'users_empresas', user.uid), {
                profileCompleted: true,
                profileSkipped: true, // Flag para saber que omitió y recordarle después
                updatedAt: new Date()
            }, { merge: true });

            router.replace('/empresa/dashboard');
        } catch (e: any) {
            Alert.alert("Error al omitir", e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const missing = [];
        if (userType === 'empresa') {
            if (!ruc || ruc.length !== 11) missing.push("RUC (Correcto)");
            if (!razonSocial) missing.push("Razón Social");
            if (!nombreComercial) missing.push("Nombre Comercial");
        } else {
            if (!dni || dni.length !== 8) missing.push("DNI (Correcto)");
        }
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
                    name: userType === 'empresa' ? nombreComercial : (nombreComercial || nombreResponsable),
                    ...(userType === 'empresa' ? {
                        ruc,
                        razonSocial
                    } : {
                        dni
                    }),
                    type: userType,
                    location: { departamento, provincia, distrito, address: direccion }
                },
                responsible: {
                    name: nombreResponsable,
                    position: cargoResponsable,
                    phone: celular,
                    email: emailResponsable
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
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
            <AppHeader
                showAuthButtons={true}
                showBackButton={true}
                title="PERFIL EMPRESA"
                homeRoute="/empresa"
            />

            <ScrollView contentContainerStyle={styles.form}>

                {/* BOTÓN OMITIR POR AHORA */}
                <TouchableOpacity 
                    style={styles.skipButton} 
                    onPress={handleSkip}
                    disabled={loading}
                >
                    <Text style={styles.skipButtonText}>Omitir por ahora ➡️</Text>
                </TouchableOpacity>

                {/* SECCIÓN 1: DATOS CORPORATIVOS */}
                <View style={styles.sectionHeader}>
                    <Building2 color="#38bdf8" size={24} />
                    <Text style={styles.sectionTitle}>
                        {userType === 'empresa' ? "Datos Corporativos" : "Datos de Identificación"}
                    </Text>
                </View>

                {userType === 'empresa' ? (
                    <>
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
                    </>
                ) : (
                    <>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>DNI *</Text>
                            <TextInput 
                                style={[styles.input, dni ? { backgroundColor: '#E5E7EB', color: '#374151' } : {}]} 
                                value={dni} 
                                onChangeText={setDni}
                                editable={!dni} 
                                keyboardType="numeric"
                                maxLength={8}
                            />
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nombre Comercial / Marca (Opcional)</Text>
                            <TextInput style={styles.input} placeholder="Mi Marca Personal" placeholderTextColor="#64748b" value={nombreComercial} onChangeText={setNombreComercial} />
                        </View>
                    </>
                )}

                {/* SECCIÓN 2: UBICACIÓN */}
                <View style={[styles.sectionHeader, { marginTop: 25 }]}>
                    <MapPin color="#38bdf8" size={24} />
                    <Text style={styles.sectionTitle}>Ubicación</Text>
                </View>

                <Text style={styles.label}>Departamento *</Text>
                <TouchableOpacity style={styles.selectButton} onPress={() => openModal('dep')}>
                    <Text style={{ color: departamento ? '#111827' : '#64748b', fontSize: 15 }}>{departamento || "Seleccionar..."}</Text>
                    <ChevronDown color="#94a3b8" size={20} />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Provincia *</Text>
                        <TouchableOpacity style={styles.selectButton} onPress={() => openModal('prov')}>
                            <Text style={{ color: provincia ? '#111827' : '#64748b', fontSize: 15 }}>{provincia || "Seleccionar..."}</Text>
                            <ChevronDown color="#94a3b8" size={20} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Distrito *</Text>
                        <TouchableOpacity style={styles.selectButton} onPress={() => openModal('dist')}>
                            <Text style={{ color: distrito ? '#111827' : '#64748b', fontSize: 15 }}>{distrito || "Seleccionar..."}</Text>
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
                        <Text style={styles.label}>Email de Referencia *</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: '#1a2332', opacity: 0.8 }]}
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
                            <TouchableOpacity onPress={() => setModalVisible(false)}><X color="#111827" size={24} /></TouchableOpacity>
                        </View>
                        <FlatList
                            data={getListData()}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.optionItem} onPress={() => handleSelect(item)}>
                                    <Text style={{ color: '#374151', fontSize: 16 }}>{item}</Text>
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
    skipButton: {
        alignSelf: 'flex-end',
        backgroundColor: '#E5E7EB',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    skipButtonText: {
        color: '#374151',
        fontWeight: '700',
        fontSize: 13,
    },
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', alignItems: 'center' },
    headerTitle: { color: '#111827', fontSize: 20, fontWeight: 'bold' },
    form: { padding: 25 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 10 },
    sectionTitle: { color: '#4F46E5', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
    inputGroup: { marginBottom: 5 },
    label: { color: '#374151', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 10 },
    input: { backgroundColor: '#FFFFFF', color: '#111827', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 15 },
    selectButton: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    saveButton: { backgroundColor: '#4F46E5', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30 },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 15 },
    modalTitle: { color: '#111827', fontSize: 18, fontWeight: 'bold' },
    optionItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4F46E5' }
});
